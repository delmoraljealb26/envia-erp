/* =========================================================================
   ENVIA ERP · modules/drivers.js
   Maestro de Conductores y Flota + expediente documental + liquidaciones.
   ========================================================================= */
(function () {
  'use strict';
  const NS = (window.ENVIA = window.ENVIA || {});
  NS.modules = NS.modules || {};

  let filters = { q: '', status: '', type: '' };

  const DOCS = [
    { key: 'cedula', label: 'Cédula de Identidad', field: 'url_foto_cedula', tipo: 'foto_cedula' },
    { key: 'rif', label: 'RIF Personal', field: 'url_foto_rif', tipo: 'foto_rif' },
    { key: 'licencia', label: 'Licencia de Conducir', field: 'url_foto_licencia', tipo: 'licencia_conducir' },
    { key: 'circulacion', label: 'Carnet de Circulación', field: 'url_carnet_circulacion', tipo: 'carnet_circulacion' }
  ];

  function docsInfo(d) {
    const st = d.docs_estado || {};
    const approved = DOCS.filter((x) => st[x.key] === 'Aprobado').length + (st.vehiculo === 'Aprobado' ? 1 : 0);
    const rejected = DOCS.filter((x) => st[x.key] === 'Rechazado').length + (st.vehiculo === 'Rechazado' ? 1 : 0);
    return { approved, rejected, total: 5, complete: approved === 5, pending: 5 - approved - rejected };
  }

  function render(view) {
    const ui = NS.ui;
    const store = NS.store;
    const db = store.db;
    const canWrite = NS.app.canWrite();
    const q = filters.q.toLowerCase();
    const list = db.drivers.filter((d) => {
      const hay = [d.cedula_rif, d.nombres, d.apellidos, d.placa, d.marca, d.modelo, d.telefono, d.correo, d.tipo_servicio].join(' ').toLowerCase();
      return (!q || hay.includes(q)) && (!filters.status || d.estatus_conductor === filters.status) && (!filters.type || d.tipo_servicio === filters.type);
    });

    const totals = {
      liquidar: db.drivers.reduce((s, d) => s + Number(d.saldo_por_liquidar_usd || 0), 0),
      inService: db.drivers.filter((d) => d.estatus_conductor === 'En Servicio').length,
      incomplete: db.drivers.filter((d) => !docsInfo(d).complete).length
    };

    view.innerHTML = `
      <div class="page-head">
        <div>
          <span class="eyebrow">Maestro de conductores y flota · PK cédula / RIF</span>
          <h2 class="page-title">Aliados operativos y vehículos</h2>
          <p class="page-sub">${db.drivers.length} conductores · ${totals.inService} en servicio · ${totals.incomplete} con expediente incompleto · ${ui.usd(totals.liquidar)} por liquidar.</p>
        </div>
        <div class="page-actions">
          <button class="btn btn-ghost" id="drivers-export">${ui.icon('download', 16)} Exportar CSV</button>
          ${canWrite ? `<button class="btn btn-primary" id="drivers-new">${ui.icon('plus', 16)} Nuevo conductor</button>` : ''}
        </div>
      </div>

      <div class="stat-strip">
        <div class="stat-strip-item"><span>Saldo por liquidar</span><strong>${ui.usd(totals.liquidar)}</strong><small>${ui.bs(ui.toBs(totals.liquidar))}</small></div>
        <div class="stat-strip-item"><span>Conductores activos</span><strong>${ui.num(db.drivers.filter((d) => d.estatus_conductor === 'Activo / Disponible' || d.estatus_conductor === 'En Servicio').length, 0)}</strong><small>${totals.inService} actualmente en servicio</small></div>
        <div class="stat-strip-item"><span>Expedientes completos</span><strong>${ui.num(db.drivers.filter((d) => docsInfo(d).complete).length, 0)}</strong><small>5 documentos aprobados</small></div>
        <div class="stat-strip-item"><span>Flota registrada</span><strong>${ui.num(db.drivers.length, 0)}</strong><small>${db.drivers.filter((d) => d.tipo_servicio === 'Moto Delivery' || d.tipo_servicio === 'Moto Taxi').length} motos · ${db.drivers.filter((d) => d.tipo_servicio === 'Vehículo Sedán' || d.tipo_servicio === 'Camioneta Carga').length} vehículos</small></div>
      </div>

      <section class="card card-flush">
        <div class="toolbar">
          <div class="search-box">${ui.icon('search', 17)}<input id="driver-search" type="search" placeholder="Buscar por cédula, placa, nombre, teléfono..." value="${ui.esc(filters.q)}"></div>
          <div class="toolbar-right">
            <select id="driver-type" class="select-inline">
              <option value="">Todos los servicios</option>
              ${store.VEHICLE_TYPES.map((t) => `<option ${filters.type === t ? 'selected' : ''}>${t}</option>`).join('')}
            </select>
            <select id="driver-status" class="select-inline">
              <option value="">Todos los estatus</option>
              ${store.DRIVER_STATUS.map((s) => `<option ${filters.status === s ? 'selected' : ''}>${s}</option>`).join('')}
            </select>
            <span class="count-chip">${list.length} resultado${list.length === 1 ? '' : 's'}</span>
          </div>
        </div>
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr>
              <th>Conductor</th><th>Cédula / RIF</th><th>Vehículo</th><th>Contacto</th>
              <th class="num">Comisión</th><th class="num">Por liquidar</th><th>Expediente</th><th>Estatus</th><th class="actions-col">Acciones</th>
            </tr></thead>
            <tbody>
              ${list.length ? list.map((d) => {
                const info = docsInfo(d);
                return `<tr>
                  <td><button class="cell-link cell-user" data-driver="${ui.esc(d.cedula_rif)}">
                    ${ui.avatar(d.nombres + ' ' + d.apellidos, 34)}
                    <span><strong>${ui.esc(d.nombres + ' ' + d.apellidos)}</strong><small class="block muted">${ui.esc(d.correo || 'Sin correo')}</small></span>
                  </button></td>
                  <td><span class="mono strong">${ui.esc(d.cedula_rif)}</span><small class="block muted">${ui.esc(d.banco || '—')}</small></td>
                  <td><span class="vehicle-cell"><b>${ui.esc(d.marca)} ${ui.esc(d.modelo)}</b><em>${ui.esc(d.placa)}</em></span><small class="block muted">${ui.esc(d.tipo_servicio)} · ${d.anio} · ${ui.esc(d.color)}</small></td>
                  <td><span>${ui.esc(d.telefono)}</span><small class="block muted">Pago móvil ${ui.esc(d.telefono_pago_movil || '—')}</small></td>
                  <td class="num"><strong>${d.porcentaje_comision}%</strong><small class="block muted">ENVIA</small></td>
                  <td class="num"><strong class="${d.saldo_por_liquidar_usd > 0 ? 'text-orange' : ''}">${ui.usd(d.saldo_por_liquidar_usd)}</strong><small class="block muted">${ui.bs(ui.toBs(d.saldo_por_liquidar_usd))}</small></td>
                  <td><div class="doc-progress"><span class="doc-progress-bar"><b style="width:${(info.approved / info.total) * 100}%"></b></span><small>${info.approved}/5 aprobados</small></div></td>
                  <td>${ui.badge(d.estatus_conductor)}</td>
                  <td class="actions-col">
                    <button class="icon-btn" data-driver="${ui.esc(d.cedula_rif)}" title="Ver expediente">${ui.icon('eye', 16)}</button>
                    ${canWrite ? `<button class="icon-btn" data-edit-driver="${ui.esc(d.cedula_rif)}" title="Editar">${ui.icon('edit', 16)}</button>` : ''}
                    ${canWrite ? `<button class="icon-btn danger" data-del-driver="${ui.esc(d.cedula_rif)}" title="Eliminar">${ui.icon('trash', 16)}</button>` : ''}
                  </td>
                </tr>`;
              }).join('') : `<tr><td colspan="9">${ui.empty('car', 'No hay conductores que coincidan', 'Ajusta los filtros o registra un nuevo aliado operativo.', canWrite ? '<button class="btn btn-primary" id="drivers-empty-new">Nuevo conductor</button>' : '')}</td></tr>`}
            </tbody>
          </table>
        </div>
      </section>
    `;

    const rerender = () => {
      filters.q = $('#driver-search').value;
      filters.status = $('#driver-status').value;
      filters.type = $('#driver-type').value;
      render(view);
      const input = $('#driver-search');
      if (input) { input.focus(); input.setSelectionRange(input.value.length, input.value.length); }
    };
    let t;
    $('#driver-search').addEventListener('input', () => { clearTimeout(t); t = setTimeout(rerender, 180); });
    $('#driver-status').addEventListener('change', rerender);
    $('#driver-type').addEventListener('change', rerender);
    const newBtn = $('#drivers-new');
    if (newBtn) newBtn.addEventListener('click', () => openForm());
    const emptyNew = $('#drivers-empty-new');
    if (emptyNew) emptyNew.addEventListener('click', () => openForm());
    $('#drivers-export').addEventListener('click', exportCsv);
    view.querySelectorAll('[data-driver]').forEach((b) => b.addEventListener('click', () => openDetail(b.dataset.driver)));
    view.querySelectorAll('[data-edit-driver]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); openForm(b.dataset.editDriver); }));
    view.querySelectorAll('[data-del-driver]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); askDelete(b.dataset.delDriver); }));
  }

  function exportCsv() {
    const db = NS.store.db;
    const rows = [['Cédula/RIF', 'Nombres', 'Apellidos', 'Teléfono', 'Correo', 'Dirección', 'Tipo servicio', 'Placa', 'Marca', 'Modelo', 'Año', 'Color', 'Banco', 'Teléfono pago móvil', 'Cédula pago móvil', 'Cuenta bancaria', '% Comisión', 'Saldo por liquidar USD', 'Estatus', 'Docs aprobados']];
    db.drivers.forEach((d) => rows.push([d.cedula_rif, d.nombres, d.apellidos, d.telefono, d.correo, d.direccion, d.tipo_servicio, d.placa, d.marca, d.modelo, d.anio, d.color, d.banco, d.telefono_pago_movil, d.cedula_pago_movil, d.cuenta_bancaria, d.porcentaje_comision, d.saldo_por_liquidar_usd, d.estatus_conductor, docsInfo(d).approved + '/5']));
    NS.ui.downloadFile('ENVIA_conductores_' + NS.store.today() + '.csv', NS.ui.csv(rows));
    NS.ui.toast('Maestro de conductores exportado a CSV.', 'success');
  }

  function formHtml(d, isNew) {
    const ui = NS.ui;
    return `<form id="driver-form" class="form-grid" autocomplete="off">
      <div class="form-section-title"><span>01</span><div><strong>Datos personales</strong><small>La cédula / RIF identifica de forma única al conductor en toda la plataforma.</small></div></div>
      <label class="field"><span>Cédula / RIF *</span><input name="cedula_rif" value="${ui.esc(d.cedula_rif || '')}" placeholder="V-16874321" ${isNew ? '' : 'disabled'} required></label>
      <label class="field"><span>Estatus operativo</span><select name="estatus_conductor">${NS.store.DRIVER_STATUS.map((s) => `<option ${d.estatus_conductor === s ? 'selected' : ''}>${s}</option>`).join('')}</select></label>
      <label class="field"><span>Nombres *</span><input name="nombres" value="${ui.esc(d.nombres || '')}" placeholder="Carlos Luis" required></label>
      <label class="field"><span>Apellidos *</span><input name="apellidos" value="${ui.esc(d.apellidos || '')}" placeholder="Pérez Marcano" required></label>
      <label class="field"><span>Teléfono móvil *</span><input name="telefono" value="${ui.esc(d.telefono || '')}" placeholder="0412-555-7788" required></label>
      <label class="field"><span>Correo electrónico *</span><input name="correo" type="email" value="${ui.esc(d.correo || '')}" placeholder="conductor@envia.com.ve" required></label>
      <label class="field field-full"><span>Dirección completa *</span><textarea name="direccion" rows="2" placeholder="Calle / avenida, edificio, parroquia, municipio y estado" required>${ui.esc(d.direccion || '')}</textarea></label>

      <div class="form-section-title"><span>02</span><div><strong>Vehículo asignado</strong><small>Datos de la unidad utilizada para traslados o delivery.</small></div></div>
      <label class="field"><span>Tipo de servicio *</span><select name="tipo_servicio">${NS.store.VEHICLE_TYPES.map((t) => `<option ${d.tipo_servicio === t ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
      <label class="field"><span>Placa *</span><input name="placa" value="${ui.esc(d.placa || '')}" placeholder="AB123CD" required></label>
      <label class="field"><span>Marca *</span><input name="marca" value="${ui.esc(d.marca || '')}" placeholder="Italika" required></label>
      <label class="field"><span>Modelo *</span><input name="modelo" value="${ui.esc(d.modelo || '')}" placeholder="250" required></label>
      <label class="field"><span>Año *</span><input name="anio" type="number" min="1990" max="2030" value="${d.anio || new Date().getFullYear()}" required></label>
      <label class="field"><span>Color *</span><input name="color" value="${ui.esc(d.color || '')}" placeholder="Rojo" required></label>

      <div class="form-section-title"><span>03</span><div><strong>Datos financieros de liquidación</strong><small>Información usada para pagar las carreras y encomiendas al conductor.</small></div></div>
      <label class="field"><span>Banco</span><select name="banco">${['Banesco', 'Mercantil', 'Provincial', 'BDV', 'Bancamiga', 'BNC', 'Otro'].map((b) => `<option ${d.banco === b ? 'selected' : ''}>${b}</option>`).join('')}</select></label>
      <label class="field"><span>Teléfono pago móvil *</span><input name="telefono_pago_movil" value="${ui.esc(d.telefono_pago_movil || '')}" placeholder="0414-555-3311" required></label>
      <label class="field"><span>Cédula pago móvil *</span><input name="cedula_pago_movil" value="${ui.esc(d.cedula_pago_movil || '')}" placeholder="V-19234567" required></label>
      <label class="field"><span>Cuenta bancaria</span><input name="cuenta_bancaria" value="${ui.esc(d.cuenta_bancaria || '')}" placeholder="0134-0021-71-0171234567"></label>
      <label class="field"><span>% Comisión ENVIA *</span><input name="porcentaje_comision" type="number" min="0" max="60" step="0.5" value="${d.porcentaje_comision ?? 20}" required></label>
      <label class="field"><span>Saldo por liquidar (USD)</span><input name="saldo_por_liquidar_usd" type="number" min="0" step="0.01" value="${d.saldo_por_liquidar_usd ?? 0}"></label>
      <p class="form-note field-full">${ui.icon('info', 14)} La comisión es el porcentaje que retiene ENVIA sobre el valor base del servicio. El resto se abona al saldo por liquidar del conductor.</p>
    </form>`;
  }

  function openForm(cedula) {
    const ui = NS.ui;
    if (!NS.app.canWrite()) return ui.toast('Tu rol es de solo lectura.', 'warning');
    const d = cedula ? NS.store.db.drivers.find((x) => x.cedula_rif === cedula) : null;
    const data = d || {};
    const overlay = ui.modal({
      title: d ? 'Editar conductor' : 'Nuevo conductor',
      eyebrow: 'Maestro de conductores y flota',
      subtitle: d ? data.nombres + ' ' + data.apellidos + ' · ' + data.placa : 'Registra al aliado operativo, su vehículo y sus datos de liquidación.',
      size: 'lg',
      body: formHtml(data, !d),
      footer: `<button class="btn btn-ghost" data-cancel>Cancelar</button><button class="btn btn-primary" id="driver-save">${ui.icon('check', 16)} ${d ? 'Guardar cambios' : 'Crear conductor'}</button>`
    });
    overlay.querySelector('[data-cancel]').addEventListener('click', () => ui.closeModal(overlay));
    overlay.querySelector('#driver-save').addEventListener('click', () => {
      const form = overlay.querySelector('#driver-form');
      if (!form.reportValidity()) return;
      const payload = {};
      Array.from(form.elements).forEach((el) => { if (el.name) payload[el.name] = el.value; });
      if (d) payload.cedula_rif = d.cedula_rif;
      const idErr = ui.idError(payload.cedula_rif);
      if (idErr) return ui.toast(idErr, 'error');
      if (!ui.validEmail(payload.correo)) return ui.toast('El correo no es válido.', 'error');
      if (!ui.validPhone(payload.telefono)) return ui.toast('El teléfono debe tener entre 10 y 13 dígitos.', 'error');
      if (!ui.validPhone(payload.telefono_pago_movil)) return ui.toast('El teléfono de pago móvil no es válido.', 'error');
      if (!d && NS.store.db.drivers.some((x) => x.cedula_rif === ui.normalizeId(payload.cedula_rif))) return ui.toast('Ya existe un conductor con esa cédula / RIF.', 'error');

      try {
        NS.store.upsertDriver(payload);
        ui.closeModal(overlay);
        ui.toast(d ? 'Conductor actualizado.' : 'Conductor registrado.', 'success');
        NS.app.refresh(true);
        if (d) openDetail(ui.normalizeId(payload.cedula_rif));
      } catch (e) { ui.toast(e.message, 'error'); }
    });
  }

  function detailHtml(d) {
    const ui = NS.ui;
    const db = NS.store.db;
    const canWrite = NS.app.canWrite();
    const info = docsInfo(d);
    const st = d.docs_estado || {};
    const services = db.services.filter((s) => s.conductor_cedula_rif === d.cedula_rif).slice(0, 4);
    const photos = d.urls_fotos_vehiculo || [];
    return `
      <div class="profile-head">
        ${ui.avatar(d.nombres + ' ' + d.apellidos, 58)}
        <div class="profile-id">
          <div class="profile-name">${ui.esc(d.nombres + ' ' + d.apellidos)} ${ui.badge(d.estatus_conductor)}</div>
          <div class="profile-meta"><span class="mono">${ui.esc(d.cedula_rif)}</span><span>${ui.esc(d.tipo_servicio)}</span><span>${ui.esc(d.placa)}</span><span>${ui.esc(d.telefono)}</span></div>
        </div>
        <div class="profile-actions">${canWrite ? `<button class="btn btn-ghost btn-sm" id="driver-detail-edit">${ui.icon('edit', 15)} Editar</button>` : ''}</div>
      </div>

      <div class="detail-grid">
        <div class="detail-main">
          <div class="detail-block">
            <h4>Datos personales y contacto</h4>
            <div class="info-grid">
              <div class="info-item"><span>${ui.icon('pin', 14)} Dirección</span><strong>${ui.esc(d.direccion)}</strong></div>
              <div class="info-item"><span>${ui.icon('phone', 14)} Teléfono</span><strong>${ui.esc(d.telefono)}</strong></div>
              <div class="info-item"><span>${ui.icon('mail', 14)} Correo</span><strong>${ui.esc(d.correo)}</strong></div>
              <div class="info-item"><span>${ui.icon('calendar', 14)} Registrado</span><strong>${ui.dateLong(d.fecha_registro)}</strong></div>
            </div>
          </div>

          <div class="detail-block">
            <h4>Vehículo asignado</h4>
            <div class="vehicle-banner">
              <span class="vehicle-badge">${ui.icon(d.tipo_servicio.indexOf('Moto') === 0 ? 'moto' : 'car', 26)}</span>
              <div><strong>${ui.esc(d.marca)} ${ui.esc(d.modelo)} ${d.anio}</strong><span>${ui.esc(d.color)} · ${ui.esc(d.tipo_servicio)}</span></div>
              <span class="plate">${ui.esc(d.placa)}</span>
            </div>
            <div class="info-grid info-grid-3">
              <div class="info-item"><span>Banco</span><strong>${ui.esc(d.banco || '—')}</strong></div>
              <div class="info-item"><span>Pago móvil</span><strong>${ui.esc(d.telefono_pago_movil || '—')} · ${ui.esc(d.cedula_pago_movil || '')}</strong></div>
              <div class="info-item"><span>Cuenta bancaria</span><strong class="mono">${ui.esc(d.cuenta_bancaria || '—')}</strong></div>
            </div>
          </div>

          <div class="detail-block">
            <h4>Expediente documental <span class="h4-note">${info.approved}/5 aprobados${info.rejected ? ' · ' + info.rejected + ' rechazado(s)' : ''}</span></h4>
            <div class="doc-grid doc-grid-driver">
              ${DOCS.map((doc) => docCard(d, doc, st[doc.key] || 'Pendiente', canWrite)).join('')}
            </div>
            <p class="upload-hint">${ui.icon('cloud', 14)} Arrastra un archivo sobre la tarjeta o usa “Subir”. Bucket: <strong>documentos-conductores/${ui.esc(d.cedula_rif)}</strong>. Validación: Aprobado / Rechazado.</p>
          </div>

          <div class="detail-block">
            <h4>Fotos del vehículo <span class="h4-note">Frontal · lateral · placa (múltiples)</span> ${ui.badge(st.vehiculo || 'Pendiente')}</h4>
            <div class="vehicle-gallery ${canWrite ? 'droppable' : ''}" id="vehicle-drop">
              ${photos.map((p, i) => `<div class="vehicle-photo">
                <img src="${ui.esc(NS.supabase.resolve(p))}" alt="Foto vehículo ${i + 1}" data-preview="${ui.esc(p)}" data-label="Foto del vehículo ${d.placa}">
                ${canWrite ? `<button class="photo-remove" data-remove-photo="${i}" title="Eliminar foto">${ui.icon('x', 13)}</button>` : ''}
              </div>`).join('')}
              ${canWrite ? `<button class="vehicle-add" id="vehicle-add" type="button">${ui.icon('camera', 24)}<span>Agregar fotos</span><small>JPG / PNG</small></button>
              <input type="file" id="vehicle-file" class="hidden-file" accept="image/*" multiple>` : ''}
            </div>
            ${canWrite ? `<div class="inline-actions"><button class="btn btn-xs btn-success-ghost" data-approve-vehicle="1">${ui.icon('check', 13)} Aprobar fotos</button><button class="btn btn-xs btn-danger-ghost" data-reject-vehicle="1">${ui.icon('x', 13)} Rechazar fotos</button></div>` : ''}
          </div>
        </div>

        <aside class="detail-side">
          <div class="settlement-card">
            <span>Saldo por liquidar</span>
            <strong>${ui.usd(d.saldo_por_liquidar_usd)}</strong>
            <small>${ui.bs(ui.toBs(d.saldo_por_liquidar_usd))} · comisión ENVIA ${d.porcentaje_comision}%</small>
            ${canWrite ? `<button class="btn btn-primary btn-block btn-sm" id="driver-settle" ${d.saldo_por_liquidar_usd <= 0 ? 'disabled' : ''}>${ui.icon('bank', 15)} Registrar liquidación</button>` : ''}
          </div>
          <div class="side-metrics">
            <div class="side-metric"><span>Servicios</span><strong>${db.services.filter((s) => s.conductor_cedula_rif === d.cedula_rif).length}</strong></div>
            <div class="side-metric"><span>Aprobados</span><strong>${info.approved}/5</strong></div>
            <div class="side-metric"><span>Pendientes</span><strong>${info.pending}</strong></div>
          </div>
          <div class="detail-block">
            <h4>Últimos servicios</h4>
            ${services.length ? `<div class="mini-list">${services.map((s) => `<div class="mini-row mini-static">
              <span class="mini-ico">${ui.icon(s.tipo === 'carrera' ? 'car' : 'package', 15)}</span>
              <span class="mini-main"><strong>${ui.esc(s.id)}</strong><small>${ui.date(s.fecha)} · ${ui.esc(s.metodo_pago)}</small></span>
              <span class="mini-amount">${ui.usd(s.base_usd)}</span>
            </div>`).join('')}</div>` : `<p class="muted small">Sin servicios registrados.</p>`}
          </div>
          <div class="detail-block">
            <h4>Acciones</h4>
            <div class="stack-actions">
              ${canWrite ? `<button class="btn btn-danger-ghost btn-block" id="driver-detail-delete">${ui.icon('trash', 15)} Eliminar conductor</button>` : ''}
            </div>
          </div>
          <div class="audit-note">${ui.icon('shield', 14)} Cédula / RIF como identificador maestro único · Documentos con control de validación</div>
        </aside>
      </div>`;
  }

  function docCard(d, doc, status, canWrite) {
    const ui = NS.ui;
    const ref = d[doc.field];
    const url = NS.supabase.resolve(ref);
    const tone = status === 'Aprobado' ? 'success' : (status === 'Rechazado' ? 'danger' : 'warning');
    return `<div class="doc-card doc-${tone} ${url ? 'has-file' : ''}" data-drop="${doc.key}">
      <div class="doc-thumb" ${url ? `data-preview="${ui.esc(ref)}" data-label="${ui.esc(doc.label)}"` : ''}>
        ${url ? (url.startsWith('data:application/pdf') ? `<span>${ui.icon('file', 26)}</span>` : `<img src="${ui.esc(url)}" alt="${ui.esc(doc.label)}">`) : `<span>${ui.icon('image', 26)}</span>`}
      </div>
      <div class="doc-body">
        <div class="doc-title-row"><strong>${doc.label}</strong>${ui.badge(status)}</div>
        <span class="${url ? 'text-success' : 'muted'}">${url ? 'Archivo disponible' : 'Sin archivo · arrastra aquí'}</span>
        ${canWrite ? `<div class="doc-actions">
          <button class="btn btn-xs ${url ? 'btn-ghost' : 'btn-primary'}" data-upload-doc="${doc.key}">${ui.icon('upload', 13)} ${url ? 'Reemplazar' : 'Subir'}</button>
          ${url ? `<button class="btn btn-xs btn-success-ghost" data-doc-ok="${doc.key}" title="Aprobar">${ui.icon('check', 12)}</button><button class="btn btn-xs btn-danger-ghost" data-doc-no="${doc.key}" title="Rechazar">${ui.icon('x', 12)}</button>` : ''}
        </div>` : ''}
      </div>
      <input type="file" accept="image/*,.pdf,application/pdf" class="hidden-file" data-doc-input="${doc.key}">
    </div>`;
  }

  async function handleUpload(cedula, key, file, overlay, triggerBtn) {
    const ui = NS.ui;
    if (!file) return;
    if (triggerBtn) ui.setBusy(triggerBtn, true, 'Subiendo...');
    try {
      const doc = DOCS.find((x) => x.key === key);
      const res = await NS.supabase.uploadDocument('documentos-conductores', cedula, doc.tipo, file);
      const driver = NS.store.db.drivers.find((x) => x.cedula_rif === cedula);
      driver[doc.field] = res.ref;
      driver.docs_estado = { ...(driver.docs_estado || {}), [doc.key]: 'Pendiente' };
      NS.store.save();
      ui.toast(res.fallback ? 'Archivo guardado localmente. Conecta Supabase para respaldarlo en la nube.' : 'Documento subido a Supabase Storage.', res.fallback ? 'warning' : 'success');
      ui.closeModal(overlay);
      openDetail(cedula);
      NS.app.refresh(true);
    } catch (e) {
      if (triggerBtn) ui.setBusy(triggerBtn, false);
      ui.toast(e.message, 'error');
    }
  }

  async function addVehiclePhotos(cedula, files, overlay) {
    const ui = NS.ui;
    if (!files || !files.length) return;
    const driver = NS.store.db.drivers.find((x) => x.cedula_rif === cedula);
    const btn = overlay.querySelector('#vehicle-add');
    if (btn) btn.classList.add('loading');
    try {
      const refs = [];
      let anyFallback = false;
      for (let i = 0; i < files.length; i++) {
        const res = await NS.supabase.uploadDocument('fotos-vehiculos', cedula, 'vehiculo_' + (i + 1), files[i]);
        refs.push(res.ref);
        if (res.fallback) anyFallback = true;
      }
      driver.urls_fotos_vehiculo = [...(driver.urls_fotos_vehiculo || []), ...refs];
      driver.docs_estado = { ...(driver.docs_estado || {}), vehiculo: 'Pendiente' };
      NS.store.save();
      ui.toast(files.length + ' foto(s) del vehículo cargada(s).' + (anyFallback ? ' Guardadas localmente (fallback).' : ''), anyFallback ? 'warning' : 'success');
      ui.closeModal(overlay);
      openDetail(cedula);
      NS.app.refresh(true);
    } catch (e) {
      ui.toast(e.message, 'error');
    }
  }

  function openDetail(cedula) {
    const ui = NS.ui;
    const d = NS.store.db.drivers.find((x) => x.cedula_rif === cedula);
    if (!d) return ui.toast('Conductor no encontrado.', 'error');
    const overlay = ui.modal({
      title: 'Expediente del conductor',
      eyebrow: 'Aliado operativo · ' + d.cedula_rif,
      size: 'xl',
      body: detailHtml(d),
      footer: `<button class="btn btn-primary" data-close-detail>Cerrar expediente</button>`
    });

    overlay.querySelector('[data-close-detail]').addEventListener('click', () => ui.closeModal(overlay));
    const edit = overlay.querySelector('#driver-detail-edit');
    if (edit) edit.addEventListener('click', () => { ui.closeModal(overlay); openForm(cedula); });
    const del = overlay.querySelector('#driver-detail-delete');
    if (del) del.addEventListener('click', () => { ui.closeModal(overlay); askDelete(cedula); });

    overlay.querySelectorAll('[data-upload-doc]').forEach((btn) => btn.addEventListener('click', () => {
      const input = overlay.querySelector(`[data-doc-input="${btn.dataset.uploadDoc}"]`);
      if (input) input.click();
    }));
    overlay.querySelectorAll('[data-doc-input]').forEach((input) => input.addEventListener('change', () => {
      handleUpload(cedula, input.dataset.docInput, input.files[0], overlay, overlay.querySelector(`[data-upload-doc="${input.dataset.docInput}"]`));
    }));

    // Drag & drop en tarjetas de documentos
    overlay.querySelectorAll('[data-drop]').forEach((card) => {
      card.addEventListener('dragover', (e) => { e.preventDefault(); card.classList.add('dragging'); });
      card.addEventListener('dragleave', () => card.classList.remove('dragging'));
      card.addEventListener('drop', (e) => {
        e.preventDefault();
        card.classList.remove('dragging');
        const file = e.dataTransfer.files && e.dataTransfer.files[0];
        handleUpload(cedula, card.dataset.drop, file, overlay, card.querySelector('[data-upload-doc]'));
      });
    });

    overlay.querySelectorAll('[data-doc-ok]').forEach((b) => b.addEventListener('click', () => {
      NS.store.setDocStatus(cedula, b.dataset.docOk, 'Aprobado');
      ui.closeModal(overlay); openDetail(cedula); NS.app.refresh(true);
      ui.toast('Documento aprobado.', 'success');
    }));
    overlay.querySelectorAll('[data-doc-no]').forEach((b) => b.addEventListener('click', () => {
      NS.store.setDocStatus(cedula, b.dataset.docNo, 'Rechazado');
      ui.closeModal(overlay); openDetail(cedula); NS.app.refresh(true);
      ui.toast('Documento marcado como rechazado.', 'warning');
    }));

    const vehicleAdd = overlay.querySelector('#vehicle-add');
    const vehicleFile = overlay.querySelector('#vehicle-file');
    if (vehicleAdd && vehicleFile) {
      vehicleAdd.addEventListener('click', () => vehicleFile.click());
      vehicleFile.addEventListener('change', () => addVehiclePhotos(cedula, vehicleFile.files, overlay));
    }
    const drop = overlay.querySelector('#vehicle-drop');
    if (drop) {
      drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('dragging'); });
      drop.addEventListener('dragleave', () => drop.classList.remove('dragging'));
      drop.addEventListener('drop', (e) => {
        e.preventDefault(); drop.classList.remove('dragging');
        addVehiclePhotos(cedula, e.dataTransfer.files, overlay);
      });
    }
    overlay.querySelectorAll('[data-remove-photo]').forEach((b) => b.addEventListener('click', async () => {
      const idx = Number(b.dataset.removePhoto);
      const ref = (d.urls_fotos_vehiculo || [])[idx];
      const ok = await ui.confirm({ title: 'Eliminar foto', message: '¿Eliminar esta foto del vehículo?', confirmText: 'Eliminar', danger: true });
      if (!ok) return;
      try {
        if (ref) await NS.supabase.deleteDocument(ref);
        d.urls_fotos_vehiculo = (d.urls_fotos_vehiculo || []).filter((_, i) => i !== idx);
        NS.store.save();
        ui.closeModal(overlay); openDetail(cedula); NS.app.refresh(true);
      } catch (e) { ui.toast(e.message, 'error'); }
    }));
    const okVeh = overlay.querySelector('[data-approve-vehicle]');
    if (okVeh) okVeh.addEventListener('click', () => {
      NS.store.setDocStatus(cedula, 'vehiculo', 'Aprobado');
      ui.closeModal(overlay); openDetail(cedula); NS.app.refresh(true);
      ui.toast('Fotos del vehículo aprobadas.', 'success');
    });
    const noVeh = overlay.querySelector('[data-reject-vehicle]');
    if (noVeh) noVeh.addEventListener('click', () => {
      NS.store.setDocStatus(cedula, 'vehiculo', 'Rechazado');
      ui.closeModal(overlay); openDetail(cedula); NS.app.refresh(true);
      ui.toast('Fotos del vehículo rechazadas.', 'warning');
    });

    const settle = overlay.querySelector('#driver-settle');
    if (settle) settle.addEventListener('click', () => { ui.closeModal(overlay); openSettle(cedula); });
  }

  function openSettle(cedula) {
    const ui = NS.ui;
    if (!NS.app.canWrite()) return ui.toast('Tu rol es de solo lectura.', 'warning');
    const d = NS.store.db.drivers.find((x) => x.cedula_rif === cedula);
    if (!d) return;
    const overlay = ui.modal({
      title: 'Registrar liquidación al conductor',
      eyebrow: d.cedula_rif,
      subtitle: d.nombres + ' ' + d.apellidos + ' · saldo pendiente ' + ui.usd(d.saldo_por_liquidar_usd),
      size: 'sm',
      body: `<form id="settle-form" class="form-grid">
        <label class="field"><span>Monto a liquidar (USD) *</span><input name="monto_usd" type="number" step="0.01" min="0.01" max="${d.saldo_por_liquidar_usd}" value="${d.saldo_por_liquidar_usd}" required></label>
        <label class="field"><span>Fecha</span><input name="fecha" type="date" value="${NS.store.today()}"></label>
        <label class="field field-full"><span>Método de pago</span><select name="metodo"><option>Pago Móvil</option><option>Transferencia</option><option>Efectivo USD</option><option>Zelle</option></select></label>
        <label class="field field-full"><span>Referencia</span><input name="referencia" placeholder="N° de operación"></label>
        <p class="form-note">${ui.icon('info', 14)} Genera asiento: <strong>DEBE</strong> 2.1.1.02 Cuentas por pagar conductores · <strong>HABER</strong> banco. No genera ingreso ni gasto.</p>
      </form>`,
      footer: `<button class="btn btn-ghost" data-cancel>Cancelar</button><button class="btn btn-primary" id="settle-save">${ui.icon('check', 15)} Liquidar</button>`
    });
    overlay.querySelector('[data-cancel]').addEventListener('click', () => ui.closeModal(overlay));
    overlay.querySelector('#settle-save').addEventListener('click', () => {
      const form = overlay.querySelector('#settle-form');
      if (!form.reportValidity()) return;
      try {
        NS.store.settleDriver(cedula, {
          monto_usd: form.elements.monto_usd.value,
          fecha: form.elements.fecha.value,
          metodo: form.elements.metodo.value,
          referencia: form.elements.referencia.value
        });
        ui.closeModal(overlay);
        ui.toast('Liquidación registrada y asiento contable generado.', 'success');
        NS.app.refresh(true);
        openDetail(cedula);
      } catch (e) { ui.toast(e.message, 'error'); }
    });
  }

  function askDelete(cedula) {
    const ui = NS.ui;
    const d = NS.store.db.drivers.find((x) => x.cedula_rif === cedula);
    ui.confirm({
      title: 'Eliminar conductor',
      message: `¿Eliminar a ${d ? d.nombres + ' ' + d.apellidos : cedula} (${cedula})? Solo es posible si no tiene servicios asociados.`,
      confirmText: 'Eliminar', danger: true
    }).then((ok) => {
      if (!ok) return;
      try {
        NS.store.deleteDriver(cedula);
        ui.toast('Conductor eliminado.', 'success');
        NS.app.refresh(true);
      } catch (e) { ui.toast(e.message, 'error'); }
    });
  }

  NS.modules.drivers = { render, openForm, openDetail, openSettle };
})();
