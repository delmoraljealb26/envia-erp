/* =========================================================================
   ENVIA Technology C.A. · services/routerService.js
   Ruteo SPA, barra lateral, barra superior y tasa BCV. Contiene la
   navegación y la representación del shell; la lógica de negocio vive en
   store.js y las peticiones en supabaseService.js / exchangeRateService.js.
   ========================================================================= */
(function () {
  'use strict';

  const NS = (window.ENVIA = window.ENVIA || {});
  const $ = (s, r) => NS.ui.$(s, r);

  const MODULES = {
    dashboard: { label: 'Dashboard', sub: 'Visión ejecutiva de la operación ENVIA', icon: 'dashboard', group: 'Operación', module: 'dashboard' },
    services: { label: 'Servicios', sub: 'Carreras de taxi y encomiendas en vivo', icon: 'route', group: 'Operación', module: 'services' },
    clients: { label: 'Clientes', sub: 'Maestro de usuarios de la app · Cédula / RIF', icon: 'users', group: 'Maestros', module: 'clients' },
    drivers: { label: 'Conductores y Flota', sub: 'Aliados operativos, vehículos y expedientes', icon: 'car', group: 'Maestros', module: 'drivers' },
    partners: { label: 'Negocios Asociados', sub: 'Comercios aliados, comisiones y recaudaciones', icon: 'building', group: 'Operación', module: 'partners' },
    inventory: { label: 'Tienda & Inventario', sub: 'Uniformes, equipamiento y financiamiento al conductor', icon: 'package', group: 'Operación', module: 'inventory' },
    accounting: { label: 'Contabilidad', sub: 'Plan de cuentas, asientos y libros SENIAT', icon: 'book', group: 'Finanzas', module: 'accounting' },
    taxes: { label: 'Tributos & BCV', sub: 'IVA, IGTF, ISLR, unidad tributaria y retenciones', icon: 'percent', group: 'Finanzas', module: 'taxes' },
    payables: { label: 'Cuentas por Pagar', sub: 'Proveedores, facturas, retenciones y pagos', icon: 'wallet', group: 'Finanzas', module: 'payables' },
    audit: { label: 'Bitácora de Auditoría', sub: 'Quién modificó qué, cuándo y con qué usuario', icon: 'activity', group: 'Sistema', module: 'audit' },
    users: { label: 'Usuarios del sistema', sub: 'Roles, accesos y seguridad', icon: 'shield', group: 'Sistema', module: 'users' },
    settings: { label: 'Configuración del Sistema', sub: 'Conexión Supabase, parámetros y sincronización', icon: 'database', group: 'Sistema', module: 'settings' }
  };

  const GROUPS = ['Operación', 'Maestros', 'Finanzas', 'Sistema'];
  let currentRoute = 'dashboard';

  /* ----------------------------- Sesión/RBAC ----------------------------- */
  function can(module) {
    return NS.session.can(module);
  }
  function canTab(module, tab) {
    return NS.session.canTab(module, tab);
  }
  function canAction(module, action) {
    return NS.session.canAction(module, action);
  }
  function canWrite(module, action) {
    return NS.session.canWrite(module, action);
  }
  function isAdmin() {
    return NS.session.isAdmin();
  }

  /* ----------------------------- Shell: sidebar -------------------------- */
  function buildSidebar() {
    const nav = $('#sidebar-nav');
    if (!nav) return;
    const access = NS.store.accessFor(NS.session.getSession().rol, NS.session.getSession().usuario);
    nav.innerHTML = GROUPS.map((group) => {
      const items = Object.values(MODULES).filter((m) => m.group === group && (access.modules.includes('*') || access.modules.includes(m.module)));
      if (!items.length) return '';
      return `<div class="nav-group">
        <span class="nav-group-label">${NS.ui.esc(group)}</span>
        ${items.map((m) => {
          const count = navCount(m.module);
          return `<a href="#/${m.module}" class="nav-item" data-route="${m.module}">
            <span class="nav-ico">${NS.ui.icon(m.icon, 19)}</span>
            <span class="nav-label">${NS.ui.esc(m.label)}</span>
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

    const foot = $('.sidebar-foot');
    if (foot) {
      let logout = $('#sidebar-logout');
      if (!logout) {
        logout = document.createElement('button');
        logout.type = 'button';
        logout.id = 'sidebar-logout';
        logout.className = 'sidebar-logout';
        foot.appendChild(logout);
      }
      logout.innerHTML = NS.ui.icon('logout', 17) + ' <span>Cerrar sesión</span>';
      logout.onclick = () => NS.login.logoutRequest();
    }

    nav.querySelectorAll('a').forEach((a) => a.addEventListener('click', closeMobileNav));
  }

  function navCount(module) {
    const db = NS.store.db;
    if (module === 'clients') return db.clients.length;
    if (module === 'drivers') return db.drivers.length;
    if (module === 'payables') return db.payables.filter((p) => p.estatus !== 'Pagado').length;
    if (module === 'services') return db.services.filter((s) => s.fecha >= NS.store.iso(1)).length;
    if (module === 'partners') return db.partners.filter((p) => p.estatus === 'Activo').length;
    if (module === 'inventory') return db.products.filter((p) => p.activo && p.stock <= p.stock_min).length;
    return 0;
  }

  /* ----------------------------- Shell: topbar --------------------------- */
  function buildTopbar() {
    const bar = $('#topbar');
    if (!bar) return;
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
    const s = NS.session.getSession();
    bar.innerHTML = `
      <button class="icon-btn menu-toggle" id="menu-toggle" aria-label="Menú">${NS.ui.icon('menu', 21)}</button>
      <div class="topbar-title">
        <div class="crumb">ENVIA Technology C.A. <span>/</span> <span id="crumb-current">Dashboard</span></div>
        <h1 id="page-title">Dashboard</h1>
      </div>
      <div class="topbar-actions">
        <div class="rate-widget ${isHistoric ? 'rate-historic' : ''}" title="Tasa oficial del BCV · solo lectura (se actualiza desde DolarVZLA o por fecha)">
          <div class="rate-line">
            <span class="rate-value" id="bcv-rate-value">${NS.ui.icon('bank', 13)} Bs ${NS.ui.num(rate, 2)} <small>/ USD</small></span>
            ${canAction('taxes', 'editar') ? `<button type="button" id="bcv-calendar" class="rate-calendar" title="Seleccionar la tasa de una fecha">${NS.ui.icon('calendar', 14)}</button>` : ''}
            ${canAction('taxes', 'editar') ? `<button type="button" id="bcv-refresh" class="rate-refresh" title="Actualizar la tasa de hoy">${NS.ui.icon('refresh', 14)}</button>` : ''}
          </div>
          <span class="rate-date" title="${NS.ui.esc(updatedFull)} · ${NS.ui.esc(sourceLabel)}">${NS.ui.icon('clock', 11)} Tasa BCV · ${NS.ui.esc(updatedLabel)} · ${NS.ui.esc(sourceLabel)}</span>
        </div>
        <div class="currency-toggle" role="group" aria-label="Moneda de visualización">
          <button data-cur="USD" class="${NS.ui.currency() === 'USD' ? 'active' : ''}">USD</button>
          <button data-cur="VES" class="${NS.ui.currency() === 'VES' ? 'active' : ''}">VES</button>
        </div>
        <div class="user-menu-wrap">
          <button type="button" class="topbar-user" id="user-menu-toggle" title="${NS.ui.esc(s.nombre)} · ${NS.ui.esc(s.rol)}" aria-haspopup="menu" aria-expanded="false">
            ${NS.ui.avatar(s.nombre, 36)}
            <div><strong>${NS.ui.esc(s.nombre.split(' ').slice(0, 2).join(' '))}</strong><span>${NS.ui.esc(s.rol)}</span></div>
            <span class="user-menu-caret">${NS.ui.icon('chevronDown', 14)}</span>
          </button>
          <div class="user-menu" id="user-menu" role="menu" hidden>
            <div class="user-menu-head">
              ${NS.ui.avatar(s.nombre, 42)}
              <div><strong>${NS.ui.esc(s.nombre)}</strong><span>${NS.ui.esc(s.rol)}</span><small>${NS.ui.esc(s.usuario)}</small></div>
            </div>
            <button type="button" class="user-menu-item" data-menu-profile="${NS.ui.esc(s.usuario)}">${NS.ui.icon('user', 16)} Mi perfil</button>
            <button type="button" class="user-menu-item danger" id="user-menu-logout">${NS.ui.icon('logout', 16)} Cerrar sesión</button>
          </div>
        </div>
        <button class="icon-btn topbar-logout" id="topbar-logout" title="Cerrar sesión">${NS.ui.icon('logout', 19)}</button>
      </div>`;

    $('#menu-toggle').addEventListener('click', toggleMobileNav);
    $('#topbar-logout').addEventListener('click', NS.login.logoutRequest);

    const userToggle = $('#user-menu-toggle');
    const userMenu = $('#user-menu');
    if (userToggle && userMenu) {
      userToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        const open = userMenu.hidden;
        userMenu.hidden = !open;
        userToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
      $('#user-menu-logout').addEventListener('click', () => {
        userMenu.hidden = true;
        userToggle.setAttribute('aria-expanded', 'false');
        NS.login.logoutRequest();
      });
      const profile = userMenu.querySelector('[data-menu-profile]');
      if (profile) profile.addEventListener('click', () => {
        userMenu.hidden = true;
        userToggle.setAttribute('aria-expanded', 'false');
        if (typeof NS.modules.users === 'object' && NS.modules.users.openProfile) NS.modules.users.openProfile();
        else NS.ui.toast('Tu perfil se administra en Usuarios del sistema.', 'info');
      });
      if (!document.body.dataset.userMenuBound) {
        document.body.dataset.userMenuBound = '1';
        document.addEventListener('click', (ev) => {
          const menu = $('#user-menu');
          const toggle = $('#user-menu-toggle');
          if (!menu || menu.hidden) return;
          if (menu.contains(ev.target) || (toggle && toggle.contains(ev.target))) return;
          menu.hidden = true;
          if (toggle) toggle.setAttribute('aria-expanded', 'false');
        });
      }
    }
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

  /* --------------------- Tasa BCV: DolarVZLA (solo lectura) -------------- */
  async function refreshRateFromApi(btn) {
    if (!NS.exchangeRate) return NS.ui.toast('Servicio de tasa BCV no disponible.', 'error');
    NS.ui.setBusy(btn, true, '');
    try {
      const res = await NS.errors.capture(() => NS.exchangeRate.fetchBcvRate({ force: true }), 'Actualizar tasa BCV');
      NS.ui.setBusy(btn, false);
      if (res && res.ok) {
        NS.ui.toast(`Tasa BCV vigente: ${NS.ui.bs(res.rate)} / USD · ${res.fuente}.`, 'success');
        buildTopbar();
        renderRoute(true);
      } else if (res) {
        const actual = NS.ui.bs(NS.exchangeRate.getActiveRate());
        NS.ui.toast(`No se pudo actualizar la tasa automática. Se mantiene la última tasa conocida (${actual}).`, 'warning');
      }
    } catch (e) {
      NS.ui.setBusy(btn, false);
      NS.errors.fail(e, 'Actualizar tasa BCV');
    }
  }

  async function openRateCalendar() {
    if (!canAction('taxes', 'editar')) return NS.ui.toast('Tu rol es de solo lectura: no puedes cambiar la tasa BCV.', 'warning');
    if (!NS.exchangeRate) return NS.ui.toast('Servicio de tasa BCV no disponible.', 'error');

    const trigger = $('#bcv-calendar');
    if (trigger) NS.ui.setBusy(trigger, true, '');
    let available = [];
    try {
      const fetched = await NS.errors.capture(() => NS.exchangeRate.getAvailableDates(), 'Calendario de tasas BCV');
      available = Array.isArray(fetched) ? fetched : [];
    } finally {
      if (trigger) NS.ui.setBusy(trigger, false);
    }

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
      try {
        const res = await NS.errors.capture(() => NS.exchangeRate.fetchBcvRate({ force: true }), 'Tasa de hoy');
        NS.ui.setBusy(btn, false);
        if (!res || !res.ok) return NS.ui.toast(`No se pudo obtener la tasa de hoy: ${res && res.error ? res.error : 'error de red'}.`, 'error');
        closeWith();
        NS.ui.toast(`Tasa BCV vigente aplicada: ${NS.ui.bs(res.rate)} / USD.`, 'success');
        buildTopbar();
        renderRoute(true);
      } catch (err) {
        NS.ui.setBusy(btn, false);
        NS.errors.fail(err, 'Tasa de hoy');
      }
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
      try {
        const res = await NS.errors.capture(() => NS.exchangeRate.fetchBcvRateByDate(target), 'Tasa por fecha');
        NS.ui.setBusy(btn, false);
        if (!res || !res.ok) return NS.ui.toast(res && res.error ? res.error : 'No se pudo obtener la tasa.', 'error');
        closeWith();
        NS.ui.toast(`Tasa BCV del ${NS.ui.date(res.fecha)} aplicada: ${NS.ui.bs(res.rate)} / USD.`, 'success');
        buildTopbar();
        renderRoute(true);
      } catch (err) {
        NS.ui.setBusy(btn, false);
        NS.errors.fail(err, 'Tasa por fecha');
      }
    });
  }

  /* ------------------------------ Nav móvil ------------------------------ */
  function toggleMobileNav() {
    $('#sidebar').classList.toggle('mobile-open');
    $('#sidebar-overlay').classList.toggle('show');
  }
  function closeMobileNav() {
    $('#sidebar').classList.remove('mobile-open');
    $('#sidebar-overlay').classList.remove('show');
  }

  /* ------------------------------- Router -------------------------------- */
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
    if (!NS.session.getSession()) return;
    const route = routeOverride || (location.hash || '').replace(/^#\/?/, '').split('?')[0] || 'dashboard';
    if (!MODULES[route] || !can(route)) return navigate('dashboard', true);
    currentRoute = route;
    const meta = MODULES[route];
    $('#crumb-current').textContent = meta.label;
    $('#page-title').textContent = meta.label;
    document.title = meta.label + ' · ENVIA Technology C.A.';
    document.querySelectorAll('#sidebar-nav .nav-item').forEach((a) => a.classList.toggle('active', a.dataset.route === route));

    const view = $('#view');
    view.innerHTML = `<div class="view-loading"><span class="spinner dark"></span><span>Cargando ${NS.ui.esc(meta.label)}...</span></div>`;
    try {
      const mod = NS.modules[meta.module];
      if (!mod || typeof mod.render !== 'function') throw new Error('Módulo no disponible.');
      view.innerHTML = '';
      mod.render(view);

      // Centro de reportes común a todos los módulos.
      if (NS.reports && NS.reports.has(route) && canAction(route, 'reportes')) {
        const actions = view.querySelector('.page-head .page-actions');
        if (actions && !actions.querySelector('[data-module-reports]')) {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'btn btn-ghost';
          btn.id = 'module-reports-btn';
          btn.dataset.moduleReports = route;
          btn.innerHTML = NS.ui.icon('chart', 16) + ' Reportes';
          btn.title = 'Abrir el centro de reportes de este módulo';
          actions.insertBefore(btn, actions.firstChild);
        }
      }

      view.classList.remove('view-enter');
      void view.offsetWidth;
      view.classList.add('view-enter');
      if (!force) window.scrollTo({ top: 0, behavior: 'instant' });
    } catch (err) {
      NS.errors.fail(err, 'Cargar módulo ' + meta.label);
      view.innerHTML = `<div class="card"><div class="empty-state"><span class="empty-ico">${NS.ui.icon('alert', 28)}</span><h3>No se pudo cargar el módulo</h3><p>${NS.ui.esc(err.message)}</p><button class="btn btn-primary" onclick="location.reload()">Recargar sistema</button></div></div>`;
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

  function init() {
    window.addEventListener('hashchange', () => {
      if (!NS.session.getSession()) return;
      const route = (location.hash || '').replace(/^#\/?/, '') || 'dashboard';
      if (route !== currentRoute) renderRoute(false, route);
    });
    window.addEventListener('resize', () => { if (window.innerWidth > 1100) closeMobileNav(); });
  }

  NS.router = {
    MODULES,
    GROUPS,
    can,
    canTab,
    canAction,
    canWrite,
    isAdmin,
    navigate,
    renderRoute,
    refresh,
    buildSidebar,
    buildTopbar,
    navCount,
    toggleMobileNav,
    closeMobileNav,
    refreshRateFromApi,
    openRateCalendar,
    init
  };
})();
