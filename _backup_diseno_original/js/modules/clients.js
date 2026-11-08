/* =========================================================================
   ENVIA ERP · modules/clients.js
   Maestro de Clientes (PK: cédula / RIF) + expediente digital + wallet.
   ========================================================================= */
(function () {
  'use strict';
  const NS = (window.ENVIA = window.ENVIA || {});
  NS.modules = NS.modules || {};

  let filters = { q: '', status: '' };

  function docsCount(c) {
    return (c.url_foto_cedula ? 1 : 0) + (c.url_foto_rif ? 1 : 0);
  }

  function render(view) {
    const ui = NS.ui;
    const store = NS.store;
    const db = store.db;
    const canCreate = NS.app.canAction('clients', 'crear');
    const canEdit = NS.app.canAction('clients', 'editar');
    const canDelete = NS.app.canAction('clients', 'eliminar');
    const canExport = NS.app.canAction('clients', 'exportar');
    const q = filters.q.toLowerCase();

    // Leer sub-ruta del sidebar
    const sub = NS.router.getSubroute();
    if (sub && sub.module === 'clients') {
      if (sub.sub === 'clients-new' && canCreate) {
        setTimeout(() => openForm(), 50);
      }
    }
    const list = db.clients.filter((c) => {
      const hay = [c.cedula_rif, c.nombres, c.apellidos, c.telefono, c.correo, c.direccion].join(' ').toLowerCase();
      return (!q || hay.includes(q)) && (!filters.status || c.estatus === filters.status);
    });

    const totals = {
      walletUsd: db.clients.reduce((s, c) => s + Number(c.saldo_wallet_usd || 0), 0),
      walletVes: db.clients.reduce((s, c) => s + Number(c.saldo_wallet_ves || 0), 0),
      corporate: db.clients.filter((c) => c.estatus === 'Corporativo').length
    };

    view.innerHTML = `
      <div class="page-head">
        <div>
          <span class="eyebrow">Maestro de clientes · PK cédula / RIF</span>
          <h2 class="page-title">Cartera de usuarios de la app</h2>
          <p class="page-sub">${db.clients.length} clientes registrados · ${totals.corporate} corporativos · Wallet consolidada ${ui.usd(totals.walletUsd)} + ${ui.bs(totals.walletVes)}.</p>
        </div>
        <div class="page-actions">
          ${NS.reports.button('clients')}
          ${canExport ? `<button class="btn btn-ghost" id="clients-export">${ui.icon('download', 16)} Exportar CSV</button>` : ''}
          ${canCreate ? `<button class="btn btn-primary" id="clients-new">${ui.icon('plus', 16)} Nuevo cliente</button>` : ''}
        </div>
      </div>

      <div class="stat-strip">
        <div class="stat-strip-item"><span>Wallet USD consolidada</span><strong>${ui.usd(totals.walletUsd)}</strong><small>${ui.bs(ui.toBs(totals.walletUsd))}</small></div>
        <div class="stat-strip-item"><span>Wallet VES consolidada</span><strong>${ui.bs(totals.walletVes)}</strong><small>${ui.usd(totals.walletVes / ui.rate())}</small></div>
        <div class="stat-strip-item"><span>Clientes activos</span><strong>${ui.num(db.clients.filter((c) => c.estatus === 'Activo' || c.estatus === 'Corporativo').length, 0)}</strong><small>de ${db.clients.length} registros</small></div>
        <div class="stat-strip-item"><span>Expedientes completos</span><strong>${ui.num(db.clients.filter((c) => docsCount(c) === 2).length, 0)}</strong><small>cédula + RIF cargados</small></div>
      </div>

      <section class="card card-flush">
        <div class="toolbar">
          <div class="search-box">
            ${ui.icon('search', 17)}
            <input id="client-search" type="search" placeholder="Buscar por cédula, RIF, nombre, correo..." value="${ui.esc(filters.q)}">
          </div>
          <div class="toolbar-right">
            <select id="client-status" class="select-inline">
              <option value="">Todos los estatus</option>
              ${store.CLIENT_STATUS.map((s) => `<option ${filters.status === s ? 'selected' : ''}>${s}</option>`).join('')}
            </select>
            <span class="count-chip">${list.length} resultado${list.length === 1 ? '' : 's'}</span>
          </div>
        </div>
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr>
              <th>Cliente</th><th>Cédula / RIF</th><th>Contacto</th><th>Ubicación</th>
              <th class="num">Wallet USD</th><th class="num">Wallet VES</th><th class="num">Servicios</th><th>Docs</th><th>Estatus</th><th class="actions-col">Acciones</th>
            </tr></thead>
            <tbody>
              ${list.length ? list.map((c) => `
                <tr>
                  <td><button class="cell-link cell-user" data-client="${ui.esc(c.cedula_rif)}">
                    ${ui.avatar(c.nombres + ' ' + c.apellidos, 34)}
                    <span><strong>${ui.esc(c.nombres + ' ' + c.apellidos)}</strong><small class="block muted">${ui.esc(c.correo || 'Sin correo')}</small></span>
                  </button></td>
                  <td><span class="mono strong">${ui.esc(c.cedula_rif)}</span><small class="block muted">Desde ${ui.date(c.fecha_registro)}</small></td>
                  <td><span>${ui.esc(c.telefono)}</span><small class="block muted">${ui.esc((c.correo || '').split('@')[1] || '')}</small></td>
                  <td class="wrap-cell"><span class="truncate">${ui.esc(c.direccion)}</span></td>
                  <td class="num"><strong>${ui.usd(c.saldo_wallet_usd)}</strong></td>
                  <td class="num">${ui.bs(c.saldo_wallet_ves)}</td>
                  <td class="num"><span class="twin-count"><b>${c.total_carreras}</b> carreras<small>${c.total_encomiendas} envíos</small></span></td>
                  <td><span class="doc-pills">${c.url_foto_cedula ? `<span class="doc-pill ok" title="Cédula cargada">${ui.icon('check', 11)} C</span>` : `<span class="doc-pill no" title="Cédula pendiente">C</span>`}${c.url_foto_rif ? `<span class="doc-pill ok" title="RIF cargado">${ui.icon('check', 11)} R</span>` : `<span class="doc-pill no" title="RIF pendiente">R</span>`}</span></td>
                  <td>${ui.badge(c.estatus)}</td>
                  <td class="actions-col">
                    <button class="icon-btn" data-client="${ui.esc(c.cedula_rif)}" title="Ver ficha">${ui.icon('eye', 16)}</button>
                    ${canEdit ? `<button class="icon-btn" data-edit-client="${ui.esc(c.cedula_rif)}" title="Editar">${ui.icon('edit', 16)}</button>` : ''}
                    ${canDelete ? `<button class="icon-btn danger" data-del-client="${ui.esc(c.cedula_rif)}" title="Eliminar">${ui.icon('trash', 16)}</button>` : ''}
                  </td>
                </tr>`).join('') : `<tr><td colspan="10">${ui.empty('users', 'No hay clientes que coincidan', 'Prueba con otro término de búsqueda o registra un nuevo cliente.', canCreate ? '<button class="btn btn-primary" id="clients-empty-new">Nuevo cliente</button>' : '')}</td></tr>`}
            </tbody>
          </table>
        </div>
      </section>
    `;

    const rerender = () => {
      filters.q = $('#client-search').value;
      filters.status = $('#client-status').value;
      render(view);
      const input = $('#client-search');
      if (input) { input.focus(); input.setSelectionRange(input.value.length, input.value.length); }
    };
    const search = $('#client-search');
    let t;
    search.addEventListener('input', () => { clearTimeout(t); t = setTimeout(rerender, 180); });
    $('#client-status').addEventListener('change', rerender);
    const newBtn = $('#clients-new');
    if (newBtn) newBtn.addEventListener('click', () => openForm());
    const emptyNew = $('#clients-empty-new');
    if (emptyNew) emptyNew.addEventListener('click', () => openForm());
    const exportBtn = $('#clients-export');
    if (exportBtn) exportBtn.addEventListener('click', exportCsv);
    view.querySelectorAll('[data-client]').forEach((b) => b.addEventListener('click', () => openDetail(b.dataset.client)));
    view.querySelectorAll('[data-edit-client]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); openForm(b.dataset.editClient); }));
    view.querySelectorAll('[data-del-client]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); askDelete(b.dataset.delClient); }));
  }

  function exportCsv() {
    const db = NS.store.db;
    const rows = [['Cédula/RIF', 'Nombres', 'Apellidos', 'Teléfono', 'Correo', 'Dirección', 'Wallet USD', 'Wallet VES', 'Carreras', 'Encomiendas', 'Estatus', 'Registro']];
    db.clients.forEach((c) => rows.push([c.cedula_rif, c.nombres, c.apellidos, c.telefono, c.correo, c.direccion, c.saldo_wallet_usd, c.saldo_wallet_ves, c.total_carreras, c.total_encomiendas, c.estatus, c.fecha_registro]));
    NS.ui.downloadFile('ENVIA_clientes_' + NS.store.today() + '.csv', NS.ui.csv(rows));
    NS.ui.toast('Maestro de clientes exportado a CSV.', 'success');
  }

  function formHtml(c, isNew) {
    const ui = NS.ui;
    return `
      <form id="client-form" class="form-grid" autocomplete="off">
        <div class="form-section-title"><span>01</span><div><strong>Identificación</strong><small>La cédula / RIF es la clave primaria del maestro y no puede duplicarse.</small></div></div>
        <label class="field"><span>Cédula / RIF *</span>
          <input name="cedula_rif" value="${ui.esc(c.cedula_rif || '')}" placeholder="V-12345678" ${isNew ? '' : 'disabled'} data-mask-id required>
          <small>Formatos: V-12345678 · E-12345678 · J-123456789</small>
        </label>
        <label class="field"><span>Estatus</span>
          <select name="estatus">${NS.store.CLIENT_STATUS.map((s) => `<option ${c.estatus === s ? 'selected' : ''}>${s}</option>`).join('')}</select>
        </label>
        <label class="field"><span>Nombres *</span><input name="nombres" value="${ui.esc(c.nombres || '')}" placeholder="Jesús Alberto" required></label>
        <label class="field"><span>Apellidos *</span><input name="apellidos" value="${ui.esc(c.apellidos || '')}" placeholder="Mendoza Quintero" required></label>
        <label class="field"><span>Teléfono móvil *</span><input name="telefono" value="${ui.esc(c.telefono || '')}" placeholder="0414-555-0673" required></label>
        <label class="field"><span>Correo electrónico *</span><input name="correo" type="email" value="${ui.esc(c.correo || '')}" placeholder="cliente@correo.com" required></label>
        <label class="field field-full"><span>Dirección completa *</span><textarea name="direccion" rows="2" placeholder="Calle / avenida, edificio, piso, apartamento, parroquia, municipio y estado" required>${ui.esc(c.direccion || '')}</textarea></label>

        <div class="form-section-title"><span>02</span><div><strong>Billetera y actividad</strong><small>Saldos y contadores históricos del cliente en la plataforma.</small></div></div>
        <label class="field"><span>Saldo Wallet USD</span><input name="saldo_wallet_usd" type="number" step="0.01" min="0" value="${c.saldo_wallet_usd ?? 0}"></label>
        <label class="field"><span>Saldo Wallet VES</span><input name="saldo_wallet_ves" type="number" step="0.01" min="0" value="${c.saldo_wallet_ves ?? 0}"></label>
        <label class="field"><span>Total carreras</span><input name="total_carreras" type="number" min="0" value="${c.total_carreras || 0}"></label>
        <label class="field"><span>Total encomiendas</span><input name="total_encomiendas" type="number" min="0" value="${c.total_encomiendas || 0}"></label>
        <label class="field"><span>Fecha de registro</span><input name="fecha_registro" type="date" value="${c.fecha_registro || NS.store.today()}"></label>
      </form>`;
  }

  function openForm(cedula) {
    const ui = NS.ui;
    if (!NS.app.canAction('clients', cedula ? 'editar' : 'crear')) return ui.toast('No tienes permiso para esta acción en clientes.', 'warning');
    const existing = cedula ? NS.store.db.clients.find((c) => c.cedula_rif === cedula) : null;
    const c = existing || {};
    const overlay = ui.modal({
      title: existing ? 'Editar cliente' : 'Nuevo cliente',
      eyebrow: 'Maestro de clientes',
      subtitle: existing ? 'Actualiza la ficha de ' + c.nombres + ' ' + c.apellidos : 'Registra un nuevo usuario de la app con su cédula / RIF como clave principal.',
      size: 'lg',
      body: formHtml(c, !existing),
      footer: `<button class="btn btn-ghost" data-cancel>Cancelar</button><button class="btn btn-primary" id="client-save">${ui.icon('check', 16)} ${existing ? 'Guardar cambios' : 'Crear cliente'}</button>`
    });
    overlay.querySelector('[data-cancel]').addEventListener('click', () => ui.closeModal(overlay));
    overlay.querySelector('#client-save').addEventListener('click', () => {
      const form = overlay.querySelector('#client-form');
      if (!form.reportValidity()) return;
      const data = {};
      Array.from(form.elements).forEach((el) => { if (el.name) data[el.name] = el.value; });
      const idErr = ui.idError(data.cedula_rif);
      if (idErr) return ui.toast(idErr, 'error');
      if (!ui.validEmail(data.correo)) return ui.toast('El correo electrónico no es válido.', 'error');
      if (!ui.validPhone(data.telefono)) return ui.toast('El teléfono debe tener entre 10 y 13 dígitos.', 'error');
      if (!existing && NS.store.db.clients.some((x) => x.cedula_rif === ui.normalizeId(data.cedula_rif))) return ui.toast('Ya existe un cliente con esa cédula / RIF.', 'error');

      const btn = overlay.querySelector('#client-save');
      ui.setBusy(btn, true, 'Guardando...');
      try {
        NS.store.upsertClient(data);
        ui.closeModal(overlay);
        ui.toast(existing ? 'Cliente actualizado correctamente.' : 'Cliente registrado correctamente.', 'success');
        NS.app.refresh(true);
        if (existing) openDetail(ui.normalizeId(data.cedula_rif));
      } catch (e) {
        ui.setBusy(btn, false);
        ui.toast(e.message, 'error');
      }
    });
  }

  function detailHtml(c) {
    const ui = NS.ui;
    const db = NS.store.db;
    const canEdit = NS.app.canAction('clients', 'editar');
    const canDelete = NS.app.canAction('clients', 'eliminar');
    const canWallet = NS.app.canAction('clients', 'billetera');
    const canDocs = NS.app.canAction('clients', 'documentos');
    const services = db.services.filter((s) => s.cliente_cedula_rif === c.cedula_rif).slice(0, 5);
    const walletTx = (db.walletMovements || []).filter((w) => w.cliente_cedula_rif === c.cedula_rif).slice(0, 4);
    return `
      <div class="profile-head">
        ${ui.avatar(c.nombres + ' ' + c.apellidos, 58)}
        <div class="profile-id">
          <div class="profile-name">${ui.esc(c.nombres + ' ' + c.apellidos)} ${ui.badge(c.estatus)}</div>
          <div class="profile-meta"><span class="mono">${ui.esc(c.cedula_rif)}</span><span>${ui.esc(c.telefono)}</span><span>${ui.esc(c.correo)}</span></div>
        </div>
        <div class="profile-actions">
          ${canEdit ? `<button class="btn btn-ghost btn-sm" id="detail-edit">${ui.icon('edit', 15)} Editar</button>` : ''}
        </div>
      </div>

      <div class="detail-grid">
        <div class="detail-main">
          <div class="detail-block">
            <h4>Datos de contacto y ubicación</h4>
            <div class="info-grid">
              <div class="info-item"><span>${ui.icon('pin', 14)} Dirección</span><strong>${ui.esc(c.direccion)}</strong></div>
              <div class="info-item"><span>${ui.icon('phone', 14)} Teléfono</span><strong>${ui.esc(c.telefono)}</strong></div>
              <div class="info-item"><span>${ui.icon('mail', 14)} Correo</span><strong>${ui.esc(c.correo)}</strong></div>
              <div class="info-item"><span>${ui.icon('calendar', 14)} Cliente desde</span><strong>${ui.dateLong(c.fecha_registro)}</strong></div>
            </div>
          </div>

          <div class="detail-block">
            <h4>Billetera virtual <span class="h4-note">Saldos disponibles</span></h4>
            <div class="wallet-cards">
              <div class="wallet-card wallet-usd"><span>Saldo en dólares</span><strong>${ui.usd(c.saldo_wallet_usd)}</strong><small>${ui.bs(ui.toBs(c.saldo_wallet_usd))} referencial</small></div>
              <div class="wallet-card wallet-ves"><span>Saldo en bolívares</span><strong>${ui.bs(c.saldo_wallet_ves)}</strong><small>${ui.usd(c.saldo_wallet_ves / ui.rate())} referencial</small></div>
            </div>
            ${canWallet ? `<div class="inline-actions"><button class="btn btn-ghost btn-sm" id="wallet-recharge">${ui.icon('plus', 15)} Recargar wallet</button><span class="hint">Genera asiento contable automático en la cuenta de pasivo wallet.</span></div>` : ''}
            ${walletTx.length ? `<div class="mini-list mini-list-tight">${walletTx.map((w) => `<div class="mini-row mini-static"><span class="mini-ico">${ui.icon('wallet', 15)}</span><span class="mini-main"><strong>Recarga ${w.moneda}</strong><small>${ui.date(w.fecha)} · ${ui.esc(w.metodo)}</small></span><span class="mini-amount">+ ${w.moneda === 'USD' ? ui.usd(w.monto) : ui.bs(w.monto)}</span></div>`).join('')}</div>` : ''}
          </div>

          <div class="detail-block">
            <h4>Expediente digital <span class="h4-note">Documentos del cliente</span></h4>
            <div class="doc-grid">
              ${docCard('Cédula de Identidad', 'cedula', c.url_foto_cedula, c.cedula_rif, canDocs)}
              ${docCard('RIF Personal Digital', 'rif', c.url_foto_rif, c.cedula_rif, canDocs)}
            </div>
            <p class="upload-hint">${ui.icon('cloud', 14)} Los archivos se guardan en <strong>Supabase Storage → documentos-clientes/{cédula}</strong> o localmente si aún no hay conexión. Formatos: JPG, PNG, WEBP o PDF (máx. 8 MB).</p>
          </div>
        </div>

        <aside class="detail-side">
          <div class="side-metrics">
            <div class="side-metric"><span>Carreras</span><strong>${ui.num(c.total_carreras, 0)}</strong></div>
            <div class="side-metric"><span>Encomiendas</span><strong>${ui.num(c.total_encomiendas, 0)}</strong></div>
            <div class="side-metric"><span>Servicios</span><strong>${ui.num(c.total_carreras + c.total_encomiendas, 0)}</strong></div>
          </div>
          <div class="detail-block">
            <h4>Servicios recientes</h4>
            ${services.length ? `<div class="mini-list">${services.map((s) => `<div class="mini-row mini-static">
              <span class="mini-ico">${ui.icon(s.tipo === 'carrera' ? 'car' : 'package', 15)}</span>
              <span class="mini-main"><strong>${ui.esc(s.origen)} → ${ui.esc(s.destino)}</strong><small>${ui.date(s.fecha)} · ${ui.esc(s.metodo_pago)}</small></span>
              <span class="mini-amount">${ui.usd(s.total_usd)}</span>
            </div>`).join('')}</div>` : `<p class="muted small">Sin servicios registrados.</p>`}
          </div>
          <div class="detail-block">
            <h4>Acciones</h4>
            <div class="stack-actions">
              <button class="btn btn-ghost btn-block" id="detail-services">${ui.icon('route', 15)} Ver todos los servicios</button>
              ${canDelete ? `<button class="btn btn-danger-ghost btn-block" id="detail-delete">${ui.icon('trash', 15)} Eliminar cliente</button>` : ''}
            </div>
          </div>
          <div class="audit-note">${ui.icon('shield', 14)} Cédula / RIF como identificador maestro único · Registro ${ui.dateTime(c.created_at)}</div>
        </aside>
      </div>`;
  }

  function docCard(label, tipo, ref, cedula, canWrite) {
    const ui = NS.ui;
    const url = NS.supabase.resolve(ref);
    return `<div class="doc-card ${url ? 'has-file' : ''}">
      <div class="doc-thumb" ${url ? `data-preview="${ui.esc(ref)}" data-label="${ui.esc(label)}"` : ''}>
        ${url ? `<img src="${ui.esc(url)}" alt="${ui.esc(label)}">` : `<span>${ui.icon(tipo === 'rif' ? 'file' : 'image', 26)}</span>`}
      </div>
      <div class="doc-body">
        <strong>${label}</strong>
        <span class="${url ? 'text-success' : 'muted'}">${url ? 'Documento cargado' : 'Pendiente de carga'}</span>
        ${canWrite ? `<div class="doc-actions">
          <button class="btn btn-xs ${url ? 'btn-ghost' : 'btn-primary'}" data-upload="${tipo}">${ui.icon('upload', 13)} ${url ? 'Reemplazar' : 'Subir archivo'}</button>
          ${url ? `<button class="btn btn-xs btn-danger-ghost" data-remove-doc="${tipo}">${ui.icon('trash', 12)}</button>` : ''}
        </div>` : ''}
      </div>
      <input type="file" accept="image/*,.pdf,application/pdf" class="hidden-file" data-file-input="${tipo}">
    </div>`;
  }

  function openDetail(cedula) {
    const ui = NS.ui;
    const c = NS.store.db.clients.find((x) => x.cedula_rif === cedula);
    if (!c) return ui.toast('Cliente no encontrado.', 'error');
    const overlay = ui.modal({
      title: 'Ficha del cliente',
      eyebrow: 'Expediente digital · ' + c.cedula_rif,
      size: 'xl',
      body: detailHtml(c),
      footer: `<button class="btn btn-primary" data-close-detail>Cerrar ficha</button>`
    });

    overlay.querySelector('[data-close-detail]').addEventListener('click', () => ui.closeModal(overlay));

    const edit = overlay.querySelector('#detail-edit');
    if (edit) edit.addEventListener('click', () => { ui.closeModal(overlay); openForm(cedula); });
    const del = overlay.querySelector('#detail-delete');
    if (del) del.addEventListener('click', () => { ui.closeModal(overlay); askDelete(cedula); });
    const svc = overlay.querySelector('#detail-services');
    if (svc) svc.addEventListener('click', () => { ui.closeModal(overlay); location.hash = '#/services'; });

    const recharge = overlay.querySelector('#wallet-recharge');
    if (recharge) recharge.addEventListener('click', () => { ui.closeModal(overlay); openRecharge(cedula); });

    overlay.querySelectorAll('[data-upload]').forEach((btn) => btn.addEventListener('click', () => {
      const input = overlay.querySelector(`[data-file-input="${btn.dataset.upload}"]`);
      if (input) input.click();
    }));
    overlay.querySelectorAll('[data-file-input]').forEach((input) => input.addEventListener('change', async () => {
      const file = input.files && input.files[0];
      if (!file) return;
      const tipo = input.dataset.fileInput;
      const tipoDoc = tipo === 'cedula' ? 'foto_cedula' : 'foto_rif';
      const btn = overlay.querySelector(`[data-upload="${tipo}"]`);
      if (btn) ui.setBusy(btn, true, 'Subiendo...');
      try {
        const res = await NS.supabase.uploadDocument('documentos-clientes', cedula, tipoDoc, file);
        const client = NS.store.db.clients.find((x) => x.cedula_rif === cedula);
        if (tipo === 'cedula') client.url_foto_cedula = res.ref;
        else client.url_foto_rif = res.ref;
        NS.store.save();
        ui.toast(res.fallback ? 'Documento guardado localmente (fallback). Se sincronizará cuando conectes Supabase.' : 'Documento subido a Supabase Storage.', res.fallback ? 'warning' : 'success');
        ui.closeModal(overlay);
        openDetail(cedula);
        NS.app.refresh(true);
      } catch (e) {
        if (btn) ui.setBusy(btn, false);
        ui.toast(e.message, 'error');
      }
    }));

    overlay.querySelectorAll('[data-remove-doc]').forEach((btn) => btn.addEventListener('click', async () => {
      const tipo = btn.dataset.removeDoc;
      const ok = await ui.confirm({ title: 'Eliminar documento', message: 'Se eliminará el archivo del expediente digital. Esta acción no afecta los datos contables.', confirmText: 'Eliminar', danger: true });
      if (!ok) return;
      const client = NS.store.db.clients.find((x) => x.cedula_rif === cedula);
      const ref = tipo === 'cedula' ? client.url_foto_cedula : client.url_foto_rif;
      try {
        if (ref) await NS.supabase.deleteDocument(ref);
        if (tipo === 'cedula') client.url_foto_cedula = '';
        else client.url_foto_rif = '';
        NS.store.save();
        ui.closeModal(overlay);
        openDetail(cedula);
        NS.app.refresh(true);
        ui.toast('Documento eliminado.', 'success');
      } catch (e) { ui.toast(e.message, 'error'); }
    }));
  }

  function openPreview(url, label) {
    const ui = NS.ui;
    const isPdf = /^data:application\/pdf/i.test(url);
    ui.modal({
      title: label || 'Documento',
      size: 'lg',
      body: isPdf ? `<iframe src="${ui.esc(url)}" class="doc-frame"></iframe>` : `<div class="doc-viewer"><img src="${ui.esc(url)}" alt="${ui.esc(label)}"></div>`,
      footer: `<button class="btn btn-primary" data-close-modal>Cerrar</button>`
    });
  }

  function openRecharge(cedula) {
    const ui = NS.ui;
    if (!NS.app.canAction('clients', 'billetera')) return ui.toast('No tienes permiso para recargar billeteras.', 'warning');
    const c = NS.store.db.clients.find((x) => x.cedula_rif === cedula);
    if (!c) return;
    const overlay = ui.modal({
      title: 'Recargar wallet',
      eyebrow: c.cedula_rif,
      subtitle: c.nombres + ' ' + c.apellidos,
      size: 'sm',
      body: `<form id="recharge-form" class="form-grid">
        <label class="field"><span>Moneda *</span><select name="moneda"><option value="USD">USD · Dólares</option><option value="VES">VES · Bolívares</option></select></label>
        <label class="field"><span>Monto *</span><input name="monto" type="number" min="0.01" step="0.01" placeholder="0,00" required></label>
        <label class="field"><span>Método de pago</span><select name="metodo">${NS.store.PAYMENT_METHODS.map((m) => `<option>${m}</option>`).join('')}</select></label>
        <label class="field"><span>Referencia</span><input name="referencia" placeholder="N° de referencia / aprobación"></label>
        <label class="field field-full"><span>Fecha</span><input name="fecha" type="date" value="${NS.store.today()}"></label>
        <p class="form-note">${ui.icon('info', 14)} La recarga genera automáticamente el asiento: <strong>DEBE</strong> banco / caja · <strong>HABER</strong> pasivo wallet. No representa un ingreso.</p>
      </form>`,
      footer: `<button class="btn btn-ghost" data-cancel>Cancelar</button><button class="btn btn-primary" id="recharge-save">${ui.icon('check', 15)} Registrar recarga</button>`
    });
    overlay.querySelector('[data-cancel]').addEventListener('click', () => ui.closeModal(overlay));
    overlay.querySelector('#recharge-save').addEventListener('click', () => {
      const form = overlay.querySelector('#recharge-form');
      if (!form.reportValidity()) return;
      try {
        NS.store.addWalletRecharge(cedula, {
          moneda: form.elements.moneda.value,
          monto: form.elements.monto.value,
          metodo: form.elements.metodo.value,
          referencia: form.elements.referencia.value,
          fecha: form.elements.fecha.value
        });
        ui.closeModal(overlay);
        ui.toast('Recarga registrada y asiento contable generado.', 'success');
        NS.app.refresh(true);
      } catch (e) { ui.toast(e.message, 'error'); }
    });
  }

  function askDelete(cedula) {
    const ui = NS.ui;
    const c = NS.store.db.clients.find((x) => x.cedula_rif === cedula);
    ui.confirm({
      title: 'Eliminar cliente',
      message: `¿Seguro que deseas eliminar a ${c ? c.nombres + ' ' + c.apellidos : cedula} (${cedula})? Solo es posible si no tiene servicios asociados.`,
      confirmText: 'Eliminar',
      danger: true
    }).then((ok) => {
      if (!ok) return;
      try {
        NS.store.deleteClient(cedula);
        ui.toast('Cliente eliminado.', 'success');
        NS.app.refresh(true);
      } catch (e) { ui.toast(e.message, 'error'); }
    });
  }

  NS.modules.clients = { render, openForm, openDetail };
})();
