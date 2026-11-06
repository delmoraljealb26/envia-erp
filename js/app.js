/* =========================================================================
   ENVIA ERP · app.js
   Arranque, login corporativo, sesión, RBAC, navegación SPA y barra superior.
   ========================================================================= */
(function () {
  'use strict';

  const NS = (window.ENVIA = window.ENVIA || {});
  const SESSION_KEY = 'envia_session';
  const MAX_AGE = 12 * 60 * 60 * 1000; // 12 horas

  const MODULES = {
    dashboard: { label: 'Dashboard', sub: 'Visión ejecutiva de la operación ENVIA', icon: 'dashboard', group: 'Operación', module: 'dashboard' },
    services: { label: 'Servicios', sub: 'Carreras de taxi y encomiendas en vivo', icon: 'route', group: 'Operación', module: 'services' },
    clients: { label: 'Clientes', sub: 'Maestro de usuarios de la app · Cédula / RIF', icon: 'users', group: 'Maestros', module: 'clients' },
    drivers: { label: 'Conductores y Flota', sub: 'Aliados operativos, vehículos y expedientes', icon: 'car', group: 'Maestros', module: 'drivers' },
    accounting: { label: 'Contabilidad', sub: 'Plan de cuentas, asientos y libros SENIAT', icon: 'book', group: 'Finanzas', module: 'accounting' },
    taxes: { label: 'Tributos & BCV', sub: 'IVA, IGTF, ISLR, unidad tributaria y retenciones', icon: 'percent', group: 'Finanzas', module: 'taxes' },
    payables: { label: 'Cuentas por Pagar', sub: 'Proveedores, facturas, retenciones y pagos', icon: 'wallet', group: 'Finanzas', module: 'payables' },
    audit: { label: 'Bitácora de Auditoría', sub: 'Quién modificó qué, cuándo y con qué usuario', icon: 'activity', group: 'Sistema', module: 'audit' },
    users: { label: 'Usuarios del ERP', sub: 'Roles, accesos y seguridad', icon: 'shield', group: 'Sistema', module: 'users' },
    settings: { label: 'Configuración Supabase', sub: 'Conexión, almacenamiento y sincronización', icon: 'database', group: 'Sistema', module: 'settings' }
  };

  const GROUPS = ['Operación', 'Maestros', 'Finanzas', 'Sistema'];
  let session = null;
  let currentRoute = 'dashboard';

  const $ = (s, r) => NS.ui.$(s, r);

  /* ----------------------------- Sesión ----------------------------- */
  function readSession() {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY) || localStorage.getItem('envia_last_session');
      if (!raw) return null;
      const s = JSON.parse(raw);
      if (!s || !s.usuario) return null;
      if (Date.now() - new Date(s.loginAt).getTime() > MAX_AGE) return null;
      return s;
    } catch (e) { return null; }
  }

  function saveSession(user) {
    session = {
      usuario: user.usuario,
      nombre: user.nombre,
      rol: user.rol,
      correo: user.correo,
      loginAt: new Date().toISOString()
    };
    try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(session)); } catch (e) {}
    try { localStorage.setItem('envia_last_session', JSON.stringify(session)); } catch (e) {}
  }

  function clearSession() {
    session = null;
    try { sessionStorage.removeItem(SESSION_KEY); } catch (e) {}
    try { localStorage.removeItem('envia_last_session'); } catch (e) {}
  }

  /* ------------------------------ Login ------------------------------ */
  let attempts = 0;
  let lockedUntil = 0;

  function showLogin() {
    $('#app-shell').classList.add('hidden');
    $('#login-screen').classList.remove('hidden');
    document.body.classList.add('on-login');
    const form = $('#login-form');
    if (form) {
      form.elements.usuario.value = '';
      form.elements.password.value = '';
      const err = $('#login-error');
      err.classList.add('hidden');
      err.textContent = '';
      setTimeout(() => form.elements.usuario.focus(), 100);
    }
    updateLoginClock();
  }

  function updateLoginClock() {
    const el = $('#login-date');
    if (el) {
      el.textContent = new Date().toLocaleDateString('es-VE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
    }
  }

  function bindLogin() {
    const form = $('#login-form');
    const toggle = $('#toggle-pass');
    const input = form.elements.password;
    const err = $('#login-error');

    toggle.addEventListener('click', () => {
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      toggle.innerHTML = NS.ui.icon(show ? 'x' : 'eye', 18);
      toggle.setAttribute('aria-label', show ? 'Ocultar clave' : 'Mostrar clave');
    });

    document.querySelectorAll('[data-fill-demo]').forEach((btn) => {
      btn.addEventListener('click', () => {
        form.elements.usuario.value = 'ENVIA';
        form.elements.password.value = '123456789';
        input.focus();
        NS.ui.toast('Credenciales maestras cargadas. Presiona “Ingresar al ERP”.', 'info');
      });
    });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (Date.now() < lockedUntil) {
        const secs = Math.ceil((lockedUntil - Date.now()) / 1000);
        return showLoginError(`Demasiados intentos. Espera ${secs} segundos.`);
      }
      const usuario = form.elements.usuario.value.trim();
      const password = form.elements.password.value;
      if (!usuario || !password) return showLoginError('Ingresa tu usuario y clave de acceso.');
      const btn = $('#login-submit');
      NS.ui.setBusy(btn, true, 'Validando...');
      setTimeout(() => {
        try {
          const user = NS.store.authenticate(usuario, password);
          attempts = 0;
          saveSession(user);
          startApp();
          NS.ui.toast(`Bienvenido, ${user.nombre}. Sesión ${user.rol}.`, 'success');
        } catch (ex) {
          attempts++;
          if (attempts >= 5) {
            lockedUntil = Date.now() + 30000;
            attempts = 0;
            showLoginError('Demasiados intentos fallidos. Bloqueo temporal de 30 segundos.');
          } else {
            showLoginError(ex.message + ` (intento ${attempts} de 5)`);
          }
        } finally {
          NS.ui.setBusy(btn, false);
        }
      }, 260);
    });
  }

  function showLoginError(msg) {
    const err = $('#login-error');
    err.textContent = msg;
    err.classList.remove('hidden');
    err.classList.remove('shake');
    void err.offsetWidth;
    err.classList.add('shake');
  }

  /* ------------------------------ Shell ------------------------------ */
  function startApp() {
    if (!session) return showLogin();
    document.body.classList.remove('on-login');
    $('#login-screen').classList.add('hidden');
    $('#app-shell').classList.remove('hidden');
    buildSidebar();
    buildTopbar();
    const requested = (location.hash || '').replace(/^#\/?/, '') || 'dashboard';
    navigate(requested, true);
    // Tasa oficial BCV: se actualiza automáticamente al iniciar sesión.
    if (NS.exchangeRate && typeof NS.exchangeRate.start === 'function') NS.exchangeRate.start();
  }

  function can(module) {
    return session ? NS.store.can(session.rol, module) : false;
  }
  function canWrite() {
    return session ? NS.store.canWrite(session.rol) : false;
  }

  function buildSidebar() {
    const nav = $('#sidebar-nav');
    const access = NS.store.accessFor(session.rol);
    nav.innerHTML = GROUPS.map((group) => {
      const items = Object.values(MODULES).filter((m) => m.group === group && (access.modules.includes('*') || access.modules.includes(m.module)));
      if (!items.length) return '';
      return `<div class="nav-group">
        <span class="nav-group-label">${group}</span>
        ${items.map((m) => {
          const count = navCount(m.module);
          return `<a href="#/${m.module}" class="nav-item" data-route="${m.module}">
            <span class="nav-ico">${NS.ui.icon(m.icon, 19)}</span>
            <span class="nav-label">${m.label}</span>
            ${count ? `<span class="nav-count">${count}</span>` : ''}
          </a>`;
        }).join('')}
      </div>`;
    }).join('');

    const sb = NS.supabase.isConfigured();
    const status = $('#sidebar-status');
    if (status) {
      status.innerHTML = `<span class="dot ${sb ? 'dot-ok' : 'dot-idle'}"></span>${sb ? 'Supabase conectado' : 'Modo local · sin Supabase'}`;
    }

    nav.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => closeMobileNav()));
  }

  function navCount(module) {
    const db = NS.store.db;
    if (module === 'clients') return db.clients.length;
    if (module === 'drivers') return db.drivers.length;
    if (module === 'payables') return db.payables.filter((p) => p.estatus !== 'Pagado').length;
    if (module === 'services') return db.services.filter((s) => s.fecha >= NS.store.iso(1)).length;
    return 0;
  }

  function buildTopbar() {
    const bar = $('#topbar');
    const meta = NS.exchangeRate ? NS.exchangeRate.getMeta() : { fuente: 'local', mode: 'current' };
    const rate = (NS.exchangeRate ? NS.exchangeRate.getActiveRate() : 0) || NS.store.db.taxParams.bcvRate;
    const fuente = meta.fuente || 'local';
    const isHistoric = meta.mode === 'date';
    const sourceLabel = fuente === 'DolarVZLA'
      ? (isHistoric ? 'histórica' : 'DolarVZLA')
      : (fuente === 'manual' ? 'manual' : 'local');
    const updatedRaw = meta.fecha || NS.store.db.taxParams.bcvUpdatedAt;
    const updatedLabel = NS.ui.date(updatedRaw);
    const updatedFull = meta.stamp ? NS.ui.dateTime(updatedRaw) : updatedLabel;
    bar.innerHTML = `
      <button class="icon-btn menu-toggle" id="menu-toggle" aria-label="Menú">${NS.ui.icon('menu', 21)}</button>
      <div class="topbar-title">
        <div class="crumb">ENVIA ERP <span>/</span> <span id="crumb-current">Dashboard</span></div>
        <h1 id="page-title">Dashboard</h1>
      </div>
      <div class="topbar-actions">
        <div class="rate-widget ${isHistoric ? 'rate-historic' : ''}" title="Tasa oficial del BCV · solo lectura (se actualiza desde DolarVZLA o por fecha)">
          <div class="rate-line">
            <span class="rate-value" id="bcv-rate-value">${NS.ui.icon('bank', 13)} Bs ${NS.ui.num(rate, 2)} <small>/ USD</small></span>
            ${canWrite() ? `<button type="button" id="bcv-calendar" class="rate-calendar" title="Seleccionar la tasa de una fecha">${NS.ui.icon('calendar', 14)}</button>` : ''}
            ${canWrite() ? `<button type="button" id="bcv-refresh" class="rate-refresh" title="Actualizar la tasa de hoy">${NS.ui.icon('refresh', 14)}</button>` : ''}
          </div>
          <span class="rate-date" title="${NS.ui.esc(updatedFull)} · ${NS.ui.esc(sourceLabel)}">${NS.ui.icon('clock', 11)} Tasa BCV · ${NS.ui.esc(updatedLabel)} · ${NS.ui.esc(sourceLabel)}</span>
        </div>
        <div class="currency-toggle" role="group" aria-label="Moneda de visualización">
          <button data-cur="USD" class="${NS.ui.currency() === 'USD' ? 'active' : ''}">USD</button>
          <button data-cur="VES" class="${NS.ui.currency() === 'VES' ? 'active' : ''}">VES</button>
        </div>
        <div class="topbar-user" title="${NS.ui.esc(session.nombre)} · ${NS.ui.esc(session.rol)}">
          ${NS.ui.avatar(session.nombre, 36)}
          <div><strong>${NS.ui.esc(session.nombre.split(' ').slice(0, 2).join(' '))}</strong><span>${NS.ui.esc(session.rol)}</span></div>
        </div>
        <button class="icon-btn topbar-logout" id="topbar-logout" title="Cerrar sesión">${NS.ui.icon('logout', 19)}</button>
      </div>`;

    $('#menu-toggle').addEventListener('click', toggleMobileNav);
    $('#topbar-logout').addEventListener('click', logoutRequest);
    const refresh = $('#bcv-refresh');
    if (refresh) refresh.addEventListener('click', () => refreshRateFromApi(refresh));
    const calendar = $('#bcv-calendar');
    if (calendar) calendar.addEventListener('click', () => openRateCalendar());
    bar.querySelectorAll('[data-cur]').forEach((b) => b.addEventListener('click', () => {
      NS.store.setPrefs({ currency: b.dataset.cur });
      buildTopbar();
      renderRoute(true);
    }));
  }

  /* --------------------- Tasa BCV: DolarVZLA (solo lectura) --------------- */
  async function refreshRateFromApi(btn) {
    if (!NS.exchangeRate) return NS.ui.toast('Servicio de tasa BCV no disponible.', 'error');
    NS.ui.setBusy(btn, true, '');
    const res = await NS.exchangeRate.fetchBcvRate({ force: true });
    NS.ui.setBusy(btn, false);
    if (res.ok) {
      NS.ui.toast(`Tasa BCV vigente: ${NS.ui.bs(res.rate)} / USD · ${res.fuente}.`, 'success');
      buildTopbar();
      renderRoute(true);
    } else {
      const actual = NS.ui.bs(NS.exchangeRate.getActiveRate());
      NS.ui.toast(`No se pudo actualizar la tasa automática. Se mantiene la última tasa conocida (${actual}).`, 'warning');
    }
  }

  async function openRateCalendar() {
    if (!canWrite()) return NS.ui.toast('Tu rol es de solo lectura: no puedes cambiar la tasa BCV.', 'warning');
    if (!NS.exchangeRate) return NS.ui.toast('Servicio de tasa BCV no disponible.', 'error');

    const trigger = $('#bcv-calendar');
    if (trigger) NS.ui.setBusy(trigger, true, '');
    const dates = await NS.exchangeRate.getAvailableDates();
    if (trigger) NS.ui.setBusy(trigger, false);

    const available = Array.isArray(dates) ? dates : [];
    const today = new Date().toISOString().slice(0, 10);
    const max = available[0] || today;
    const min = available.length ? available[available.length - 1] : '';
    const meta = NS.exchangeRate.getMeta();
    const selected = meta.mode === 'date' && /^\d{4}-\d{2}-\d{2}/.test(meta.fecha)
      ? meta.fecha.slice(0, 10)
      : max;

    const overlay = NS.ui.modal({
      title: 'Tasa BCV por fecha',
      subtitle: 'Consulta el histórico oficial del BCV. La tasa seleccionada se aplicará a todos los cálculos.',
      size: 'sm',
      body: `
        <form id="rate-date-form" class="rate-date-form">
          <label class="field"><span>Fecha de la tasa</span>
            <input type="date" name="fecha" id="rate-date-input" value="${selected}" ${min ? `min="${min}"` : ''} max="${max}">
          </label>
          <p class="form-note">${NS.ui.icon('info', 14)} ${available.length
            ? `Fechas con tasa publicada: del ${NS.ui.date(min)} al ${NS.ui.date(max)}.`
            : 'No se pudo obtener el calendario de fechas; puedes intentar con una fecha laborable.'}</p>
        </form>`,
      footer: `<button class="btn btn-ghost" data-close-modal>Cancelar</button>
               <button class="btn btn-ghost" id="rate-date-today">${NS.ui.icon('refresh', 15)} Tasa de hoy</button>
               <button class="btn btn-primary" id="rate-date-apply">${NS.ui.icon('check', 15)} Aplicar tasa</button>`
    });

    const closeWith = () => NS.ui.closeModal(overlay);

    overlay.querySelector('#rate-date-today').addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      NS.ui.setBusy(btn, true, 'Consultando...');
      const res = await NS.exchangeRate.fetchBcvRate({ force: true });
      NS.ui.setBusy(btn, false);
      if (!res.ok) return NS.ui.toast(`No se pudo obtener la tasa de hoy: ${res.error || 'error de red'}.`, 'error');
      closeWith();
      NS.ui.toast(`Tasa BCV vigente aplicada: ${NS.ui.bs(res.rate)} / USD.`, 'success');
      buildTopbar();
      renderRoute(true);
    });

    overlay.querySelector('#rate-date-apply').addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      const input = overlay.querySelector('#rate-date-input');
      const value = input.value;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return NS.ui.toast('Selecciona una fecha válida.', 'error');

      let target = value;
      if (available.length && !available.includes(value)) {
        const closestPrevious = available.find((d) => d <= value);
        if (!closestPrevious) return NS.ui.toast('No hay tasa publicada en o antes de esa fecha.', 'error');
        target = closestPrevious;
        NS.ui.toast(`No hubo tasa el ${NS.ui.date(value)}; se usará la más cercana: ${NS.ui.date(target)}.`, 'info');
      }

      NS.ui.setBusy(btn, true, 'Consultando...');
      const res = await NS.exchangeRate.fetchBcvRateByDate(target);
      NS.ui.setBusy(btn, false);
      if (!res.ok) return NS.ui.toast(res.error, 'error');
      closeWith();
      NS.ui.toast(`Tasa BCV del ${NS.ui.date(res.fecha)} aplicada: ${NS.ui.bs(res.rate)} / USD.`, 'success');
      buildTopbar();
      renderRoute(true);
    });
  }

  function toggleMobileNav() {
    $('#sidebar').classList.toggle('mobile-open');
    $('#sidebar-overlay').classList.toggle('show');
  }
  function closeMobileNav() {
    $('#sidebar').classList.remove('mobile-open');
    $('#sidebar-overlay').classList.remove('show');
  }

  function logoutRequest() {
    NS.ui.confirm({
      title: 'Cerrar sesión',
      message: 'Se cerrará tu sesión segura y volverás a la pantalla de acceso corporativo. ¿Deseas continuar?',
      confirmText: 'Cerrar sesión',
      danger: true
    }).then((ok) => {
      if (!ok) return;
      NS.ui.closeAllModals();
      clearSession();
      showLogin();
      NS.ui.toast('Sesión finalizada de forma segura.', 'info');
    });
  }

  /* ----------------------------- Router ------------------------------ */
  function navigate(route, replace) {
    const clean = String(route || 'dashboard').replace(/^#?\/?/, '').split('?')[0];
    if (!MODULES[clean] || !can(clean)) {
      const routeOk = Object.keys(MODULES).find((r) => can(r)) || 'dashboard';
      if (replace) {
        history.replaceState(null, '', '#/' + routeOk);
        return renderRoute(true, routeOk);
      }
      NS.ui.toast('No tienes permisos para acceder a ese módulo.', 'warning');
      return navigate(routeOk, true);
    }
    if (location.hash !== '#/' + clean) history.pushState(null, '', '#/' + clean);
    renderRoute(false, clean);
  }

  function renderRoute(force, routeOverride) {
    if (!session) return;
    const route = routeOverride || (location.hash || '').replace(/^#\/?/, '').split('?')[0] || 'dashboard';
    if (!MODULES[route] || !can(route)) return navigate('dashboard', true);
    currentRoute = route;
    const meta = MODULES[route];
    $('#crumb-current').textContent = meta.label;
    $('#page-title').textContent = meta.label;
    document.title = meta.label + ' · ENVIA ERP';
    document.querySelectorAll('#sidebar-nav .nav-item').forEach((a) => a.classList.toggle('active', a.dataset.route === route));

    const view = $('#view');
    view.innerHTML = `<div class="view-loading"><span class="spinner dark"></span><span>Cargando ${NS.ui.esc(meta.label)}...</span></div>`;
    try {
      const mod = NS.modules[meta.module];
      if (!mod || typeof mod.render !== 'function') throw new Error('Módulo no disponible.');
      view.innerHTML = '';
      mod.render(view);
      view.classList.remove('view-enter');
      void view.offsetWidth;
      view.classList.add('view-enter');
      if (!force) window.scrollTo({ top: 0, behavior: 'instant' });
    } catch (err) {
      console.error('ENVIA módulo', route, err);
      view.innerHTML = `<div class="card"><div class="empty-state"><span class="empty-ico">${NS.ui.icon('alert', 28)}</span><h3>No se pudo cargar el módulo</h3><p>${NS.ui.esc(err.message)}</p><button class="btn btn-primary" onclick="location.reload()">Recargar ERP</button></div></div>`;
    }
  }

  function refresh(keepScroll) {
    renderRoute(true);
    if (!keepScroll) window.scrollTo({ top: 0, behavior: 'instant' });
    buildSidebar();
    const nav = $('#sidebar-nav');
    if (nav) {
      const active = nav.querySelector('.nav-item.active');
      if (active) active.classList.add('active');
    }
  }

  /* ---------------------------- Arranque ---------------------------- */
  window.addEventListener('hashchange', () => {
    if (!session) return;
    const route = (location.hash || '').replace(/^#\/?/, '') || 'dashboard';
    if (route !== currentRoute) renderRoute(false, route);
  });

  window.addEventListener('resize', () => { if (window.innerWidth > 1100) closeMobileNav(); });

  /* Eventos de la integración DolarAPI BCV */
  document.addEventListener('envia:rate-updated', () => {
    if (!session) return;
    buildTopbar();
    renderRoute(true);
  });
  document.addEventListener('envia:rate-error', () => {
    if (!session) return;
    const actual = NS.exchangeRate ? NS.ui.bs(NS.exchangeRate.getActiveRate()) : '—';
    NS.ui.toast(`No se pudo actualizar la tasa automática. Se mantiene la última tasa conocida (${actual}).`, 'warning');
  });

  window.addEventListener('error', (e) => {
    if (NS.ui && e.message) console.error('ENVIA global', e.error || e.message);
  });

  document.addEventListener('DOMContentLoaded', () => {
    bindLogin();
    updateLoginClock();
    const btnManual = document.getElementById('btn-manual');
    if (btnManual) btnManual.addEventListener('click', () => { location.href = 'manual.html'; });
    const existing = readSession();
    if (existing) {
      try {
        const live = NS.store.db.users.find((u) => u.usuario === existing.usuario && u.activo);
        if (live) {
          session = { ...existing, nombre: live.nombre, rol: live.rol };
          startApp();
          return;
        }
      } catch (e) { /* ignore */ }
    }
    showLogin();
  });

  NS.app = {
    navigate,
    refresh,
    logout: logoutRequest,
    get session() { return session; },
    can,
    canWrite,
    MODULES
  };
  NS.modules = NS.modules || {};
})();
