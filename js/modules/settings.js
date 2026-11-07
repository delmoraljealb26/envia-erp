/* =========================================================================
   ENVIA ERP · modules/settings.js
   Configuración de Supabase, prueba de conexión, sincronización,
   respaldos locales y estado del sistema.
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
    ['payables', 'Cuentas por pagar', 'id'],
    ['withholdings', 'Comprobantes de retención', 'id'],
    ['accounts', 'Plan de cuentas', 'codigo'],
    ['accountingRules', 'Reglas contables', 'evento'],
    ['entries', 'Asientos + líneas', 'id'],
    ['users', 'Usuarios ERP', 'usuario']
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
          <h2 class="page-title">Configuración Supabase & Sincronización</h2>
          <p class="page-sub">Conecta PostgreSQL + Storage o mantén el ERP en modo local con respaldo automático en el navegador.</p>
        </div>
        <div class="page-actions">
          ${NS.reports.button('settings')}
          <span class="connection-pill ${configured ? 'online' : 'offline'}"><span class="dot"></span>${configured ? 'Supabase configurado' : 'Modo local'}</span>
          <button class="btn btn-primary" id="settings-sync" ${configured ? '' : 'disabled'}>${ui.icon('refresh', 16)} Sincronizar ahora</button>
        </div>
      </div>

      <div class="dash-grid">
        <section class="card card-span-2">
          <div class="card-head"><div><h3>Credenciales del proyecto</h3><p>SUPABASE_URL y SUPABASE_ANON_KEY · se guardan solo en este navegador</p></div>${configured ? ui.badge('Configurado', 'success') : ui.badge('Pendiente', 'warning')}</div>
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
      </div>

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
            <div class="status-row"><span>Versión</span><strong>ENVIA ERP 1.0.0</strong></div>
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
  }

  NS.modules.settings = { render };
})();
