/* =========================================================================
   ENVIA ERP · modules/audit.js
   Bitácora de auditoría: registro de quién, qué, cuándo y dónde modificó datos.
   ========================================================================= */
(function () {
  'use strict';
  const NS = (window.ENVIA = window.ENVIA || {});
  NS.modules = NS.modules || {};

  const ACCION_LABEL = {
    crear: 'Crear',
    actualizar: 'Actualizar',
    eliminar: 'Eliminar',
    pagar: 'Pagar',
    recargar: 'Recargar billetera',
    liquidar: 'Liquidar conductor',
    registrar: 'Registrar asiento',
    actualizar_documento: 'Actualizar documento',
    resetear: 'Resetear demo'
  };

  const MODULO_LABEL = {
    clientes: 'Clientes',
    conductores: 'Conductores',
    servicios: 'Servicios',
    proveedores: 'Proveedores',
    cuentas_por_pagar: 'Cuentas por Pagar',
    plan_de_cuentas: 'Plan de Cuentas',
    reglas_contables: 'Reglas Contables',
    usuarios: 'Usuarios',
    tributos_bcv: 'Tributos / BCV',
    asientos: 'Asientos Contables',
    billetera: 'Billetera',
    sistema: 'Sistema'
  };

  function statusChip(texto, tipo) {
    const ui = NS.ui;
    const color = tipo === 'success' ? '#4FD08A' : tipo === 'danger' ? '#FF6B6B' : tipo === 'warning' ? '#FFA940' : '#46B6F9';
    return `<span class="chip" style="background:${color};color:#fff;padding:2px 9px;border-radius:9px;font-size:11px;font-weight:600">${ui.icon(tipo === 'success' ? 'check' : tipo === 'danger' ? 'alert-circle' : 'info', 12)} ${ui.esc(texto)}</span>`;
  }

  function render(view) {
    const ui = NS.ui;
    const db = NS.store.db;
    const canWrite = NS.app.isAdmin();
    const canExport = NS.app.canAction('audit', 'exportar');
    const logs = NS.store.getAuditLog();

    // Filtros
    const usuarios = [...new Set(logs.map((l) => l.usuario))].sort();
    const acciones = [...new Set(logs.map((l) => l.accion))].sort();
    const modulos = [...new Set(logs.map((l) => l.modulo))].sort();

    view.innerHTML = `
      <div class="page-head">
        <div>
          <span class="eyebrow">Seguridad · trazabilidad de cambios</span>
          <h2 class="page-title">Bitácora de Auditoría</h2>
          <p class="page-sub">${logs.length} eventos registrados · Usuario actual: <strong>${NS.store.getCurrentUser() ? NS.store.getCurrentUser().usuario : '—'}</strong> · Cada guardar/borrar queda grabado con fecha, hora y responsable.</p>
        </div>
        <div class="page-actions">
          ${NS.reports.button('audit')}
          ${canWrite ? `<button class="btn btn-ghost" id="audit-clear">${ui.icon('trash', 16)} Limpiar bitácora</button>` : ''}
          ${canExport ? `<button class="btn btn-primary" id="audit-export">${ui.icon('download', 16)} Exportar CSV</button>` : ''}
        </div>
      </div>

      <div class="card card-flush">
        <div class="card-head card-head-pad">
          <div><h3>Filtros</h3><p>Filtrá por usuario, acción o módulo para revisar cambios específicos.</p></div>
        </div>
        <div class="form-grid" style="grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px; margin-bottom: 14px;">
          <label class="field">
            <span>Usuario</span>
            <select id="audit-filter-user"><option value="">Todos</option>${usuarios.map((u) => `<option>${ui.esc(u)}</option>`).join('')}</select>
          </label>
          <label class="field">
            <span>Acción</span>
            <select id="audit-filter-action"><option value="">Todas</option>${acciones.map((a) => `<option>${ui.esc(a)}</option>`).join('')}</select>
          </label>
          <label class="field">
            <span>Módulo</span>
            <select id="audit-filter-module"><option value="">Todos</option>${modulos.map((m) => `<option>${ui.esc(m)}</option>`).join('')}</select>
          </label>
          <label class="field">
            <span>Buscar detalle</span>
            <input id="audit-filter-search" type="text" placeholder="Buscar en detalle o referencia...">
          </label>
        </div>
      </div>

      <div class="table-wrap" style="overflow-x: auto;">
        <table class="data-table" id="audit-table">
          <thead>
            <tr>
              <th>Fecha</th><th>Hora</th><th>Usuario</th><th>Rol</th><th>Acción</th><th>Módulo</th><th>Detalle</th><th>Referencia</th>
            </tr>
          </thead>
          <tbody id="audit-tbody">
            ${renderRows(logs)}
          </tbody>
        </table>
      </div>

      ${logs.length === 0 ? `<p class="empty">No hay eventos de auditoría registrados todavía.</p>` : ''}
    `;

    // Aplicar filtros
    const elUser = $('#audit-filter-user');
    const elAction = $('#audit-filter-action');
    const elModule = $('#audit-filter-module');
    const elSearch = $('#audit-filter-search');
    const tbody = $('#audit-tbody');

    function applyFilters() {
      const fu = elUser.value;
      const fa = elAction.value;
      const fm = elModule.value;
      const fs = elSearch.value.toLowerCase();
      const filtrados = logs.filter((l) => {
        if (fu && l.usuario !== fu) return false;
        if (fa && l.accion !== fa) return false;
        if (fm && l.modulo !== fm) return false;
        if (fs && !(l.detalle.toLowerCase().includes(fs) || (l.referencia || '').toLowerCase().includes(fs))) return false;
        return true;
      });
      tbody.innerHTML = renderRows(filtrados);
      if (filtrados.length === 0) tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:24px">No se encontraron eventos con esos filtros.</td></tr>`;
    }

    elUser.addEventListener('change', applyFilters);
    elAction.addEventListener('change', applyFilters);
    elModule.addEventListener('change', applyFilters);
    elSearch.addEventListener('input', applyFilters);

    // Ver detalle de movimiento al pulsar la fila
    tbody.addEventListener('click', (e) => {
      const row = e.target.closest('.audit-row');
      if (!row) return;
      const id = row.dataset.auditId;
      if (id) openAuditDetail(id);
    });

    // Limpiar bitácora
    const btnClear = $('#audit-clear');
    if (btnClear) {
      btnClear.addEventListener('click', async () => {
        const confirmado = await NS.ui.confirm('¿Seguro que deseas limpiar toda la bitácora de auditoría? Esta acción no se puede deshacer.');
        if (confirmado) {
          NS.store.clearAuditLog();
          NS.ui.toast('Bitácora de auditoría limpiada.', 'success');
          tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:24px">No hay eventos de auditoría registrados.</td></tr>`;
        }
      });
    }

    // Exportar CSV
    const btnExport = $('#audit-export');
    if (btnExport) btnExport.addEventListener('click', () => {
      const ui = NS.ui;
      const filas = logs.map((l) => [
        l.fecha, l.hora, l.usuario, l.rol, ACCION_LABEL[l.accion] || l.accion, MODULO_LABEL[l.modulo] || l.modulo, l.detalle, l.referencia
      ]);
      const csv = ['Fecha,Hora,Usuario,Rol,Acción,Módulo,Detalle,Referencia', ...filas.map((f) => f.map((c) => '"' + String(c).replace(/"/g, '""') + '"').join(',')).join('\n')];
      ui.downloadFile('envia_bitacora_auditoria_' + new Date().toISOString().slice(0, 10) + '.csv', '\uFEFF' + csv, 'text/csv;charset=utf-8;');
      NS.ui.toast('Bitácora exportada a CSV.', 'success');
    });
  }

  function renderRows(logs) {
    const ui = NS.ui;
    return logs.map((l) => `<tr class="audit-row" data-audit-id="${ui.esc(l.id)}" style="cursor:pointer;" title="${ui.esc('Ver detalle del movimiento')}">
      <td class="mono">${ui.esc(l.fecha)}</td>
      <td class="mono">${ui.esc(l.hora)}</td>
      <td><strong class="mono">${ui.esc(l.usuario)}</strong><br><small class="text-2">${ui.esc(l.nombre)}</small></td>
      <td>${statusChip(l.rol, 'success')}</td>
      <td>${ui.esc(ACCION_LABEL[l.accion] || l.accion)}</td>
      <td>${ui.esc(MODULO_LABEL[l.modulo] || l.modulo)}</td>
      <td>${ui.esc(l.detalle)}</td>
      <td class="mono small">${ui.esc(l.referencia || '—')}</td>
    </tr>`).join('');
  }

  function formatValue(v) {
    if (v === null) return '<span style="color:#94a3b8">null</span>';
    if (v === undefined) return '<span style="color:#94a3b8">—</span>';
    if (typeof v === 'object') return '<pre style="margin:0;font-size:9px;white-space:pre-wrap;background:#f8fafc;border:1px solid #eef2f8;border-radius:6px;padding:6px 8px;max-height:240px;overflow:auto">' + NS.ui.esc(JSON.stringify(v, null, 2)) + '</pre>';
    return NS.ui.esc(String(v));
  }

  function openAuditDetail(id) {
    const ui = NS.ui;
    const log = (NS.store.getAuditLog() || []).find((l) => l.id === id);
    if (!log) return;
    const extras = log.extras || {};
    const antes = extras.antes || {};
    const despues = extras.despues || {};
    const keys = new Set([...Object.keys(antes), ...Object.keys(despues)]);
    const rows = Array.from(keys).map((k) => {
      const a = antes[k];
      const d = despues[k];
      const changed = a !== d;
      return `<tr>
        <td style="font-size:9px;color:var(--text-3);width:34%">${ui.esc(k)}</td>
        <td style="font-size:10px;color:${changed ? '#b42318' : '#64748b'};width:33%">${formatValue(a)}</td>
        <td style="font-size:10px;color:${changed ? '#15803d' : '#64748b'};width:33%">${formatValue(d)}</td>
      </tr>`;
    }).join('') || `<tr><td colspan="3" style="font-size:9px;color:#94a3b8;padding:16px;text-align:center">Sin cambios de campo registrados.</td></tr>`;

    const overlay = NS.ui.modal({
      title: 'Detalle del movimiento',
      eyebrow: 'Bitácora de auditoría',
      subtitle: 'Cambios campo a campo y registro completo de la entrada.',
      size: 'lg',
      body: `<div class="audit-detail">
        <table class="data-table" style="min-width:unset;margin-bottom:12px">
          <tbody>
            <tr><td style="width:34%"><strong>Fecha</strong></td><td>${ui.esc(log.fecha)} ${ui.esc(log.hora)}</td></tr>
            <tr><td><strong>Usuario</strong></td><td>${ui.esc(log.usuario)} <small class="text-2">${ui.esc(log.nombre)}</small></td></tr>
            <tr><td><strong>Rol</strong></td><td>${ui.esc(log.rol)}</td></tr>
            <tr><td><strong>Acción</strong></td><td>${ui.esc(ACCION_LABEL[log.accion] || log.accion)}</td></tr>
            <tr><td><strong>Módulo</strong></td><td>${ui.esc(MODULO_LABEL[log.modulo] || log.modulo)}</td></tr>
            <tr><td><strong>Referencia</strong></td><td class="mono small">${ui.esc(log.referencia || '—')}</td></tr>
            <tr><td><strong>Detalle</strong></td><td>${ui.esc(log.detalle)}</td></tr>
          </tbody>
        </table>
        ${keys.size ? `<div style="margin:8px 0 4px"><strong style="font-size:9px;color:var(--text-3);display:block;margin-bottom:4px">Cambios campo a campo (antes → después)</strong><table class="data-table" style="min-width:unset"><thead><tr><th style="font-size:9px">Campo</th><th style="font-size:9px">Antes</th><th style="font-size:9px">Después</th></tr></thead><tbody>${rows}</tbody></table></div>` : ''}
        <div style="margin-top:10px"><strong style="font-size:9px;color:var(--text-3);display:block;margin-bottom:4px">Registro completo (JSON)</strong><pre style="margin:0;font-size:9px;white-space:pre-wrap;background:#f8fafc;border:1px solid #eef2f8;border-radius:6px;padding:8px 10px;max-height:300px;overflow:auto">${NS.ui.esc(JSON.stringify(log, null, 2))}</pre></div>
      </div>`,
      footer: `<button class="btn btn-ghost" data-cancel>Cerrar</button>`
    });
    overlay.querySelector('[data-cancel]').addEventListener('click', () => NS.ui.closeModal(overlay));
  }

  NS.modules.audit = { render, openAuditDetail };
})();
