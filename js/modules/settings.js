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
  let chatbotTestResult = null;

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
    ['systemParams', 'Parámetros del sistema', 'key'],
    ['driverPlans', 'Planes de conductor', 'key'],
    ['driverEvents', 'Eventos de conductor', 'key'],
    ['customReports', 'Reportes personalizados', 'id']
  ];

  function bytes(n) {
    if (!n) return '0 B';
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
    return (n / (1024 * 1024)).toFixed(2) + ' MB';
  }

  function syncReportLabel(key) {
    if (key === 'tax_parameters') return 'Parámetros fiscales';
    const item = TABLES.find(([k]) => k === key);
    return item ? item[1] : key;
  }

  function syncLocalCount(key) {
    const db = NS.store.db || {};
    if (key === 'tax_parameters') return 1;
    if (key === 'entries') return (db.entries || []).length;
    return (db[key] || []).length;
  }

  const SYNC_ID_RE = /^[VEJ]-[0-9]{7,9}$/;
  const ACCOUNTING_ORIGINS = ['manual', 'apertura', 'servicio', 'liquidacion', 'compra', 'pago', 'wallet', 'gasto', 'tienda'];

  function syncCleanRow(row) {
    try { return JSON.parse(JSON.stringify(row || {})); } catch (e) { return row || {}; }
  }

  function normalizeSyncId(value) {
    let s = String(value || '').toUpperCase().replace(/\s+/g, '').replace(/[^VEJ0-9-]/g, '');
    if (!s.includes('-') && /^[VEJ]/.test(s)) s = s[0] + '-' + s.slice(1);
    return s;
  }

  function syncRowLabel(key, row, index) {
    const clean = syncCleanRow(row);
    let id = '';
    let name = '';
    if (key === 'entries') {
      id = clean.numero || clean.id;
      name = clean.descripcion || clean.referencia || '';
    } else if (key === 'clients' || key === 'drivers') {
      id = clean.cedula_rif || clean.id;
      name = [clean.nombres, clean.apellidos].filter(Boolean).join(' ');
    } else if (key === 'suppliers' || key === 'partners') {
      id = clean.rif || clean.id;
      name = clean.razon_social || clean.nombre || '';
    } else {
      id = clean.id || clean.numero || clean.codigo || clean.sku || clean.key || clean.usuario;
      name = clean.nombre || clean.descripcion || clean.concepto || clean.correo || '';
    }
    return {
      id: String(id || ('Fila ' + (index + 1))),
      name: String(name || '')
    };
  }

  function syncKeyMismatchDetails(key) {
    const rows = (NS.store.db && NS.store.db[key]) || [];
    if (!Array.isArray(rows) || rows.length < 2) return [];
    const groups = new Map();
    rows.forEach((row, index) => {
      const clean = syncCleanRow(row);
      const keys = Object.keys(clean).sort();
      const sig = keys.join('|');
      if (!groups.has(sig)) groups.set(sig, { keys, rows: [] });
      groups.get(sig).rows.push({ row: clean, index });
    });
    if (groups.size < 2) return [];
    let base = null;
    groups.forEach((group) => {
      if (!base || group.rows.length > base.rows.length) base = group;
    });
    if (!base) return [];
    const baseKeys = new Set(base.keys);
    const idField = key === 'clients' || key === 'drivers'
      ? 'cedula_rif'
      : (key === 'suppliers' || key === 'partners' ? 'rif' : null);
    const out = [];
    groups.forEach((group) => {
      if (group === base) return;
      const keys = new Set(group.keys);
      const missing = base.keys.filter((k) => !keys.has(k));
      const extra = group.keys.filter((k) => !baseKeys.has(k));
      group.rows.forEach(({ row, index }) => {
        const label = syncRowLabel(key, row, index);
        const issues = [];
        if (missing.length) issues.push('Le faltan: ' + missing.join(', '));
        if (extra.length) issues.push('Tiene de más: ' + extra.join(', '));
        const rawId = idField ? String(row[idField] || '').trim().toUpperCase() : '';
        if (rawId && !SYNC_ID_RE.test(rawId)) {
          const fixed = normalizeSyncId(rawId);
          issues.push('La cédula/RIF no cumple el formato' + (SYNC_ID_RE.test(fixed) ? '; debería ser ' + fixed : ' (V-12345678, E-12345678 o J-123456789)'));
        }
        out.push({
          id: label.id,
          name: label.name,
          issue: issues.join('. ') + '.'
        });
      });
    });
    return out;
  }

  function syncInvalidOriginDetails() {
    const rows = (NS.store.db && NS.store.db.entries) || [];
    if (!Array.isArray(rows)) return [];
    return rows.filter((entry) => !ACCOUNTING_ORIGINS.includes(String(entry.origen || ''))).map((entry, index) => {
      const label = syncRowLabel('entries', entry, index);
      return {
        id: label.id,
        name: label.name,
        issue: `El origen "${entry.origen || '(vacío)'}" no está permitido por el esquema remoto.`,
        detail: 'Orígenes permitidos: ' + ACCOUNTING_ORIGINS.join(', ') + '.'
      };
    });
  }

  function syncInvalidIdDetails(key) {
    const field = key === 'suppliers' || key === 'partners' ? 'rif' : 'cedula_rif';
    const rows = (NS.store.db && NS.store.db[key]) || [];
    if (!Array.isArray(rows)) return [];
    return rows.map((row, index) => ({ row, index }))
      .filter(({ row }) => {
        const raw = String(row[field] || '').trim().toUpperCase();
        return raw && !SYNC_ID_RE.test(raw);
      })
      .map(({ row, index }) => {
        const label = syncRowLabel(key, row, index);
        const fixed = normalizeSyncId(row[field]);
        return {
          id: label.id,
          name: label.name,
          issue: `La cédula/RIF "${row[field]}" no cumple el formato.`,
          detail: SYNC_ID_RE.test(fixed)
            ? `Debería ser ${fixed}.`
            : 'Use V-12345678, E-12345678 o J-123456789.'
        };
      });
  }

  function syncErrorRecords(key, error) {
    const e = String(error || '').toLowerCase();
    let records = [];
    if (e.includes('all object keys must match')) {
      records = syncKeyMismatchDetails(key);
    } else if (e.includes('violates check constraint') && e.includes('origen') && key === 'entries') {
      records = syncInvalidOriginDetails();
    } else if (e.includes('violates check constraint') && (e.includes('cedula_rif') || e.includes('rif')) && ['clients', 'drivers', 'suppliers', 'partners'].includes(key)) {
      records = syncInvalidIdDetails(key);
    }
    const seen = new Set();
    return records.filter((record) => {
      const sig = record.id + '|' + record.issue;
      if (seen.has(sig)) return false;
      seen.add(sig);
      return true;
    });
  }

  function renderSyncRecords(key, error, ui) {
    const records = syncErrorRecords(key, error);
    if (!records.length) return '';
    const shown = records.slice(0, 8);
    const remaining = records.length - shown.length;
    return `<div class="sync-record-block">
      <h5>${ui.icon('edit', 13)} Registros a corregir</h5>
      <div class="sync-record-list">
        ${shown.map((record) => `<div class="sync-record-item">
          <div class="sync-record-id">
            <strong>${ui.esc(record.id)}</strong>
            ${record.name ? `<span>${ui.esc(record.name)}</span>` : ''}
          </div>
          <p>${ui.esc(record.issue)}</p>
          ${record.detail ? `<small>${ui.esc(record.detail)}</small>` : ''}
        </div>`).join('')}
      </div>
      ${remaining ? `<p class="sync-record-more">y ${remaining} registro${remaining === 1 ? '' : 's'} más con el mismo problema.</p>` : ''}
    </div>`;
  }

  function syncStatusCell(key, configured, reportByKey, ui) {
    const result = reportByKey.get(key);
    if (result && !result.ok) {
      return `<button type="button" class="sync-status-btn" data-sync-table="${ui.esc(key)}" title="Ver el detalle del error">${ui.icon('alert', 12)} Error</button>`;
    }
    if (result && result.ok) return ui.badge('Sincronizado', 'success');
    return configured ? ui.badge('Listo', 'info') : ui.badge('Local', 'neutral');
  }

  function syncErrorHint(error) {
    const e = String(error || '').toLowerCase();
    if (e.includes('all object keys must match')) {
      return 'Hay registros de esta tabla con columnas distintas. El detalle de los registros afectados aparece abajo: revisa los campos faltantes o sobrantes.';
    }
    if (e.includes('violates check constraint') && e.includes('origen')) {
      return 'Uno o más asientos usan un origen que el esquema remoto no permite. Revisa el detalle de abajo y corrige el origen o actualiza el esquema SQL.';
    }
    if (e.includes('violates check constraint') && (e.includes('cedula_rif') || e.includes('rif'))) {
      return 'Una cédula o RIF no cumple el formato V-12345678, E-12345678 o J-123456789. El detalle del registro afectado aparece abajo.';
    }
    if (e.includes('violates check constraint')) {
      return 'Un registro no cumple una restricción del esquema remoto. Revisa los valores permitidos para esa tabla.';
    }
    if (e.includes('could not find the table') || (e.includes('could not find the') && e.includes('column'))) {
      return 'El esquema remoto está desactualizado. Ejecuta la versión actual de sql/supabase_schema.sql en Supabase.';
    }
    if (e.includes('duplicate key')) {
      return 'Hay una clave repetida. Revisa el registro duplicado en la tabla local.';
    }
    if (e.includes('foreign key')) {
      return 'El registro referencia un cliente, conductor, proveedor o cuenta que todavía no existe en Supabase. Sincroniza primero la tabla relacionada.';
    }
    if (e.includes('failed to fetch') || e.includes('network') || e.includes('tiempo de espera')) {
      return 'No se pudo completar la solicitud por un problema de red. Revisa la conexión y vuelve a intentar.';
    }
    return 'Revisa los datos de esta tabla y el mensaje técnico antes de volver a sincronizar.';
  }

  function scrollToSyncMap() {
    const el = document.getElementById('settings-section-sync');
    if (!el) return;
    const topbar = document.querySelector('.topbar');
    const offset = (topbar ? topbar.getBoundingClientRect().height : 72) + 18;
    const y = el.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
    document.querySelectorAll('.sync-focus').forEach((n) => n.classList.remove('sync-focus'));
    el.classList.add('sync-focus');
    setTimeout(() => el.classList.remove('sync-focus'), 1800);
  }

  function showSyncErrorSummary(report, focusKey) {
    const ui = NS.ui;
    let failed = (report || []).filter((r) => !r.ok);
    if (focusKey) failed = failed.filter((r) => r.key === focusKey);
    if (!failed.length) return null;
    const okCount = (report || []).filter((r) => r.ok).length;
    const plural = failed.length === 1 ? '' : 's';
    const okText = okCount
      ? `${okCount} tabla${okCount === 1 ? '' : 's'} se sincronizó${okCount === 1 ? '' : 'n'} correctamente.`
      : 'No se sincronizó ninguna otra tabla.';
    const focusLabel = focusKey ? syncReportLabel(focusKey) : '';
    const body = `
      <div class="sync-error-summary">
        <span class="sync-error-summary-ico">${ui.icon('alert', 22)}</span>
        <div>
          <strong>${failed.length} tabla${plural} no se pudo${failed.length === 1 ? '' : 'ieron'} sincronizar</strong>
          <p>${okText} Corrige los datos señalados antes de volver a pulsar <strong>Sincronizar ahora</strong>.</p>
        </div>
      </div>
      <div class="sync-error-list">
        ${failed.map((r) => {
          const count = syncLocalCount(r.key);
          return `<article class="sync-error-item">
            <div class="sync-error-head">
              <span class="sync-error-ico">${ui.icon('alert', 16)}</span>
              <div class="sync-error-title">
                <strong>${ui.esc(syncReportLabel(r.key))}</strong>
                <small class="mono">${ui.esc(r.table || r.key)}</small>
              </div>
              ${ui.badge(count + ' registro' + (count === 1 ? '' : 's'), 'neutral')}
            </div>
            <p class="sync-error-msg">${ui.esc(r.error || 'Error desconocido')}</p>
            <p class="sync-error-hint">${ui.icon('info', 13)}<span>${ui.esc(syncErrorHint(r.error))}</span></p>
            ${renderSyncRecords(r.key, r.error, ui)}
          </article>`;
        }).join('')}
      </div>`;
    document.querySelectorAll('#toast-root .toast').forEach((toast) => toast.remove());
    const overlay = ui.modal({
      title: focusKey ? `Error de sincronización · ${focusLabel}` : 'Errores de sincronización',
      eyebrow: 'Supabase · revisión requerida',
      subtitle: focusKey
        ? 'Detalle del registro que impide actualizar esta tabla. Corrige los datos y vuelve a sincronizar.'
        : 'Este es el detalle de las tablas rechazadas. Corrige los datos y vuelve a sincronizar.',
      size: 'lg',
      body,
      footer: `<button class="btn btn-ghost" data-sync-map>${ui.icon('database', 15)} Ver mapa de sincronización</button><button class="btn btn-primary" data-sync-close>${ui.icon('check', 15)} Entendido</button>`
    });
    overlay.querySelector('[data-sync-close]').addEventListener('click', () => ui.closeModal(overlay));
    overlay.querySelector('[data-sync-map]').addEventListener('click', () => {
      ui.closeModal(overlay);
      scrollToSyncMap();
    });
    return overlay;
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
    const reportByKey = new Map((lastReport || []).map((r) => [r.key, r]));
    const failedReports = (lastReport || []).filter((r) => !r.ok);
    const chatbotCfg = NS.chatbot ? NS.chatbot.getConfig() : { apiKey: '', model: 'gemini-3.5-flash', lastTest: null };
    const chatbotConfigured = !!(NS.chatbot && NS.chatbot.isConfigured());
    const chatbotAllowed = NS.chatbot ? NS.chatbot.allowedModules().map((key) => NS.chatbot.moduleLabel(key)) : [];
    const chatbotTest = chatbotTestResult || chatbotCfg.lastTest || null;
    const chatbotCanWrite = canWrite && !!NS.chatbot;
    const chatbotServer = !!(NS.chatbot && NS.chatbot.proxyState === true);
    const chatbotHealth = chatbotServer
      ? { label: 'Servidor', tone: 'success' }
      : (!chatbotConfigured
        ? { label: 'Sin configurar', tone: 'warning' }
        : (chatbotTest ? (chatbotTest.ok ? { label: 'Conectado', tone: 'success' } : { label: 'Requiere atención', tone: 'danger' }) : { label: 'Sin verificar', tone: 'info' }));

    // Leer sub-ruta del sidebar y desplazar a la sección correspondiente
    const sub = NS.router.getSubroute();
    if (sub && sub.module === 'settings') {
      const sectionMap = {
        'settings-params': 'settings-section-params',
        'settings-plans': 'settings-section-plans',
        'settings-events': 'settings-section-events',
        'settings-apis': 'settings-section-apis',
        'settings-chatbot': 'settings-section-chatbot',
        'settings-supabase': 'settings-section-supabase',
        'settings-status': 'settings-section-status',
        'settings-sync': 'settings-section-sync',
        'settings-backup': 'settings-section-backup'
      };
      const targetId = sectionMap[sub.sub];
      if (targetId) {
        setTimeout(() => {
          const el = document.getElementById(targetId);
          if (!el) return;
          const topbar = document.querySelector('.topbar');
          const offset = (topbar ? topbar.getBoundingClientRect().height : 72) + 18;
          const y = el.getBoundingClientRect().top + window.scrollY - offset;
          window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
          document.querySelectorAll('.section-focus').forEach((n) => n.classList.remove('section-focus'));
          el.classList.add('section-focus');
          setTimeout(() => el.classList.remove('section-focus'), 1800);
        }, 120);
      }
    }

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

      <section class="card card-span-2" id="settings-section-params">
        <div class="card-head"><div><h3>Parámetros de mantenimiento del sistema</h3><p>Tarifas, comisiones por nivel, planes, descuentos y beneficios parametrizables por módulo.</p></div>${NS.app.canAction('settings', 'parametros') ? `<button class="btn btn-primary btn-sm" id="params-new">${ui.icon('plus', 14)} Nuevo parámetro</button>` : ''}</div>
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th>Clave</th><th>Etiqueta</th><th>Módulo</th><th>Aplicación</th><th>Tipo</th><th class="num">Valor</th><th>Descripción</th><th class="actions-col">Acciones</th></tr></thead>
            <tbody>
              ${db.systemParams.length ? db.systemParams.map((p) => `<tr>
                <td><span class="mono strong">${ui.esc(p.key)}</span></td>
                <td>${ui.esc(p.label)}</td>
                <td>${ui.badge(p.module, 'info')}</td>
                <td>${p.nivel || p.tipo_plan ? ui.esc([p.nivel, p.tipo_plan === 'fijo' ? 'Tarifa fija' : p.tipo_plan === 'porcentaje' ? 'Tarifa porcentual' : ''].filter(Boolean).join(' · ')) : '—'}</td>
                <td>${ui.badge(p.tipo, 'info')}</td>
                <td class="num"><strong>${p.tipo === 'porcentaje' ? p.value + '%' : p.tipo === 'monto' ? '$' + p.value : p.value}</strong></td>
                <td>${ui.esc(p.descripcion || '—')}</td>
                <td class="actions-col">
                  ${NS.app.canAction('settings', 'parametros') ? `<button class="icon-btn" data-edit-param="${ui.esc(p.key)}" title="Editar">${ui.icon('edit', 16)}</button>` : ''}
                  ${NS.app.canAction('settings', 'parametros') ? `<button class="icon-btn danger" data-del-param="${ui.esc(p.key)}" title="Eliminar">${ui.icon('trash', 16)}</button>` : ''}
                </td>
              </tr>`).join('') : `<tr><td colspan="8">${ui.empty('settings', 'Sin parámetros', 'Crea el primer parámetro de mantenimiento del sistema.', NS.app.canAction('settings', 'parametros') ? '<button class="btn btn-primary" id="params-empty-new">Nuevo parámetro</button>' : '')}</td></tr>`}
            </tbody>
          </table>
        </div>
      </section>

      <section class="card card-span-2" id="settings-section-plans">
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

      <section class="card card-span-2" id="settings-section-events">
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

      <section class="card" id="settings-section-apis">
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

      <section class="card card-span-2" id="settings-section-chatbot">
        <div class="card-head">
          <div>
            <h3>Configuración de Asistente ChatBot</h3>
            <p>Conecta Google Gemini para consultas guiadas sobre la operación y el uso de ENVIA ERP.</p>
          </div>
          <div class="chatbot-config-status">${ui.badge(chatbotHealth.label, chatbotHealth.tone)}</div>
        </div>
        <div class="chatbot-config-grid">
          <form id="chatbot-form" class="form-grid" autocomplete="off">
            <label class="field field-full"><span>API Key de Google Gemini</span>
              <div class="secret-input">
                <input name="apiKey" id="chatbot-api-key" type="password" value="${chatbotCanWrite ? ui.esc(chatbotCfg.apiKey || '') : ''}" placeholder="${chatbotConfigured && !chatbotCanWrite ? 'Configurada en este navegador' : 'AIza...'}" ${chatbotCanWrite ? '' : 'disabled'}>
                ${chatbotCanWrite ? `<button type="button" class="icon-btn" id="toggle-chatbot-key" title="Mostrar u ocultar">${ui.icon('eye', 17)}</button>` : ''}
              </div>
              <small>Se guarda solo en este navegador (localStorage). No se envía a Supabase. En producción usa un proxy backend para no exponer la clave.</small>
            </label>
            <label class="field field-full"><span>Modelo</span>
              <input name="model" value="${ui.esc(chatbotCfg.model || 'gemini-3.5-flash')}" placeholder="gemini-3.5-flash" ${chatbotCanWrite ? '' : 'disabled'}>
              <small>Valor por defecto: <strong>gemini-3.5-flash</strong>. Si tu API Key no tiene acceso, prueba otro modelo disponible en Google AI Studio (por ejemplo <strong>gemini-3.5-flash-lite</strong> o <strong>gemini-3.1-flash-lite</strong>).</small>
            </label>
            <div class="field-full form-actions">
              ${chatbotCanWrite ? `<button type="button" class="btn btn-ghost" id="chatbot-test">${ui.icon('link', 15)} Probar conexión</button><button type="button" class="btn btn-primary" id="chatbot-save">${ui.icon('check', 15)} Guardar Credenciales IA</button>` : `<span class="readonly-chip">${ui.icon('eye', 13)} Solo lectura</span>`}
              <button type="button" class="btn btn-ghost" id="chatbot-open" data-chat-open>${ui.icon('sparkles', 15)} Abrir asistente</button>
            </div>
          </form>
          <aside class="chatbot-config-aside">
            <span class="chatbot-config-orb">${ui.icon('sparkles', 19)}</span>
            <strong>Asistente con contexto autorizado</strong>
            <p>El bot solo consulta los módulos habilitados para tu rol: ${chatbotAllowed.length ? ui.esc(chatbotAllowed.join(', ')) : 'ninguno'}. Las preguntas sobre módulos bloqueados se rechazan.</p>
            <div class="chatbot-config-meta"><span>Estado</span><strong>${chatbotServer ? 'Configurado en el servidor' : (chatbotConfigured ? 'Credenciales guardadas' : 'Pendiente de API Key')}</strong></div>
            <div class="chatbot-config-meta"><span>Modelo</span><strong>${ui.esc(chatbotServer ? 'Servidor (Gemini)' : (chatbotCfg.model || 'gemini-3.5-flash'))}</strong></div>
            <div class="chatbot-config-meta"><span>Última prueba</span><strong>${chatbotTest && chatbotTest.at ? ui.dateTime(chatbotTest.at) : '—'}</strong></div>
          </aside>
        </div>
        ${chatbotTest ? `<div class="chatbot-test-result ${chatbotTest.ok ? 'ok' : 'warn'}">${ui.icon(chatbotTest.ok ? 'check' : 'alert', 17)}<div><strong>${chatbotTest.ok ? 'Conexión verificada' : 'Conexión con observaciones'}</strong><span>${ui.esc(chatbotTest.message || '')}</span></div></div>` : ''}
        <p class="form-note">${ui.icon('shield', 14)} ${chatbotServer ? 'El asistente usa la clave configurada en el servidor: no se expone en el navegador ni se comparte con el repositorio.' : 'La clave se usa directamente desde este navegador hacia Google Gemini. No se sincroniza con Supabase ni se comparte con otros usuarios.'}</p>
      </section>

      <section class="card card-span-2" id="settings-section-supabase">
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

      <section class="card" id="settings-section-status">
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

      <section class="card" id="settings-section-sync">
        <div class="card-head"><div><h3>Mapa de sincronización</h3><p>Filas locales listas para upsert en PostgreSQL</p></div><div class="sync-head-chips"><span class="chip chip-navy">${ui.icon('database', 13)} ${db.entries.length} asientos</span>${failedReports.length ? ui.badge(failedReports.length + ' con error', 'danger') : ''}</div></div>
        ${failedReports.length ? `<div class="sync-map-alert">
          <span class="sync-map-alert-ico">${ui.icon('alert', 18)}</span>
          <div><strong>${failedReports.length} tabla${failedReports.length === 1 ? '' : 's'} no se ${failedReports.length === 1 ? 'actualizó' : 'actualizaron'} en Supabase</strong><span>Pulsa el estado <strong>Error</strong> de cada fila para ver el registro exacto que debes corregir.</span></div>
        </div>` : ''}
        <div class="table-wrap">
          <table class="data-table sync-table">
            <thead><tr><th>Tabla Supabase</th><th>Entidad local</th><th>Clave de conflicto</th><th class="num">Registros</th><th>Estado</th></tr></thead>
            <tbody>${TABLES.map(([key, label, conflict]) => {
              const count = key === 'entries' ? db.entries.length : (db[key] ? db[key].length : 0);
              const result = reportByKey.get(key);
              return `<tr class="${result && !result.ok ? 'sync-row-error' : ''}"><td class="mono">${ui.esc(key === 'entries' ? 'accounting_entries' : key === 'withholdings' ? 'withholding_vouchers' : key)}</td><td>${ui.esc(label)}</td><td class="mono">${ui.esc(conflict)}</td><td class="num"><strong>${count}</strong></td><td>${syncStatusCell(key, configured, reportByKey, ui)}</td></tr>`;
            }).join('')}${(() => {
              const result = reportByKey.get('tax_parameters');
              return `<tr class="${result && !result.ok ? 'sync-row-error' : ''}"><td class="mono">tax_parameters</td><td>Parámetros fiscales</td><td class="mono">id</td><td class="num"><strong>1</strong></td><td>${syncStatusCell('tax_parameters', configured, reportByKey, ui)}</td></tr>`;
            })()}</tbody>
          </table>
        </div>
        <div class="inline-actions">
          <button class="btn btn-ghost btn-sm" id="settings-pull" ${configured ? '' : 'disabled'}>${ui.icon('download', 14)} Descargar clientes y conductores</button>
          <span class="hint">La sincronización hace upsert por clave primaria y no elimina registros remotos.</span>
        </div>
        ${lastReport ? `<div class="sync-report">
          <div class="sync-report-head">
            <h4>Resultado de la última sincronización</h4>
            ${lastReport.some((r) => !r.ok) ? `<button class="btn btn-danger-ghost btn-xs" id="settings-sync-errors">${ui.icon('alert', 13)} Ver resumen de errores</button>` : ''}
          </div>
          <div class="sync-report-grid">
            ${lastReport.map((r) => `<div class="sync-report-row ${r.ok ? 'ok' : 'bad'}"><span>${ui.icon(r.ok ? 'check' : 'alert', 14)} ${ui.esc(r.table)}</span><strong>${r.ok ? r.count + ' registros' : ui.esc(r.error || 'Error')}</strong></div>`).join('')}
          </div>
        </div>` : ''}
      </section>

      <div class="dash-grid">
        <section class="card" id="settings-section-backup">
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
            <div class="status-row"><span>Versión</span><strong>ENVIA Technology C.A. 1.14.0</strong></div>
            <div class="status-row"><span>Moneda funcional</span><strong>VES (Bolívares)</strong></div>
            <div class="status-row"><span>Tasa BCV</span><strong>${ui.bs(db.taxParams.bcvRate)} / USD</strong></div>
            <div class="status-row"><span>Unidad Tributaria</span><strong>${ui.bs(db.taxParams.ut)}</strong></div>
            <div class="status-row"><span>IVA</span><strong>${db.taxParams.ivaGeneral}% general · ${db.taxParams.ivaReducido}% reducido</strong></div>
            <div class="status-row"><span>IGTF</span><strong>${db.taxParams.igtf}%</strong></div>
            <div class="status-row"><span>Asistente IA</span><strong>${chatbotConfigured ? 'Gemini configurado' : 'Pendiente de API Key'}</strong></div>
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

    /* Asistente ChatBot Gemini */
    const chatbotForm = $('#chatbot-form');
    const chatbotOpen = $('#chatbot-open');
    if (chatbotOpen) {
      chatbotOpen.addEventListener('click', () => {
        if (NS.chatbot) NS.chatbot.open();
        else ui.toast('El asistente no está disponible en esta carga.', 'warning');
      });
    }
    if (chatbotCanWrite && chatbotForm) {
      const toggleChatbotKey = $('#toggle-chatbot-key');
      if (toggleChatbotKey) {
        toggleChatbotKey.addEventListener('click', () => {
          const input = $('#chatbot-api-key');
          input.type = input.type === 'password' ? 'text' : 'password';
        });
      }
      const saveChatbot = $('#chatbot-save');
      if (saveChatbot) {
        saveChatbot.addEventListener('click', async () => {
          const apiKey = chatbotForm.elements.apiKey.value.trim();
          const model = chatbotForm.elements.model.value.trim() || 'gemini-3.5-flash';
          if (!apiKey) return ui.toast('Ingresa la API Key de Google Gemini.', 'warning');
          try {
            NS.chatbot.saveConfig({ apiKey, model });
          } catch (e) {
            return ui.toast(e.message, 'error');
          }
          ui.toast('Credenciales IA guardadas en este navegador.', 'success');
          ui.setBusy(saveChatbot, true, 'Comprobando...');
          try {
            chatbotTestResult = await NS.chatbot.probarConexion(apiKey, model);
            ui.toast(chatbotTestResult.message, chatbotTestResult.ok ? 'success' : 'warning');
          } catch (e) {
            chatbotTestResult = { ok: false, message: e.message, at: new Date().toISOString() };
            ui.toast(e.message, 'error');
          }
          render(view);
        });
      }
      const testChatbot = $('#chatbot-test');
      if (testChatbot) {
        testChatbot.addEventListener('click', async () => {
          const current = NS.chatbot.getConfig();
          const apiKey = chatbotForm.elements.apiKey.value.trim() || current.apiKey;
          const model = chatbotForm.elements.model.value.trim() || current.model || 'gemini-3.5-flash';
          if (!apiKey) return ui.toast('Ingresa la API Key de Google Gemini antes de probar.', 'warning');
          ui.setBusy(testChatbot, true, 'Probando...');
          try {
            chatbotTestResult = await NS.chatbot.probarConexion(apiKey, model);
            ui.toast(chatbotTestResult.message, chatbotTestResult.ok ? 'success' : 'warning');
          } catch (e) {
            chatbotTestResult = { ok: false, message: e.message, at: new Date().toISOString() };
            ui.toast(e.message, 'error');
          }
          render(view);
        });
      }
    }

    const syncErrorsBtn = $('#settings-sync-errors');
    if (syncErrorsBtn) syncErrorsBtn.addEventListener('click', () => showSyncErrorSummary(lastReport));
    view.querySelectorAll('[data-sync-table]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        showSyncErrorSummary(lastReport, btn.dataset.syncTable);
      });
    });

    $('#settings-sync').addEventListener('click', async () => {
      if (!NS.supabase.isConfigured()) return ui.toast('Primero configura Supabase.', 'warning');
      const btn = $('#settings-sync');
      ui.setBusy(btn, true, 'Sincronizando...');
      try {
        lastReport = await NS.supabase.syncAll();
        const failed = lastReport.filter((r) => !r.ok).length;
        render(view);
        if (failed) {
          showSyncErrorSummary(lastReport);
        } else {
          ui.toast('Todas las tablas se sincronizaron correctamente.', 'success');
        }
      } catch (e) {
        ui.toast(e.message, 'error');
      } finally {
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
        <label class="field"><span>Módulo *</span><select name="module" required>
          <option value="">Selecciona un módulo...</option>
          ${Object.values(NS.router.MODULES || {}).map((m) => `<option value="${m.module}" ${(p && p.module) === m.module ? 'selected' : ''}>${NS.ui.esc(m.label)}</option>`).join('')}
        </select>
        <small class="block muted">Elige el módulo al que pertenece este parámetro.</small>
        <label class="field"><span>Tipo *</span><select name="tipo">${['texto', 'monto', 'porcentaje', 'booleano', 'fecha'].map((t) => `<option value="${t}" ${(p && p.tipo) === t ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
        <label class="field"><span>Nivel (opcional)</span><select name="nivel">
          <option value="">Todos los niveles</option>
          ${NS.store.DRIVER_LEVELS.map((n) => `<option value="${n}" ${(p && p.nivel) === n ? 'selected' : ''}>${n}</option>`).join('')}
        </select><small>Úsalo para parámetros que aplican a un nivel específico.</small></label>
        <label class="field"><span>Tipo de plan (opcional)</span><select name="tipo_plan">
          <option value="">No aplica</option>
          <option value="fijo" ${(p && p.tipo_plan) === 'fijo' ? 'selected' : ''}>Tarifa fija</option>
          <option value="porcentaje" ${(p && p.tipo_plan) === 'porcentaje' ? 'selected' : ''}>Tarifa porcentual</option>
        </select><small>Vincula el parámetro al esquema de descuento del conductor.</small></label>
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
          nivel: form.elements.nivel.value,
          tipo_plan: form.elements.tipo_plan.value,
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
