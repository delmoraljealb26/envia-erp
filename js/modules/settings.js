/* =========================================================================
   ENVIA Technology C.A. · modules/settings.js
   Configuración del sistema, Supabase, prueba de conexión, sincronización,
   respaldos locales, estado del sistema y parámetros de mantenimiento.
   ========================================================================= */
(function () {
  'use strict';
  const NS = (window.ENVIA = window.ENVIA || {});
  NS.modules = NS.modules || {};

  let lastReport = null;
  let testResult = null;

  const TABLES = [
    ['clients', 'Clientes', 'cedula_rif'],
    ['drivers', 'Conductores', 'cedula_rif'],
    ['services', 'Servicios', 'id'],
    ['suppliers', 'Proveedores', 'rif'],
    ['partners', 'Negocios asociados', 'rif'],
    ['products', 'Productos tienda', 'sku'],
    ['driverCharges', 'Financiamientos conductores', 'id'],
    ['driverMovements', 'Movimientos wallet', 'id'],
    ['payables', 'Cuentas por pagar', 'id'],
    ['withholdings', 'Comprobantes de retención', 'id'],
    ['accounts', 'Plan de cuentas', 'codigo'],
    ['accountingRules', 'Reglas contables', 'evento'],
    ['entries', 'Asientos + líneas', 'id'],
    ['users', 'Usuarios del sistema', 'usuario'],
    ['systemParams', 'Parámetros del sistema', 'key']
  ];

  function bytes(n) {
    if (!n) return '0 B';
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
    return (n / (1024 * 1024)).toFixed(2) + ' MB';
  }

  function render(view) {
    const ui = NS.ui;
    const store = NS.store;
    const db = store.db;
    if (!Array.isArray(db.systemParams)) db.systemParams = [];
    const cfg = NS.supabase.getConfig();
    const configured = NS.supabase.isConfigured();
    const canWrite = NS.app.canAction('settings', 'editar');
    const files = NS.supabase.listFiles();
    const fileCount = Object.keys(files).length;
    const fileSize = JSON.stringify(files).length;
    const dbSize = JSON.stringify(db).length;

    view.innerHTML = `
      <div class="page-head">
        <div>
          <span class="eyebrow">Sistema · integración nativa con Supabase</span>
          <h2 class="page-title">Configuración del Sistema & Sincronización</h2>
          <p class="page-sub">Conecta PostgreSQL + Storage o mantén el sistema en modo local con respaldo automático en el navegador.</p>
        </div>
        <div class="page-actions">
          ${NS.reports.button('settings')}
          <span class="connection-pill ${configured ? 'online' : 'offline'}"><span class="dot"></span>${configured ? 'Supabase configurado' : 'Modo local'}</span>
          <button class="btn btn-primary" id="settings-sync" ${configured ? '' : 'disabled'}>${ui.icon('refresh', 16)} Sincronizar ahora</button>
        </div>
      </div>

      <section class="card card-span-2">
        <div class="card-head"><div><h3>Parámetros de mantenimiento del sistema</h3><p>Tarifas, comisiones por nivel, planes, descuentos y beneficios parametrizables por módulo.</p></div>${NS.app.canAction('settings', 'parametros') ? `<button class="btn btn-primary btn-sm" id="params-new">${ui.icon('plus', 14)} Nuevo parámetro</button>` : ''}</div>
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th>Clave</th><th>Etiqueta</th><th>Módulo</th><th>Tipo</th><th class="num">Valor</th><th>Descripción</th><th class="actions-col">Acciones</th></tr></thead>
            <tbody>
              ${db.systemParams.length ? db.systemParams.map((p) => `<tr>
                <td><span class="mono strong">${ui.esc(p.key)}</span></td>
                <td>${ui.esc(p.label)}</td>
                <td>${ui.badge(p.module, 'info')}</td>
                <td>${ui.badge(p.tipo, 'info')}</td>
                <td class="num"><strong>${p.tipo === 'porcentaje' ? p.value + '%' : p.tipo === 'monto' ? '$' + p.value : p.value}</strong></td>
                <td>${ui.esc(p.descripcion || '—')}</td>
                <td class="actions-col">
                  ${NS.app.canAction('settings', 'parametros') ? `<button class="icon-btn" data-edit-param="${ui.esc(p.key)}" title="Editar">${ui.icon('edit', 16)}</button>` : ''}
                  ${NS.app.canAction('settings', 'parametros') ? `<button class="icon-btn danger" data-del-param="${ui.esc(p.key)}" title="Eliminar">${ui.icon('trash', 16)}</button>` : ''}
                </td>
              </tr>`).join('') : `<tr><td colspan="7">${ui.empty('settings', 'Sin parámetros', 'Crea el primer parámetro de mantenimiento del sistema.', NS.app.canAction('settings', 'parametros') ? '<button class="btn btn-primary" id="params-empty-new">Nuevo parámetro</button>' : '')}</td></tr>`}
            </tbody>
          </table>
        </div>
      </section>

      <section class="card card-span-2">
        <div class="card-head"><div><h3>Credenciales del proyecto Supabase</h3><p>SUPABASE_URL y SUPABASE_ANON_KEY · se guardan solo en este navegador</p></div>${configured ? ui.badge('Configurado', 'success') : ui.badge('Pendiente', 'warning')}</div>
        <form id="supabase-form" class="form-grid" autocomplete="off">
          <label class="field field-full"><span>SUPABASE_URL *</span><input name="url" value="${ui.esc(cfg.url || '')}" placeholder="https://tu-proyecto.supabase.co" ${canWrite ? '' : 'disabled'}></label>
          <label class="field field-full"><span>SUPABASE_ANON_KEY *</span>
            <div class="secret-input"><input name="anonKey" id="anon-key" type="password" value="${ui.esc(cfg.anonKey || '')}" placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6..." ${canWrite ? '' : 'disabled'}><button type="button" class="icon-btn" id="toggle-key" title="Mostrar u ocultar">${ui.icon('eye', 17)}</button></div>
            <small>Usa la clave <strong>anon public</strong>. Nunca ingreses la service_role en el frontend.</small>
          </label>
          <div class="field-full form-actions">
            ${canWrite ? `<button type="button" class="btn btn-ghost" id="test-connection">${ui.icon('link', 15)} Probar conexión</button><button type="button" class="btn btn-primary" id="save-config">${ui.icon('check', 15)} Guardar configuración</button>` : `<span class="readonly-chip">${ui.icon('eye', 13)} Solo lectura</span>`}
            <a class="btn btn-ghost" href="sql/supabase_schema.sql" target="_blank" rel="noopener">${ui.icon('file', 15)} Ver script SQL</a>
          </div>
        </form>
        ${testResult ? `<div class="test-result ${testResult.ok ? 'ok' : 'warn'}">${ui.icon(testResult.ok ? 'check' : 'alert', 17)}<div><strong>${testResult.ok ? 'Conexión verificada' : 'Conexión con observaciones'}</strong><span>${ui.esc(testResult.message)}</span></div></div>` : ''}
        <div class="steps">
          <div class="step"><span>1</span><div><strong>Crea el proyecto</strong><p>Abre supabase.com y crea un proyecto PostgreSQL.</p></div></div>
          <div class="step"><span>2</span><div><strong>Ejecuta el esquema</strong><p>Copia <code>sql/supabase_schema.sql</code> en el SQL Editor. Crea tablas, índices, triggers, buckets y políticas RLS.</p></div></div>
          <div class="step"><span>3</span><div><strong>Conecta y sincroniza</strong><p>Pega URL y anon key, prueba la conexión y pulsa “Sincronizar ahora”.</p></div></div>
        </div>
      </section>

      <section class="card">
        <div class="card-head"><div><h3>Estado de la conexión</h3><p>Diagnóstico del proyecto</p></div></div>
        <div class="status-list">
          <div class="status-row"><span>API REST</span><strong class="${configured ? 'text-success' : 'muted'}">${configured ? 'Configurada' : 'No configurada'}</strong></div>
          <div class="status-row"><span>Storage</span><strong class="${configured ? 'text-success' : 'muted'}">${configured ? 'Disponible' : 'Fallback local'}</strong></div>
          <div class="status-row"><span>Última prueba</span><strong>${cfg.lastTest ? ui.dateTime(cfg.lastTest) : '—'}</strong></div>
          <div class="status-row"><span>Última sincronización</span><strong>${cfg.lastSync ? ui.dateTime(cfg.lastSync) : '—'}</strong></div>
          <div class="status-row"><span>Tablas del esquema</span><strong>${TABLES.length + 2} definidas</strong></div>
          <div class="status-row"><span>Buckets</span><strong>3 configurados</strong></div>
        </div>
        <div class="bucket-list">
          <div class="bucket"><span class="bucket-ico">${ui.icon('image', 15)}</span><div><strong>documentos-clientes</strong><small>Cédulas y RIF de clientes</small></div></div>
          <div class="bucket"><span class="bucket-ico">${ui.icon('file', 15)}</span><div><strong>documentos-conductores</strong><small>Licencias, RIF y circulación</small></div></div>
          <div class="bucket"><span class="bucket-ico">${ui.icon('camera', 15)}</span><div><strong>fotos-vehiculos</strong><small>Frontal, lateral y placa</small></div></div>
        </div>
      </section>

      <section class="card">
        <div class="card-head"><div><h3>Mapa de sincronización</h3><p>Filas locales listas para upsert en PostgreSQL</p></div><span class="chip chip-navy">${ui.icon('database', 13)} ${db.entries.length} asientos</span></div>
        <div class="table-wrap">
          <table class="data-table sync-table">
            <thead><tr><th>Tabla Supabase</th><th>Entidad local</th><th>Clave de conflicto</th><th class="num">Registros</th><th>Estado</th></tr></thead>
            <tbody>${TABLES.map(([key, label, conflict]) => {
              const count = key === 'entries' ? db.entries.length : (db[key] ? db[key].length : 0);
              return `<tr><td class="mono">${ui.esc(key === 'entries' ? 'accounting_entries' : key === 'withholdings' ? 'withholding_vouchers' : key)}</td><td>${ui.esc(label)}</td><td class="mono">${ui.esc(conflict)}</td><td class="num"><strong>${count}</strong></td><td>${configured ? ui.badge('Listo', 'info') : ui.badge('Local', 'neutral')}</td></tr>`;
            }).join('')}<tr><td class="mono">tax_parameters</td><td>Parámetros fiscales</td><td class="mono">id</td><td class="num"><strong>1</strong></td><td>${configured ? ui.badge('Listo', 'info') : ui.badge('Local', 'neutral')}</td></tr></tbody>
          </table>
        </div>
        <div class="inline-actions">
          <button class="btn btn-ghost btn-sm" id="settings-pull" ${configured ? '' : 'disabled'}>${ui.icon('download', 14)} Descargar clientes y conductores</button>
          <span class="hint">La sincronización hace upsert por clave primaria y no elimina registros remotos.</span>
        </div>
        ${lastReport ? `<div class="sync-report">
          <h4>Resultado de la última sincronización</h4>
          <div class="sync-report-grid">
            ${lastReport.map((r) => `<div class="sync-report-row ${r.ok ? 'ok' : 'bad'}"><span>${ui.icon(r.ok ? 'check' : 'alert', 14)} ${ui.esc(r.table)}</span><strong>${r.ok ? r.count + ' registros' : ui.esc(r.error || 'Error')}</strong></div>`).join('')}
          </div>
        </div>` : ''}
      </section>

      <section class="card">
        <div class="card-head"><div><h3>Integración con APIs externas</h3><p>Servicios externos sincronizados (tasa de cambio, tributos, etc.) y mantenibles desde este panel.</p></div>${NS.app.canAction('settings', 'parametros') ? `<button class="btn btn-primary btn-sm" id="api-new">${ui.icon('plus', 14)} Nueva API</button>` : ''}</div>
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th>Clave</th><th>Nombre</th><th>Endpoint</th><th>Activa</th><th>Sincronizada</th><th>Última sinc.</th><th class="actions-col">Acciones</th></tr></thead>
            <tbody>
              ${db.apiIntegrations.length ? db.apiIntegrations.map((a) => `<tr>
                <td><span class="mono strong">${ui.esc(a.key)}</span></td>
                <td>${ui.esc(a.nombre)}</td>
                <td>${ui.esc(a.endpoint || '—')}</td>
                <td>${ui.badge(a.activo ? 'Activa' : 'Inactiva', a.activo ? 'success' : 'danger')}</td>
                <td>${ui.badge(a.sincronizado ? 'OK' : 'Pendiente', a.sincronizado ? 'success' : 'warning')}</td>
                <td>${a.ultima_sincronizacion || '—'}</td>
                <td class="actions-col">
                  ${NS.app.canAction('settings', 'parametros') ? `<button class="icon-btn" data-edit-api="${ui.esc(a.key)}" title="Editar">${ui.icon('edit', 16)}</button>` : ''}
                  ${NS.app.canAction('settings', 'parametros') ? `<button class="icon-btn danger" data-del-api="${ui.esc(a.key)}" title="Eliminar">${ui.icon('trash', 16)}</button>` : ''}
                </td>
              </tr>`).join('') : `<tr><td colspan="7">${ui.empty('api', 'Sin APIs configuradas', 'Registra la primera integración externa.', NS.app.canAction('settings', 'parametros') ? '<button class="btn btn-primary" id="api-empty-new">Nueva API</button>' : '')}</td></tr>`}
            </tbody>
          </table>
        </div>
      </section>

      <section class="card card-span-2">
        <div class="card-head"><div><h3>Planes de Conductores por Nivel</h3><p>Define el plan semanal (fijo o porcentaje) que se descontará a cada conductor según su nivel.</p></div>${NS.app.canAction('settings', 'parametros') ? `<button class="btn btn-primary btn-sm" id="plan-new">${ui.icon('plus', 14)} Nuevo plan</button>` : ''}</div>
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th>Clave</th><th>Nivel</th><th>Tipo</th><th class="num">Valor</th><th>Descripción</th><th>Activo</th><th class="actions-col">Acciones</th></tr></thead>
            <tbody>
              ${db.driverPlans.length ? db.driverPlans.map((p) => `<tr>
                <td><span class="mono strong">${ui.esc(p.key)}</span></td>
                <td>${ui.badge(p.nivel, 'info')}</td>
                <td>${ui.badge(p.tipo_plan, p.tipo_plan === 'fijo' ? 'success' : 'warning')}</td>
                <td class="num"><strong>${p.tipo_plan === 'fijo' ? '$' + p.valor : p.valor + '%'}</strong></td>
                <td>${ui.esc(p.descripcion || '—')}</td>
                <td>${ui.badge(p.activo ? 'Activo' : 'Inactivo', p.activo ? 'success' : 'danger')}</td>
                <td class="actions-col">
                  ${NS.app.canAction('settings', 'parametros') ? `<button class="icon-btn" data-edit-plan="${ui.esc(p.key)}" title="Editar">${ui.icon('edit', 16)}</button>` : ''}
                  ${NS.app.canAction('settings', 'parametros') ? `<button class="icon-btn danger" data-del-plan="${ui.esc(p.key)}" title="Eliminar">${ui.icon('trash', 16)}</button>` : ''}
                </td>
              </tr>`).join('') : `<tr><td colspan="7">${ui.empty('plan', 'Sin planes configurados', 'Crea el primer plan semanal por nivel.', NS.app.canAction('settings', 'parametros') ? '<button class="btn btn-primary" id="plan-empty-new">Nuevo plan</button>' : '')}</td></tr>`}
            </tbody>
          </table>
        </div>
      </section>

      <section class="card card-span-2">
        <div class="card-head"><div><h3>Eventos de Conductores (Premio / Descuento)</h3><p>Crea eventos aplicables a todos los conductores o a un nivel específico, con valor en monto fijo o porcentaje.</p></div>${NS.app.canAction('settings', 'parametros') ? `<button class="btn btn-primary btn-sm" id="event-new">${ui.icon('plus', 14)} Nuevo evento</button>` : ''}</div>
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th>Clave</th><th>Nombre</th><th>Tipo evento</th><th>Aplicación</th><th class="num">Valor</th><th>Activo</th><th class="actions-col">Acciones</th></tr></thead>
            <tbody>
              ${db.driverEvents.length ? db.driverEvents.map((e) => `<tr>
                <td><span class="mono strong">${ui.esc(e.key)}</span></td>
                <td>${ui.esc(e.nombre)}</td>
                <td>${ui.badge(e.tipo_evento, e.tipo_evento === 'premio' ? 'success' : 'danger')}</td>
                <td>${e.aplicacion === 'todos' ? 'Todos' : 'Nivel: ' + e.nivel_aplicar}</td>
                <td class="num"><strong>${e.tipo_valor === 'porcentaje' ? e.valor + '%' : '$' + e.valor}</strong></td>
                <td>${ui.badge(e.activo ? 'Activo' : 'Inactivo', e.activo ? 'success' : 'danger')}</td>
                <td class="actions-col">
                  ${NS.app.canAction('settings', 'parametros') ? `<button class="icon-btn" data-edit-event="${ui.esc(e.key)}" title="Editar">${ui.icon('edit', 16)}</button>` : ''}
                  ${NS.app.canAction('settings', 'parametros') ? `<button class="icon-btn danger" data-del-event="${ui.esc(e.key)}" title="Eliminar">${ui.icon('trash', 16)}</button>` : ''}
                </td>
              </tr>`).join('') : `<tr><td colspan="7">${ui.empty('event', 'Sin eventos configurados', 'Crea el primer evento de premio o descuento.', NS.app.canAction('settings', 'parametros') ? '<button class="btn btn-primary" id="event-empty-new">Nuevo evento</button>' : '')}</td></tr>`}
            </tbody>
          </table>
        </div>
      </section>

      <div class="dash-grid">
        <section class="card">
          <div class="card-head"><div><h3>Respaldo y restauración</h3><p>Exporta toda la base local + archivos</p></div></div>
          <div class="backup-stats">
            <div><span>Base de datos</span><strong>${bytes(dbSize)}</strong></div>
            <div><span>Archivos locales</span><strong>${fileCount} · ${bytes(fileSize)}</strong></div>
            <div><span>Registros totales</span><strong>${db.clients.length + db.drivers.length + db.services.length + db.payables.length + db.entries.length}</strong></div>
          </div>
          <div class="stack-actions">
            <button class="btn btn-primary btn-block" id="backup-export">${ui.icon('download', 15)} Exportar respaldo JSON</button>
            <button class="btn btn-ghost btn-block" id="backup-import">${ui.icon('upload', 15)} Importar respaldo</button>
            <button class="btn btn-danger-ghost btn-block" id="backup-reset">${ui.icon('refresh', 15)} Restaurar datos demo</button>
            <input type="file" id="backup-file" accept="application/json,.json" class="hidden-file">
          </div>
        </section>

        <section class="card">
          <div class="card-head"><div><h3>Información del sistema</h3><p>Parámetros y documentación</p></div></div>
          <div class="status-list">
            <div class="status-row"><span>Versión</span><strong>ENVIA Technology C.A. 1.5.0</strong></div>
            <div class="status-row"><span>Moneda funcional</span><strong>VES (Bolívares)</strong></div>
            <div class="status-row"><span>Tasa BCV</span><strong>${ui.bs(db.taxParams.bcvRate)} / USD</strong></div>
            <div class="status-row"><span>Unidad Tributaria</span><strong>${ui.bs(db.taxParams.ut)}</strong></div>
            <div class="status-row"><span>IVA</span><strong>${db.taxParams.ivaGeneral}% general · ${db.taxParams.ivaReducido}% reducido</strong></div>
            <div class="status-row"><span>IGTF</span><strong>${db.taxParams.igtf}%</strong></div>
            <div class="status-row"><span>Sesión</span><strong>${ui.esc(NS.app.session.rol)}</strong></div>
          </div>
          <div class="doc-links">
            <a href="AGENTS.md" target="_blank">${ui.icon('file', 14)} AGENTS.md</a>
            <a href="docs/constitution.md" target="_blank">${ui.icon('shield', 14)} Constitución técnica</a>
            <a href="sql/supabase_schema.sql" target="_blank">${ui.icon('database', 14)} Esquema SQL</a>
          </div>
          <p class="form-note">${ui.icon('shield', 14)} Los documentos subidos sin Supabase se guardan como DataURL en localStorage. Al conectar Storage, los nuevos archivos se almacenan en la nube automáticamente.</p>
        </section>
      </div>
    `;

    const form = $('#supabase-form');
    if (canWrite) {
      $('#toggle-key').addEventListener('click', () => {
        const input = $('#anon-key');
        input.type = input.type === 'password' ? 'text' : 'password';
      });
      $('#save-config').addEventListener('click', () => {
        const url = form.elements.url.value.trim().replace(/\/+$/, '');
        const key = form.elements.anonKey.value.trim();
        if (!url || !key) return ui.toast('Completa SUPABASE_URL y SUPABASE_ANON_KEY.', 'warning');
        if (!/^https?:\/\//.test(url)) return ui.toast('La URL debe iniciar con https://', 'error');
        NS.supabase.saveConfig({ url, anonKey: key });
        ui.toast('Configuración guardada en este navegador.', 'success');
        render(view);
      });
      $('#test-connection').addEventListener('click', async () => {
        const btn = $('#test-connection');
        const url = form.elements.url.value.trim();
        const key = form.elements.anonKey.value.trim();
        if (!url || !key) return ui.toast('Completa URL y anon key antes de probar.', 'warning');
        ui.setBusy(btn, true, 'Probando...');
        try {
          testResult = await NS.supabase.testConnection(url, key);
          ui.toast(testResult.message, testResult.ok ? 'success' : 'warning');
          render(view);
        } catch (e) {
          testResult = { ok: false, message: e.message };
          ui.toast(e.message, 'error');
          render(view);
        }
      });
    }

    $('#settings-sync').addEventListener('click', async () => {
      if (!NS.supabase.isConfigured()) return ui.toast('Primero configura Supabase.', 'warning');
      const btn = $('#settings-sync');
      ui.setBusy(btn, true, 'Sincronizando...');
      try {
        lastReport = await NS.supabase.syncAll();
        const failed = lastReport.filter((r) => !r.ok).length;
        ui.toast(failed ? `Sincronización completada con ${failed} tabla(s) con error.` : 'Todas las tablas se sincronizaron correctamente.', failed ? 'warning' : 'success');
        render(view);
      } catch (e) {
        ui.toast(e.message, 'error');
        ui.setBusy(btn, false);
      }
    });

    $('#settings-pull').addEventListener('click', async () => {
      const btn = $('#settings-pull');
      ui.setBusy(btn, true, 'Descargando...');
      try {
        const n = await NS.supabase.pullClientsDrivers();
        ui.toast(n + ' registros remotos importados/actualizados.', 'success');
        NS.app.refresh(true);
      } catch (e) {
        ui.toast(e.message, 'error');
        ui.setBusy(btn, false);
      }
    });

    $('#backup-export').addEventListener('click', () => {
      ui.downloadFile('ENVIA_respaldo_' + NS.store.today() + '.json', NS.store.exportJSON(), 'application/json');
      ui.toast('Respaldo JSON generado.', 'success');
    });
    $('#backup-import').addEventListener('click', () => $('#backup-file').click());
    $('#backup-file').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        ui.confirm({ title: 'Importar respaldo', message: 'Se reemplazarán todos los datos actuales por los del archivo. ¿Continuar?', confirmText: 'Importar', danger: true }).then((ok) => {
          if (!ok) return;
          try {
            NS.store.importJSON(reader.result);
            ui.toast('Respaldo restaurado correctamente.', 'success');
            NS.app.refresh(true);
          } catch (err) { ui.toast(err.message, 'error'); }
        });
      };
      reader.readAsText(file);
    });
    $('#backup-reset').addEventListener('click', () => {
      ui.confirm({
        title: 'Restaurar datos demo',
        message: 'Se eliminarán los cambios locales y se restaurará la base de demostración venezolana (clientes, conductores, servicios, contabilidad y facturas). Los archivos locales se conservarán.',
        confirmText: 'Restaurar demo', danger: true
      }).then((ok) => {
        if (!ok) return;
        NS.store.resetDemo();
        ui.toast('Datos demo restaurados.', 'success');
        NS.app.refresh(true);
      });
    });

    /* Parámetros de mantenimiento */
    const canParams = NS.app.canAction('settings', 'parametros');
    const paramsNew = $('#params-new');
    if (paramsNew) paramsNew.addEventListener('click', () => openParamForm());
    const paramsEmptyNew = $('#params-empty-new');
    if (paramsEmptyNew) paramsEmptyNew.addEventListener('click', () => openParamForm());
    view.querySelectorAll('[data-edit-param]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); openParamForm(b.dataset.editParam); }));
    view.querySelectorAll('[data-del-param]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); askDeleteParam(b.dataset.delParam); }));

    /* Integraciones con APIs */
    const apiNew = $('#api-new');
    if (apiNew) apiNew.addEventListener('click', () => openApiForm());
    const apiEmptyNew = $('#api-empty-new');
    if (apiEmptyNew) apiEmptyNew.addEventListener('click', () => openApiForm());
    view.querySelectorAll('[data-edit-api]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); openApiForm(b.dataset.editApi); }));
    view.querySelectorAll('[data-del-api]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); askDeleteApi(b.dataset.delApi); }));

    /* Planes de conductores */
    const planNew = $('#plan-new');
    if (planNew) planNew.addEventListener('click', () => openPlanForm());
    const planEmptyNew = $('#plan-empty-new');
    if (planEmptyNew) planEmptyNew.addEventListener('click', () => openPlanForm());
    view.querySelectorAll('[data-edit-plan]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); openPlanForm(b.dataset.editPlan); }));
    view.querySelectorAll('[data-del-plan]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); askDeletePlan(b.dataset.delPlan); }));

    /* Eventos de conductores */
    const eventNew = $('#event-new');
    if (eventNew) eventNew.addEventListener('click', () => openEventForm());
    const eventEmptyNew = $('#event-empty-new');
    if (eventEmptyNew) eventEmptyNew.addEventListener('click', () => openEventForm());
    view.querySelectorAll('[data-edit-event]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); openEventForm(b.dataset.editEvent); }));
    view.querySelectorAll('[data-del-event]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); askDeleteEvent(b.dataset.delEvent); }));
  }

  function openParamForm(key) {
    const p = key ? NS.store.systemParam(key) : null;
    const overlay = NS.ui.modal({
      title: p ? 'Editar parámetro' : 'Nuevo parámetro',
      eyebrow: 'Parámetros de mantenimiento',
      subtitle: p ? `Clave: ${NS.ui.esc(p.key)}` : 'Define un parámetro configurable para el sistema.',
      size: 'sm',
      body: `<form id="param-form" class="form-grid" autocomplete="off">
        <label class="field"><span>Clave *</span><input name="key" value="${NS.ui.esc(p ? p.key : '')}" placeholder="tarifa_plana_semanal_usd" ${p ? 'disabled' : ''} required></label>
        <label class="field"><span>Etiqueta *</span><input name="label" value="${NS.ui.esc(p ? p.label : '')}" placeholder="Tarifa plana semanal" required></label>
        <label class="field"><span>Módulo</span><input name="module" value="${NS.ui.esc(p ? p.module : 'sistema')}" placeholder="drivers"></label>
        <label class="field"><span>Tipo *</span><select name="tipo">${['texto', 'monto', 'porcentaje', 'booleano', 'fecha'].map((t) => `<option value="${t}" ${(p && p.tipo) === t ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
        <label class="field"><span>Valor *</span><input name="value" value="${NS.ui.esc(p ? p.value : '')}" placeholder="10"></label>
        <label class="field field-full"><span>Descripción</span><textarea name="descripcion" rows="2" placeholder="Qué controla este parámetro...">${NS.ui.esc(p ? p.descripcion : '')}</textarea></label>
      </form>`,
      footer: `<button class="btn btn-ghost" data-cancel>Cancelar</button><button class="btn btn-primary" id="param-save">${NS.ui.icon('check', 15)} ${p ? 'Guardar' : 'Crear'}</button>`
    });
    overlay.querySelector('[data-cancel]').addEventListener('click', () => NS.ui.closeModal(overlay));
    overlay.querySelector('#param-save').addEventListener('click', () => {
      const form = overlay.querySelector('#param-form');
      if (!form.reportValidity()) return;
      try {
        NS.store.upsertSystemParam({
          key: form.elements.key.value,
          label: form.elements.label.value,
          module: form.elements.module.value || 'sistema',
          tipo: form.elements.tipo.value,
          value: form.elements.value.value,
          descripcion: form.elements.descripcion.value
        });
        NS.ui.closeModal(overlay);
        NS.ui.toast(p ? 'Parámetro actualizado.' : 'Parámetro creado.', 'success');
        NS.app.refresh(true);
      } catch (e) { NS.ui.toast(e.message, 'error'); }
    });
  }

  function askDeleteParam(key) {
    const p = NS.store.systemParam(key);
    NS.ui.confirm({
      title: 'Eliminar parámetro',
      message: `¿Eliminar el parámetro "${NS.ui.esc(p ? p.label : key)}" (${NS.ui.esc(key)})?`,
      confirmText: 'Eliminar', danger: true
    }).then((ok) => {
      if (!ok) return;
      try {
        NS.store.deleteSystemParam(key);
        NS.ui.toast('Parámetro eliminado.', 'success');
        NS.app.refresh(true);
      } catch (e) { NS.ui.toast(e.message, 'error'); }
    });
  }

  function openApiForm(key) {
    const a = key ? NS.store.apiIntegrations().find((x) => x.key === key) : null;
    const overlay = NS.ui.modal({
      title: a ? 'Editar integración API' : 'Nueva integración API',
      eyebrow: 'Integración con APIs externas',
      subtitle: a ? `Clave: ${NS.ui.esc(a.key)}` : 'Define una integración con un servicio externo.',
      size: 'sm',
      body: `<form id="api-form" class="form-grid" autocomplete="off">
        <label class="field"><span>Clave *</span><input name="key" value="${NS.ui.esc(a ? a.key : '')}" placeholder="bcv_tasa_dolar" ${a ? 'disabled' : ''} required></label>
        <label class="field"><span>Nombre *</span><input name="nombre" value="${NS.ui.esc(a ? a.nombre : '')}" placeholder="Tasa BCV Dólar" required></label>
        <label class="field"><span>Endpoint</span><input name="endpoint" value="${NS.ui.esc(a ? a.endpoint : '')}" placeholder="https://api.ejemplo.com"></label>
        <label class="field check-inline"><input type="checkbox" name="activo" ${a ? (a.activo ? 'checked' : '') : 'checked'}> API activa</label>
        <label class="field check-inline"><input type="checkbox" name="sincronizado" ${a ? (a.sincronizado ? 'checked' : '') : ''}> Sincronizada correctamente</label>
        <label class="field"><span>Última sincronización</span><input name="ultima_sincronizacion" type="date" value="${NS.ui.esc(a ? a.ultima_sincronizacion : '')}"></label>
        <label class="field field-full"><span>Descripción</span><textarea name="descripcion" rows="2" placeholder="Qué hace esta integración...">${NS.ui.esc(a ? a.descripcion : '')}</textarea></label>
      </form>`,
      footer: `<button class="btn btn-ghost" data-cancel>Cancelar</button><button class="btn btn-primary" id="api-save">${NS.ui.icon('check', 15)} ${a ? 'Guardar' : 'Crear'}</button>`
    });
    overlay.querySelector('[data-cancel]').addEventListener('click', () => NS.ui.closeModal(overlay));
    overlay.querySelector('#api-save').addEventListener('click', () => {
      const form = overlay.querySelector('#api-form');
      if (!form.reportValidity()) return;
      try {
        NS.store.upsertApiIntegration({
          key: form.elements.key.value,
          nombre: form.elements.nombre.value,
          endpoint: form.elements.endpoint.value,
          activo: form.elements.activo.checked,
          sincronizado: form.elements.sincronizado.checked,
          ultima_sincronizacion: form.elements.ultima_sincronizacion.value,
          descripcion: form.elements.descripcion.value
        });
        NS.ui.closeModal(overlay);
        NS.ui.toast(a ? 'API actualizada.' : 'API creada.', 'success');
        NS.app.refresh(true);
      } catch (e) { NS.ui.toast(e.message, 'error'); }
    });
  }

  function askDeleteApi(key) {
    const a = NS.store.apiIntegrations().find((x) => x.key === key);
    NS.ui.confirm({
      title: 'Eliminar integración API',
      message: `¿Eliminar la API "${NS.ui.esc(a ? a.nombre : key)}" (${NS.ui.esc(key)})?`,
      confirmText: 'Eliminar', danger: true
    }).then((ok) => {
      if (!ok) return;
      try {
        NS.store.deleteApiIntegration(key);
        NS.ui.toast('API eliminada.', 'success');
        NS.app.refresh(true);
      } catch (e) { NS.ui.toast(e.message, 'error'); }
    });
  }

  function openPlanForm(key) {
    const p = key ? NS.store.driverPlan(key) : null;
    const overlay = NS.ui.modal({
      title: p ? 'Editar plan de conductor' : 'Nuevo plan de conductor',
      eyebrow: 'Planes de conductores por nivel',
      subtitle: p ? `Clave: ${NS.ui.esc(p.key)}` : 'Define un plan semanal (fijo o porcentaje) por nivel.',
      size: 'sm',
      body: `<form id="plan-form" class="form-grid" autocomplete="off">
        <label class="field"><span>Clave *</span><input name="key" value="${NS.ui.esc(p ? p.key : '')}" placeholder="plan_fijo_zafiro" ${p ? 'disabled' : ''} required></label>
        <label class="field"><span>Nivel *</span><select name="nivel">${NS.store.DRIVER_LEVELS.map((n) => `<option value="${n}" ${(p && p.nivel) === n ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
        <label class="field"><span>Tipo de plan *</span><select name="tipo_plan"><option value="fijo" ${(p && p.tipo_plan) === 'fijo' ? 'selected' : ''}>Fijo (monto USD)</option><option value="porcentaje" ${(p && p.tipo_plan) === 'porcentaje' ? 'selected' : ''}>Porcentaje (%)</option></select></label>
        <label class="field"><span>Valor *</span><input name="valor" type="number" min="0" step="0.01" value="${NS.ui.esc(p ? p.valor : '')}" placeholder="27 o 25" required></label>
        <label class="field field-full"><span>Descripción</span><textarea name="descripcion" rows="2" placeholder="Ej: Plan fijo semanal Zafiro: $27 a descontar cada semana.">${NS.ui.esc(p ? p.descripcion : '')}</textarea></label>
        <label class="field check-inline"><input type="checkbox" name="activo" ${p ? (p.activo !== false ? 'checked' : '') : 'checked'}> Plan activo</label>
      </form>`,
      footer: `<button class="btn btn-ghost" data-cancel>Cancelar</button><button class="btn btn-primary" id="plan-save">${NS.ui.icon('check', 15)} ${p ? 'Guardar' : 'Crear'}</button>`
    });
    overlay.querySelector('[data-cancel]').addEventListener('click', () => NS.ui.closeModal(overlay));
    overlay.querySelector('#plan-save').addEventListener('click', () => {
      const form = overlay.querySelector('#plan-form');
      if (!form.reportValidity()) return;
      try {
        NS.store.upsertDriverPlan({
          key: form.elements.key.value,
          nivel: form.elements.nivel.value,
          tipo_plan: form.elements.tipo_plan.value,
          valor: form.elements.valor.value,
          descripcion: form.elements.descripcion.value,
          activo: form.elements.activo.checked
        });
        NS.ui.closeModal(overlay);
        NS.ui.toast(p ? 'Plan actualizado.' : 'Plan creado.', 'success');
        NS.app.refresh(true);
      } catch (e) { NS.ui.toast(e.message, 'error'); }
    });
  }

  function askDeletePlan(key) {
    const p = NS.store.driverPlan(key);
    NS.ui.confirm({
      title: 'Eliminar plan de conductor',
      message: `¿Eliminar el plan "${NS.ui.esc(p ? p.key : key)}" (${NS.ui.esc(p ? p.nivel : '')})?`,
      confirmText: 'Eliminar', danger: true
    }).then((ok) => {
      if (!ok) return;
      try {
        NS.store.deleteDriverPlan(key);
        NS.ui.toast('Plan eliminado.', 'success');
        NS.app.refresh(true);
      } catch (e) { NS.ui.toast(e.message, 'error'); }
    });
  }

  function openEventForm(key) {
    const e = key ? NS.store.driverEvent(key) : null;
    const overlay = NS.ui.modal({
      title: e ? 'Editar evento de conductor' : 'Nuevo evento de conductor',
      eyebrow: 'Eventos de conductores (premio / descuento)',
      subtitle: e ? `Clave: ${NS.ui.esc(e.key)}` : 'Crea un evento aplicable a todos o a un nivel específico.',
      size: 'sm',
      body: `<form id="event-form" class="form-grid" autocomplete="off">
        <label class="field"><span>Clave *</span><input name="key" value="${NS.ui.esc(e ? e.key : '')}" placeholder="evento_premio_semanal" ${e ? 'disabled' : ''} required></label>
        <label class="field"><span>Nombre *</span><input name="nombre" value="${NS.ui.esc(e ? e.nombre : '')}" placeholder="Premio Semana 100%" required></label>
        <label class="field"><span>Tipo de evento *</span><select name="tipo_evento"><option value="premio" ${(e && e.tipo_evento) === 'premio' ? 'selected' : ''}>Premio (suma)</option><option value="descuento" ${(e && e.tipo_evento) === 'descuento' ? 'selected' : ''}>Descuento (resta)</option></select></label>
        <label class="field"><span>Aplicación *</span><select name="aplicacion"><option value="todos" ${(e && e.aplicacion) === 'todos' ? 'selected' : ''}>Todos los conductores</option><option value="nivel" ${(e && e.aplicacion) === 'nivel' ? 'selected' : ''}>Nivel específico</option></select></label>
        <label class="field"><span>Nivel a aplicar</span><select name="nivel_aplicar">${NS.store.DRIVER_LEVELS.map((n) => `<option value="${n}" ${(e && e.nivel_aplicar) === n ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
        <label class="field"><span>Tipo de valor *</span><select name="tipo_valor"><option value="porcentaje" ${(e && e.tipo_valor) === 'porcentaje' ? 'selected' : ''}>Porcentaje (%)</option><option value="monto" ${(e && e.tipo_valor) === 'monto' ? 'selected' : ''}>Monto fijo (USD)</option></select></label>
        <label class="field"><span>Valor *</span><input name="valor" type="number" min="0" step="0.01" value="${NS.ui.esc(e ? e.valor : '')}" placeholder="100 o 50" required></label>
        <label class="field"><span>Fecha inicio</span><input name="fecha_inicio" type="date" value="${NS.ui.esc(e ? e.fecha_inicio : '')}"></label>
        <label class="field field-full"><span>Descripción</span><textarea name="descripcion" rows="2" placeholder="Ej: Premio semanal: conductor recibe 100% de lo generado.">${NS.ui.esc(e ? e.descripcion : '')}</textarea></label>
        <label class="field check-inline"><input type="checkbox" name="activo" ${e ? (e.activo !== false ? 'checked' : '') : 'checked'}> Evento activo</label>
      </form>`,
      footer: `<button class="btn btn-ghost" data-cancel>Cancelar</button><button class="btn btn-primary" id="event-save">${NS.ui.icon('check', 15)} ${e ? 'Guardar' : 'Crear'}</button>`
    });
    overlay.querySelector('[data-cancel]').addEventListener('click', () => NS.ui.closeModal(overlay));
    overlay.querySelector('#event-save').addEventListener('click', () => {
      const form = overlay.querySelector('#event-form');
      if (!form.reportValidity()) return;
      try {
        NS.store.upsertDriverEvent({
          key: form.elements.key.value,
          nombre: form.elements.nombre.value,
          tipo_evento: form.elements.tipo_evento.value,
          aplicacion: form.elements.aplicacion.value,
          nivel_aplicar: form.elements.nivel_aplicar.value,
          valor: form.elements.valor.value,
          tipo_valor: form.elements.tipo_valor.value,
          fecha_inicio: form.elements.fecha_inicio.value,
          descripcion: form.elements.descripcion.value,
          activo: form.elements.activo.checked
        });
        NS.ui.closeModal(overlay);
        NS.ui.toast(e ? 'Evento actualizado.' : 'Evento creado.', 'success');
        NS.app.refresh(true);
      } catch (ex) { NS.ui.toast(ex.message, 'error'); }
    });
  }

  function askDeleteEvent(key) {
    const e = NS.store.driverEvent(key);
    NS.ui.confirm({
      title: 'Eliminar evento de conductor',
      message: `¿Eliminar el evento "${NS.ui.esc(e ? e.nombre : key)}" (${NS.ui.esc(key)})?`,
      confirmText: 'Eliminar', danger: true
    }).then((ok) => {
      if (!ok) return;
      try {
        NS.store.deleteDriverEvent(key);
        NS.ui.toast('Evento eliminado.', 'success');
        NS.app.refresh(true);
      } catch (ex) { NS.ui.toast(ex.message, 'error'); }
    });
  }

  NS.modules.settings = { render, openParamForm, openApiForm, openPlanForm, openEventForm };
})();
