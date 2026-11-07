/* =========================================================================
   ENVIA ERP · modules/partners.js
   Negocios asociados: comercios aliados que generan pedidos de delivery.
   Cartera por cobrar (comisiones) y por pagar (recaudaciones en efectivo).
   ========================================================================= */
(function () {
  'use strict';
  const NS = (window.ENVIA = window.ENVIA || {});
  NS.modules = NS.modules || {};

  const $ = (s, r) => NS.ui.$(s, r);
  let filters = { q: '', status: '', type: '' };

  function render(view) {
    const ui = NS.ui;
    const db = NS.store.db;
    const canCreate = NS.app.canAction('partners', 'crear');
    const canEdit = NS.app.canAction('partners', 'editar');
    const canDelete = NS.app.canAction('partners', 'eliminar');
    const canMove = NS.app.canAction('partners', 'movimientos');
    const canExport = NS.app.canAction('partners', 'exportar');
    const q = filters.q.toLowerCase();
    const list = db.partners.filter((p) => {
      const hay = [p.rif, p.razon_social, p.tipo, p.contacto, p.telefono, p.correo].join(' ').toLowerCase();
      return (!q || hay.includes(q)) && (!filters.status || p.estatus === filters.status) && (!filters.type || p.tipo === filters.type);
    });
    const totalCobrar = db.partners.reduce((s, p) => s + Number(p.saldo_por_cobrar_usd || 0), 0);
    const totalPagar = db.partners.reduce((s, p) => s + Number(p.saldo_por_pagar_usd || 0), 0);

    view.innerHTML = `
      <div class="page-head">
        <div>
          <span class="eyebrow">Comercios aliados · convenios de delivery</span>
          <h2 class="page-title">Negocios asociados</h2>
          <p class="page-sub">${db.partners.length} negocios · ${db.partners.filter((p) => p.estatus === 'Activo').length} activos · comisiones por cobrar ${ui.usd(totalCobrar)} · recaudaciones por pagar ${ui.usd(totalPagar)}.</p>
        </div>
        <div class="page-actions">
          ${NS.reports.button('partners')}
          ${canExport ? `<button class="btn btn-ghost" id="partners-export">${ui.icon('download', 16)} Exportar CSV</button>` : ''}
          ${canCreate ? `<button class="btn btn-primary" id="partners-new">${ui.icon('plus', 16)} Nuevo negocio</button>` : ''}
        </div>
      </div>

      <div class="stat-strip">
        <div class="stat-strip-item"><span>Negocios activos</span><strong>${ui.num(db.partners.filter((p) => p.estatus === 'Activo').length, 0)}</strong><small>de ${db.partners.length} registrados</small></div>
        <div class="stat-strip-item"><span>Por cobrar (comisiones)</span><strong>${ui.usd(totalCobrar)}</strong><small>${ui.bs(ui.toBs(totalCobrar))}</small></div>
        <div class="stat-strip-item"><span>Por pagar (recaudación)</span><strong>${ui.usd(totalPagar)}</strong><small>${ui.bs(ui.toBs(totalPagar))}</small></div>
        <div class="stat-strip-item"><span>Comisión promedio</span><strong>${ui.pct(db.partners.length ? db.partners.reduce((s, p) => s + Number(p.comision_pct || 0), 0) / db.partners.length : 0)}</strong><small>negociada por pedido</small></div>
      </div>

      <section class="card card-flush">
        <div class="toolbar">
          <div class="search-box">${ui.icon('search', 17)}<input id="partner-search" type="search" placeholder="Buscar por RIF, razón social, contacto..." value="${ui.esc(filters.q)}"></div>
          <div class="toolbar-right">
            <select id="partner-type" class="select-inline">
              <option value="">Todos los tipos</option>
              ${NS.store.PARTNER_TYPES.map((t) => `<option ${filters.type === t ? 'selected' : ''}>${t}</option>`).join('')}
            </select>
            <select id="partner-status" class="select-inline">
              <option value="">Todos los estatus</option>
              <option ${filters.status === 'Activo' ? 'selected' : ''}>Activo</option>
              <option ${filters.status === 'Inactivo' ? 'selected' : ''}>Inactivo</option>
            </select>
            <span class="count-chip">${list.length} resultado${list.length === 1 ? '' : 's'}</span>
          </div>
        </div>
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr>
              <th>Negocio</th><th>RIF</th><th>Tipo</th><th>Contacto</th><th class="num">Comisión</th>
              <th class="num">Por cobrar</th><th class="num">Por pagar</th><th>Estatus</th><th class="actions-col">Acciones</th>
            </tr></thead>
            <tbody>
              ${list.length ? list.map((p) => `<tr>
                <td><button class="cell-link cell-user" data-partner="${ui.esc(p.rif)}">
                  ${ui.avatar(p.razon_social, 34)}
                  <span><strong>${ui.esc(p.razon_social)}</strong><small class="block muted">${ui.esc(p.correo || 'Sin correo')}</small></span>
                </button></td>
                <td><span class="mono strong">${ui.esc(p.rif)}</span></td>
                <td>${ui.badge(p.tipo, 'info')}</td>
                <td><span>${ui.esc(p.contacto || '—')}</span><small class="block muted">${ui.esc(p.telefono || '—')}</small></td>
                <td class="num"><strong>${p.comision_pct}%</strong></td>
                <td class="num"><strong class="${p.saldo_por_cobrar_usd > 0 ? 'text-orange' : ''}">${ui.usd(p.saldo_por_cobrar_usd)}</strong></td>
                <td class="num"><strong class="${p.saldo_por_pagar_usd > 0 ? 'text-orange' : ''}">${ui.usd(p.saldo_por_pagar_usd)}</strong></td>
                <td>${ui.badge(p.estatus)}</td>
                <td class="actions-col">
                  <button class="icon-btn" data-partner="${ui.esc(p.rif)}" title="Ver cartera">${ui.icon('eye', 16)}</button>
                  ${canMove ? `<button class="icon-btn" data-move-partner="${ui.esc(p.rif)}" title="Registrar movimiento">${ui.icon('wallet', 16)}</button>` : ''}
                  ${canEdit ? `<button class="icon-btn" data-edit-partner="${ui.esc(p.rif)}" title="Editar">${ui.icon('edit', 16)}</button>` : ''}
                  ${canDelete ? `<button class="icon-btn danger" data-del-partner="${ui.esc(p.rif)}" title="Eliminar">${ui.icon('trash', 16)}</button>` : ''}
                </td>
              </tr>`).join('') : `<tr><td colspan="9">${ui.empty('building', 'Sin negocios asociados', 'Registra el primer comercio aliado para gestionar comisiones y recaudaciones.', canCreate ? '<button class="btn btn-primary" id="partners-empty-new">Nuevo negocio</button>' : '')}</td></tr>`}
            </tbody>
          </table>
        </div>
      </section>
      <p class="form-note" style="margin-top:14px">${ui.icon('info', 14)} Las comisiones generan una cuenta por cobrar al negocio (1.1.2.03). Las recaudaciones en efectivo que pertenecen al negocio generan una cuenta por pagar (2.1.1.03). Ambos movimientos se reflejan en la contabilidad.</p>
    `;

    const rerender = () => {
      filters.q = $('#partner-search').value;
      filters.status = $('#partner-status').value;
      filters.type = $('#partner-type').value;
      render(view);
      const input = $('#partner-search');
      if (input) { input.focus(); input.setSelectionRange(input.value.length, input.value.length); }
    };
    let t;
    $('#partner-search').addEventListener('input', () => { clearTimeout(t); t = setTimeout(rerender, 180); });
    $('#partner-status').addEventListener('change', rerender);
    $('#partner-type').addEventListener('change', rerender);
    const newBtn = $('#partners-new');
    if (newBtn) newBtn.addEventListener('click', () => openForm());
    const emptyNew = $('#partners-empty-new');
    if (emptyNew) emptyNew.addEventListener('click', () => openForm());
    const exportBtn = $('#partners-export');
    if (exportBtn) exportBtn.addEventListener('click', exportCsv);
    view.querySelectorAll('[data-partner]').forEach((b) => b.addEventListener('click', () => openDetail(b.dataset.partner)));
    view.querySelectorAll('[data-move-partner]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); openMovement(b.dataset.movePartner); }));
    view.querySelectorAll('[data-edit-partner]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); openForm(b.dataset.editPartner); }));
    view.querySelectorAll('[data-del-partner]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); askDelete(b.dataset.delPartner); }));
  }

  function formHtml(p) {
    const ui = NS.ui;
    return `<form id="partner-form" class="form-grid" autocomplete="off">
      <label class="field"><span>RIF *</span><input name="rif" value="${ui.esc(p.rif || '')}" placeholder="J-401112223" ${p.rif ? 'disabled' : ''} required></label>
      <label class="field"><span>Tipo de negocio *</span><select name="tipo">${NS.store.PARTNER_TYPES.map((t) => `<option ${p.tipo === t ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
      <label class="field field-full"><span>Razón social *</span><input name="razon_social" value="${ui.esc(p.razon_social || '')}" placeholder="Panadería La Espiga C.A." required></label>
      <label class="field"><span>Persona de contacto</span><input name="contacto" value="${ui.esc(p.contacto || '')}" placeholder="María Pérez"></label>
      <label class="field"><span>Teléfono *</span><input name="telefono" value="${ui.esc(p.telefono || '')}" placeholder="0212-555-7788" required></label>
      <label class="field"><span>Correo electrónico</span><input name="correo" type="email" value="${ui.esc(p.correo || '')}" placeholder="pedidos@negocio.com"></label>
      <label class="field"><span>% Comisión ENVIA *</span><input name="comision_pct" type="number" min="0" max="100" step="0.5" value="${p.comision_pct ?? 10}" required></label>
      <label class="field field-full"><span>Dirección *</span><textarea name="direccion" rows="2" required>${ui.esc(p.direccion || '')}</textarea></label>
      <label class="field"><span>Estatus</span><select name="estatus"><option ${p.estatus !== 'Inactivo' ? 'selected' : ''}>Activo</option><option ${p.estatus === 'Inactivo' ? 'selected' : ''}>Inactivo</option></select></label>
      <label class="field field-full"><span>Notas del convenio</span><textarea name="notas" rows="2" placeholder="Condiciones, horarios, tipo de pedidos...">${ui.esc(p.notas || '')}</textarea></label>
    </form>`;
  }

  function openForm(rif) {
    const ui = NS.ui;
    if (!NS.app.canAction('partners', rif ? 'editar' : 'crear')) return ui.toast('No tienes permiso para esta acción en negocios asociados.', 'warning');
    const p = rif ? NS.store.db.partners.find((x) => x.rif === rif) : null;
    const data = p || {};
    const overlay = ui.modal({
      title: p ? 'Editar negocio asociado' : 'Nuevo negocio asociado',
      eyebrow: 'Comercios aliados',
      subtitle: p ? data.razon_social : 'Registra el comercio, su contacto y la comisión negociada.',
      size: 'lg',
      body: formHtml(data),
      footer: `<button class="btn btn-ghost" data-cancel>Cancelar</button><button class="btn btn-primary" id="partner-save">${ui.icon('check', 16)} ${p ? 'Guardar cambios' : 'Crear negocio'}</button>`
    });
    overlay.querySelector('[data-cancel]').addEventListener('click', () => ui.closeModal(overlay));
    overlay.querySelector('#partner-save').addEventListener('click', () => {
      const form = overlay.querySelector('#partner-form');
      if (!form.reportValidity()) return;
      const payload = {};
      Array.from(form.elements).forEach((el) => { if (el.name) payload[el.name] = el.value; });
      if (p) payload.rif = p.rif;
      try {
        NS.store.upsertPartner(payload);
        ui.closeModal(overlay);
        ui.toast(p ? 'Negocio actualizado.' : 'Negocio registrado.', 'success');
        NS.app.refresh(true);
        if (p) openDetail(p.rif);
      } catch (e) { ui.toast(e.message, 'error'); }
    });
  }

  function openDetail(rif) {
    const ui = NS.ui;
    const p = NS.store.db.partners.find((x) => x.rif === rif);
    if (!p) return ui.toast('Negocio no encontrado.', 'error');
    const movs = NS.store.partnerMovements(rif);
    const canMove = NS.app.canAction('partners', 'movimientos');
    const overlay = ui.modal({
      title: p.razon_social,
      eyebrow: 'Negocio asociado · ' + p.rif,
      subtitle: p.tipo + ' · ' + p.estatus,
      size: 'lg',
      body: `
        <div class="detail-grid">
          <div class="detail-main">
            <div class="detail-block">
              <h4>Datos del convenio</h4>
              <div class="info-grid">
                <div class="info-item"><span>Contacto</span><strong>${ui.esc(p.contacto || '—')}</strong></div>
                <div class="info-item"><span>Teléfono</span><strong>${ui.esc(p.telefono || '—')}</strong></div>
                <div class="info-item"><span>Correo</span><strong>${ui.esc(p.correo || '—')}</strong></div>
                <div class="info-item"><span>Comisión</span><strong>${p.comision_pct}% por pedido</strong></div>
                <div class="info-item"><span>Dirección</span><strong>${ui.esc(p.direccion || '—')}</strong></div>
                <div class="info-item"><span>Estatus</span><strong>${ui.badge(p.estatus)}</strong></div>
              </div>
              ${p.notas ? `<p class="form-note" style="margin-top:10px">${ui.icon('info', 14)} ${ui.esc(p.notas)}</p>` : ''}
            </div>
            <div class="detail-block">
              <h4>Movimientos de cartera <span class="h4-note">${movs.length} registros</span></h4>
              ${movs.length ? `<div class="table-wrap"><table class="data-table data-table-compact">
                <thead><tr><th>Fecha</th><th>Concepto</th><th>Tipo</th><th class="num">Monto</th></tr></thead>
                <tbody>${movs.map((m) => `<tr>
                  <td>${ui.date(m.fecha)}</td>
                  <td>${ui.esc(m.concepto)}<small class="block muted">${ui.esc(m.referencia || '')}</small></td>
                  <td>${ui.badge((NS.store.PARTNER_MOVEMENT_TYPES[m.tipo] || {}).label || m.tipo, 'info')}</td>
                  <td class="num"><strong>${ui.usd(m.monto_usd)}</strong></td>
                </tr>`).join('')}</tbody>
              </table></div>` : `<p class="muted small">Sin movimientos registrados.</p>`}
            </div>
          </div>
          <aside class="detail-side">
            <div class="settlement-card">
              <span>Por cobrar (comisiones)</span>
              <strong>${ui.usd(p.saldo_por_cobrar_usd)}</strong>
              <small>${ui.bs(ui.toBs(p.saldo_por_cobrar_usd))}</small>
            </div>
            <div class="settlement-card">
              <span>Por pagar (recaudación)</span>
              <strong>${ui.usd(p.saldo_por_pagar_usd)}</strong>
              <small>${ui.bs(ui.toBs(p.saldo_por_pagar_usd))}</small>
            </div>
            ${canMove ? `<div class="stack-actions">
              <button class="btn btn-primary btn-block btn-sm" data-move="comision">${ui.icon('plus', 14)} Comisión por cobrar</button>
              <button class="btn btn-ghost btn-block btn-sm" data-move="cobro">${ui.icon('bank', 14)} Cobro recibido</button>
              <button class="btn btn-ghost btn-block btn-sm" data-move="recaudacion">${ui.icon('wallet', 14)} Recaudación por pagar</button>
              <button class="btn btn-ghost btn-block btn-sm" data-move="pago">${ui.icon('check', 14)} Pago al negocio</button>
            </div>` : ''}
          </aside>
        </div>`,
      footer: `<button class="btn btn-primary" data-close-partner>Cerrar</button>`
    });
    overlay.querySelector('[data-close-partner]').addEventListener('click', () => ui.closeModal(overlay));
    overlay.querySelectorAll('[data-move]').forEach((b) => b.addEventListener('click', () => {
      ui.closeModal(overlay);
      openMovement(rif, b.dataset.move);
    }));
  }

  function openMovement(rif, tipo) {
    const ui = NS.ui;
    if (!NS.app.canAction('partners', 'movimientos')) return ui.toast('No tienes permiso para registrar movimientos.', 'warning');
    const p = NS.store.db.partners.find((x) => x.rif === rif);
    if (!p) return;
    const labels = NS.store.PARTNER_MOVEMENT_TYPES;
    const selected = tipo || 'comision';
    const overlay = ui.modal({
      title: 'Registrar movimiento de cartera',
      eyebrow: p.razon_social + ' · ' + p.rif,
      subtitle: 'Por cobrar ' + ui.usd(p.saldo_por_cobrar_usd) + ' · Por pagar ' + ui.usd(p.saldo_por_pagar_usd),
      size: 'sm',
      body: `<form id="partner-move-form" class="form-grid">
        <label class="field field-full"><span>Tipo de movimiento *</span><select name="tipo">${Object.keys(labels).filter((k) => k !== 'ajuste').map((k) => `<option value="${k}" ${k === selected ? 'selected' : ''}>${labels[k].label}</option>`).join('')}</select></label>
        <label class="field"><span>Monto (USD) *</span><input name="monto_usd" type="number" min="0.01" step="0.01" required></label>
        <label class="field"><span>Fecha</span><input name="fecha" type="date" value="${NS.store.today()}"></label>
        <label class="field field-full"><span>Concepto *</span><input name="concepto" placeholder="Comisión de pedidos de la semana" required></label>
        <label class="field field-full"><span>Referencia</span><input name="referencia" placeholder="N° de lote, factura o transferencia"></label>
      </form>`,
      footer: `<button class="btn btn-ghost" data-cancel>Cancelar</button><button class="btn btn-primary" id="partner-move-save">${ui.icon('check', 15)} Registrar</button>`
    });
    overlay.querySelector('[data-cancel]').addEventListener('click', () => ui.closeModal(overlay));
    overlay.querySelector('#partner-move-save').addEventListener('click', () => {
      const form = overlay.querySelector('#partner-move-form');
      if (!form.reportValidity()) return;
      try {
        NS.store.addPartnerMovement(rif, {
          tipo: form.elements.tipo.value,
          monto_usd: form.elements.monto_usd.value,
          fecha: form.elements.fecha.value,
          concepto: form.elements.concepto.value,
          referencia: form.elements.referencia.value
        });
        ui.closeModal(overlay);
        ui.toast('Movimiento registrado y asiento contable generado.', 'success');
        NS.app.refresh(true);
        openDetail(rif);
      } catch (e) { ui.toast(e.message, 'error'); }
    });
  }

  function askDelete(rif) {
    const ui = NS.ui;
    const p = NS.store.db.partners.find((x) => x.rif === rif);
    if (!p) return;
    const movCount = NS.store.db.partnerMovements.filter((m) => m.partner_rif === rif).length;
    const tieneMovimientos = movCount > 0;
    ui.confirm({
      title: tieneMovimientos ? 'Inactivar negocio asociado' : 'Eliminar negocio asociado',
      message: tieneMovimientos
        ? `No se puede eliminar a ${p.razon_social} (${rif}) porque tiene ${movCount} movimiento(s) de cartera registrada(s). Se inactivará en su lugar.`
        : `¿Eliminar a ${p.razon_social} (${rif})? No tiene movimientos registrados.`,
      confirmText: tieneMovimientos ? 'Inactivar' : 'Eliminar', danger: true
    }).then((ok) => {
      if (!ok) return;
      try {
        if (tieneMovimientos) {
          NS.store.upsertPartner({ ...p, estatus: 'Inactivo' });
          ui.toast('Negocio inactivado. No se eliminó porque tiene movimientos de cartera.', 'info');
        } else {
          NS.store.deletePartner(rif);
          ui.toast('Negocio eliminado.', 'success');
        }
        NS.app.refresh(true);
      } catch (e) { ui.toast(e.message, 'error'); }
    });
  }

  function exportCsv() {
    const rows = [['RIF', 'Razón social', 'Tipo', 'Contacto', 'Teléfono', 'Correo', 'Comisión %', 'Por cobrar USD', 'Por pagar USD', 'Estatus', 'Notas']];
    NS.store.db.partners.forEach((p) => rows.push([p.rif, p.razon_social, p.tipo, p.contacto, p.telefono, p.correo, p.comision_pct, p.saldo_por_cobrar_usd, p.saldo_por_pagar_usd, p.estatus, p.notas]));
    NS.ui.downloadFile('ENVIA_negocios_asociados_' + NS.store.today() + '.csv', NS.ui.csv(rows));
    NS.ui.toast('Negocios asociados exportados a CSV.', 'success');
  }

  NS.modules.partners = { render, openForm, openDetail, openMovement };
})();
