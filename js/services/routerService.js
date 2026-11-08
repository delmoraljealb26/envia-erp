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
    dashboard: { label: 'Dashboard', sub: 'Visión ejecutiva de la operación ENVIA', icon: 'dashboard', group: 'Operación', module: 'dashboard', subitems: null },
    services: { label: 'Servicios', sub: 'Carreras de taxi y encomiendas en vivo', icon: 'route', group: 'Operación', module: 'services', subitems: [
      { id: 'services-list', label: 'Listado de servicios', icon: 'route', action: 'ver' },
      { id: 'services-new', label: 'Nuevo servicio', icon: 'plus', action: 'crear' },
      { id: 'services-reports', label: 'Reportes', icon: 'chart', action: 'reportes' }
    ] },
    clients: { label: 'Clientes', sub: 'Maestro de usuarios de la app · Cédula / RIF', icon: 'users', group: 'Maestros', module: 'clients', subitems: [
      { id: 'clients-list', label: 'Listado de clientes', icon: 'users', action: 'ver' },
      { id: 'clients-new', label: 'Nuevo cliente', icon: 'plus', action: 'crear' },
      { id: 'clients-reports', label: 'Reportes', icon: 'chart', action: 'reportes' }
    ] },
    drivers: { label: 'Conductores y Flota', sub: 'Aliados operativos, vehículos y expedientes', icon: 'car', group: 'Maestros', module: 'drivers', subitems: [
      { id: 'drivers-list', label: 'Maestro de conductores', icon: 'car', action: 'ver' },
      { id: 'drivers-new', label: 'Nuevo conductor', icon: 'plus', action: 'crear' },
      { id: 'drivers-reports', label: 'Reportes', icon: 'chart', action: 'reportes' }
    ] },
    partners: { label: 'Negocios Asociados', sub: 'Comercios aliados, comisiones y recaudaciones', icon: 'building', group: 'Operación', module: 'partners', subitems: [
      { id: 'partners-list', label: 'Listado de negocios', icon: 'building', action: 'ver' },
      { id: 'partners-new', label: 'Nuevo negocio', icon: 'plus', action: 'crear' },
      { id: 'partners-reports', label: 'Reportes', icon: 'chart', action: 'reportes' }
    ] },
    inventory: { label: 'Tienda & Inventario', sub: 'Uniformes, equipamiento y financiamiento al conductor', icon: 'package', group: 'Operación', module: 'inventory', subitems: [
      { id: 'inventory-list', label: 'Catálogo e inventario', icon: 'package', action: 'ver' },
      { id: 'inventory-new', label: 'Nuevo producto', icon: 'plus', action: 'crear' },
      { id: 'inventory-assign', label: 'Asignar producto', icon: 'user', action: 'asignar' },
      { id: 'inventory-reports', label: 'Reportes', icon: 'chart', action: 'reportes' }
    ] },
    accounting: { label: 'Contabilidad', sub: 'Plan de cuentas, asientos y libros SENIAT', icon: 'book', group: 'Finanzas', module: 'accounting', subitems: [
      { id: 'accounting-ledger', label: 'Libro diario', icon: 'book', action: 'ver' },
      { id: 'accounting-mayor', label: 'Libro mayor', icon: 'book', action: 'ver' },
      { id: 'accounting-balance', label: 'Balance de comprobación', icon: 'book', action: 'ver' },
      { id: 'accounting-results', label: 'Estado de resultados', icon: 'book', action: 'ver' },
      { id: 'accounting-reports', label: 'Reportes', icon: 'chart', action: 'reportes' }
    ] },
    taxes: { label: 'Tributos & BCV', sub: 'IVA, IGTF, ISLR, unidad tributaria y retenciones', icon: 'percent', group: 'Finanzas', module: 'taxes', subitems: [
      { id: 'taxes-rate', label: 'Tasa BCV', icon: 'percent', action: 'ver' },
      { id: 'taxes-params', label: 'Parámetros fiscales', icon: 'percent', action: 'ver' },
      { id: 'taxes-reports', label: 'Reportes', icon: 'chart', action: 'reportes' }
    ] },
    payables: { label: 'Cuentas por Pagar', sub: 'Proveedores, facturas, retenciones y pagos', icon: 'wallet', group: 'Finanzas', module: 'payables', subitems: [
      { id: 'payables-list', label: 'Proveedores', icon: 'wallet', action: 'ver' },
      { id: 'payables-invoices', label: 'Facturas', icon: 'wallet', action: 'ver' },
      { id: 'payables-payments', label: 'Pagos', icon: 'wallet', action: 'pagar' },
      { id: 'payables-reports', label: 'Reportes', icon: 'chart', action: 'reportes' }
    ] },
    audit: { label: 'Bitácora de Auditoría', sub: 'Quién modificó qué, cuándo y con qué usuario', icon: 'activity', group: 'Sistema', module: 'audit', subitems: null },
    users: { label: 'Usuarios del sistema', sub: 'Roles, accesos y seguridad', icon: 'shield', group: 'Sistema', module: 'users', subitems: [
      { id: 'users-list', label: 'Usuarios', icon: 'shield', action: 'ver' },
      { id: 'users-roles', label: 'Roles', icon: 'shield', action: 'roles' },
      { id: 'users-reports', label: 'Reportes', icon: 'chart', action: 'reportes' }
    ] },
    settings: { label: 'Configuración del Sistema', sub: 'Conexión Supabase, parámetros y sincronización', icon: 'database', group: 'Sistema', module: 'settings', subitems: [
      { id: 'settings-params', label: 'Parámetros de mantenimiento', icon: 'settings', action: 'ver' },
      { id: 'settings-plans', label: 'Planes de conductores', icon: 'car', action: 'ver' },
      { id: 'settings-events', label: 'Eventos de conductores', icon: 'activity', action: 'ver' },
      { id: 'settings-apis', label: 'Integración de APIs', icon: 'link', action: 'ver' },
      { id: 'settings-supabase', label: 'Credenciales Supabase', icon: 'database', action: 'ver' },
      { id: 'settings-status', label: 'Estado de conexión', icon: 'activity', action: 'ver' },
      { id: 'settings-sync', label: 'Mapa de sincronización', icon: 'refresh', action: 'ver' },
      { id: 'settings-backup', label: 'Respaldo y restauración', icon: 'download', action: 'ver' },
      { id: 'settings-reports', label: 'Reportes', icon: 'chart', action: 'reportes' }
    ] }
  };

  const GROUPS = ['Operación', 'Maestros', 'Finanzas', 'Sistema'];
  let currentRoute = 'dashboard';
  let currentSubroute = null; // { module, sub, action } o null
  let currentSubquery = ''; // query string actual (ej. "sub=accounting-ledger")

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
  function setSidebarModuleOpen(nav, module, open) {
    nav.querySelectorAll('.nav-item-parent').forEach((btn) => {
      const isTarget = btn.dataset.route === module;
      const shouldOpen = isTarget && !!open;
      btn.setAttribute('aria-expanded', shouldOpen ? 'true' : 'false');
      btn.parentElement.classList.toggle('open', shouldOpen);
      const toggle = btn.parentElement.querySelector('.nav-toggle');
      if (toggle) toggle.setAttribute('aria-expanded', shouldOpen ? 'true' : 'false');
    });
  }

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
          const hasSub = m.subitems && m.subitems.length > 0;
          const subVisible = m.subitems && m.subitems.some((s) => access.modules.includes('*') || access.modules.includes(m.module));
          const isOpen = !!subVisible && currentRoute === m.module;
          return `
            <div class="nav-module ${hasSub ? 'has-sub' : ''} ${isOpen ? 'open' : ''}">
              <button type="button" class="nav-item ${hasSub ? 'nav-item-parent' : ''}" data-route="${m.module}" aria-expanded="${isOpen ? 'true' : 'false'}">
                <span class="nav-ico">${NS.ui.icon(m.icon, 19)}</span>
                <span class="nav-label">${NS.ui.esc(m.label)}</span>
                ${count ? `<span class="nav-count">${count}</span>` : ''}
              </button>
              ${hasSub ? `<button type="button" class="nav-toggle" data-nav-toggle="${m.module}" aria-expanded="${isOpen ? 'true' : 'false'}" aria-label="Mostrar u ocultar opciones de ${NS.ui.esc(m.label)}">${NS.ui.icon('chevronDown', 12)}</button>` : ''}
              ${hasSub ? `<div class="nav-subitems" data-parent="${m.module}">
                ${m.subitems.filter((s) => access.modules.includes('*') || access.modules.includes(m.module)).map((s) => `
                  <a href="#/${m.module}?sub=${s.id}" class="nav-subitem" data-route="${m.module}" data-sub="${s.id}" data-action="${s.action}">
                    <span class="nav-sub-ico">${NS.ui.icon(s.icon, 16)}</span>
                    <span class="nav-sub-label">${NS.ui.esc(s.label)}</span>
                  </a>
                `).join('')}
              </div>` : ''}
            </div>
          `;
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

    // Navegación de módulos: el título siempre abre el módulo principal.
    nav.querySelectorAll('.nav-item').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        const module = btn.dataset.route;
        closeMobileNav();
        // Limpiar la subruta para no reabrir el último subitem visitado.
        try { sessionStorage.removeItem('envia_subroute'); } catch (err) { /* ignorar */ }
        navigate(module, true);
        nav.querySelectorAll('.nav-subitem').forEach((s) => s.classList.remove('active'));
        // Acordeón: abrir el módulo actual y cerrar los demás.
        setSidebarModuleOpen(nav, module, true);
      });
    });

    // La flecha solo expande/recoge el acordeón, sin navegar.
    nav.querySelectorAll('.nav-toggle').forEach((toggle) => {
      toggle.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        const module = toggle.dataset.navToggle;
        const isOpen = toggle.getAttribute('aria-expanded') === 'true';
        setSidebarModuleOpen(nav, module, !isOpen);
      });
    });

    // Navegación a subitems (clic en opciones internas del módulo)
    nav.querySelectorAll('.nav-subitem').forEach((a) => {
      a.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        const module = a.dataset.route;
        const subId = a.dataset.sub;
        const action = a.dataset.action;
        closeMobileNav();
        // Navegar al módulo con el sub como query string; si es "reportes", renderRoute abrirá el modal automáticamente
        navigate(module + '?sub=' + subId + '&action=' + action, true);
        // Resaltar el subitem activo
        nav.querySelectorAll('.nav-subitem').forEach((s) => s.classList.remove('active'));
        a.classList.add('active');
      });
    });
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
    const per1000 = rate ? (1000 / rate) : 0;
    bar.innerHTML = `
      <button class="icon-btn menu-toggle" id="menu-toggle" aria-label="Menú">${NS.ui.icon('menu', 21)}</button>
      <div class="topbar-title">
        <div class="crumb">ENVIA Technology C.A. <span>/</span> <span id="crumb-current">Dashboard</span></div>
        <h1 id="page-title">Dashboard</h1>
      </div>
      <div class="topbar-actions">
        <button type="button" class="command-trigger" id="command-trigger" aria-label="Abrir búsqueda global" title="Buscar módulos, cédulas, RIF o facturas (Ctrl + K)">
          <span class="command-trigger-ico">${NS.ui.icon('search', 17)}</span>
          <span class="command-trigger-label">Buscar en ENVIA</span>
          <kbd class="command-kbd" data-command-kbd>Ctrl K</kbd>
        </button>
        <div class="rate-widget ${isHistoric ? 'rate-historic' : ''}" title="Tasa oficial del BCV · solo lectura (se actualiza desde DolarVZLA o por fecha)">
          <div class="rate-line">
            <span class="rate-value" id="bcv-rate-value">${NS.ui.icon('bank', 13)} Bs ${NS.ui.num(rate, 2)} <small>/ USD</small></span>
            <span class="rate-live" title="Sincronización en vivo"><i></i>Live</span>
            ${canAction('taxes', 'editar') ? `<button type="button" id="bcv-calendar" class="rate-calendar" title="Seleccionar la tasa de una fecha">${NS.ui.icon('calendar', 14)}</button>` : ''}
            ${canAction('taxes', 'editar') ? `<button type="button" id="bcv-refresh" class="rate-refresh" title="Actualizar la tasa de hoy">${NS.ui.icon('refresh', 14)}</button>` : ''}
          </div>
          <span class="rate-date" title="${NS.ui.esc(updatedFull)} · ${NS.ui.esc(sourceLabel)}">${NS.ui.icon('clock', 11)} Tasa BCV · ${NS.ui.esc(updatedLabel)} · ${NS.ui.esc(sourceLabel)}</span>
          <span class="rate-convert">1 USD = <b>Bs ${NS.ui.num(rate, 2)}</b><span>1.000 Bs = <b>$ ${NS.ui.num(per1000, 2)}</b></span></span>
        </div>
        <div class="currency-toggle" role="group" aria-label="Moneda de visualización">
          <button data-cur="USD" class="${NS.ui.currency() === 'USD' ? 'active' : ''}">USD</button>
          <button data-cur="VES" class="${NS.ui.currency() === 'VES' ? 'active' : ''}">VES</button>
        </div>
        <button type="button" class="icon-btn theme-toggle" id="theme-toggle" aria-label="Cambiar tema" title="Cambiar tema">${NS.ui.icon('sun', 18)}</button>
        <div class="topbar-user" title="${NS.ui.esc(s.nombre)} · ${NS.ui.esc(s.rol)}">
          ${NS.ui.avatar(s.nombre, 36)}
          <div><strong>${NS.ui.esc(s.nombre.split(' ').slice(0, 2).join(' '))}</strong><span>${NS.ui.esc(s.rol)}</span></div>
        </div>
        <button class="icon-btn topbar-logout" id="topbar-logout" title="Cerrar sesión">${NS.ui.icon('logout', 19)}</button>
      </div>`;

    $('#menu-toggle').addEventListener('click', toggleMobileNav);
    $('#topbar-logout').addEventListener('click', NS.login.logoutRequest);

    const refresh = $('#bcv-refresh');
    if (refresh) refresh.addEventListener('click', () => refreshRateFromApi(refresh));
    const calendar = $('#bcv-calendar');
    if (calendar) calendar.addEventListener('click', () => openRateCalendar());
    bar.querySelectorAll('[data-cur]').forEach((b) => b.addEventListener('click', () => {
      NS.store.setPrefs({ currency: b.dataset.cur });
      buildTopbar();
      renderRoute(true);
    }));
    if (NS.experience && typeof NS.experience.syncTopbar === 'function') NS.experience.syncTopbar();
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
    const full = String(route || 'dashboard').replace(/^#?\/?/, '');
    const clean = full.split('?')[0];
    const query = full.includes('?') ? full.split('?')[1] : '';
    if (!MODULES[clean] || !can(clean)) {
      const routeOk = Object.keys(MODULES).find((r) => can(r)) || 'dashboard';
      if (replace) {
        history.replaceState(null, '', '#/' + routeOk);
        return renderRoute(true, routeOk);
      }
      NS.ui.toast('No tienes permisos para acceder a ese módulo.', 'warning');
      return navigate(routeOk, true);
    }
    if (location.hash !== '#/' + full) history.pushState(null, '', '#/' + full);
    renderRoute(false, clean, query);
  }

  // Sincroniza la subruta activa sin volver a renderizar el módulo completo.
  // Se usa cuando una pestaña interna cambia (por ejemplo, Contabilidad) para
  // que el sidebar y la URL reflejen la pestaña y no reabran la anterior.
  function setSubroute(module, sub, action) {
    if (!MODULES[module]) return;
    currentRoute = module;
    currentSubroute = sub ? { module, sub, action: action || 'ver' } : null;
    currentSubquery = sub ? 'sub=' + encodeURIComponent(sub) + '&action=' + encodeURIComponent(action || 'ver') : '';
    try {
      if (currentSubroute) sessionStorage.setItem('envia_subroute', JSON.stringify(currentSubroute));
      else sessionStorage.removeItem('envia_subroute');
    } catch (e) { /* ignorar */ }
    const hash = '#/' + module + (sub ? '?sub=' + encodeURIComponent(sub) + '&action=' + encodeURIComponent(action || 'ver') : '');
    if (location.hash !== hash) history.replaceState(null, '', hash);
    document.querySelectorAll('#sidebar-nav .nav-subitem').forEach((s) => {
      s.classList.toggle('active', !!sub && s.dataset.route === module && s.dataset.sub === sub);
    });
  }

  function renderRoute(force, routeOverride, query) {
    if (!NS.session.getSession()) return;
    const full = routeOverride || (location.hash || '').replace(/^#\/?/, '') || 'dashboard';
    const route = full.split('?')[0];
    const qs = query || (full.includes('?') ? full.split('?')[1] : '');
    if (!MODULES[route] || !can(route)) return navigate('dashboard', true);
    currentRoute = route;
    currentSubquery = qs;

    // Extraer sub-ruta del query string
    currentSubroute = null;
    if (qs) {
      const params = new URLSearchParams(qs);
      const sub = params.get('sub');
      const action = params.get('action');
      if (sub) {
        currentSubroute = { module: route, sub, action };
        try { sessionStorage.setItem('envia_subroute', JSON.stringify(currentSubroute)); } catch (e) { /* ignorar */ }
      }
    }
    const meta = MODULES[route];
    $('#crumb-current').textContent = meta.label;
    $('#page-title').textContent = meta.label;
    document.title = meta.label + ' · ENVIA Technology C.A.';

    // Resaltar módulo padre y subitem activo
    document.querySelectorAll('#sidebar-nav .nav-item').forEach((a) => {
      const isActive = a.dataset.route === route;
      a.classList.toggle('active', isActive);
      if (isActive && a.classList.contains('nav-item-parent')) {
        a.setAttribute('aria-expanded', 'true');
        a.parentElement.classList.add('open');
        const toggle = a.parentElement.querySelector('.nav-toggle');
        if (toggle) toggle.setAttribute('aria-expanded', 'true');
        const sub = a.parentElement.querySelector('.nav-subitems');
        if (sub) sub.parentElement.classList.add('open');
      } else if (a.classList.contains('nav-item-parent')) {
        a.setAttribute('aria-expanded', 'false');
        a.parentElement.classList.remove('open');
        const toggle = a.parentElement.querySelector('.nav-toggle');
        if (toggle) toggle.setAttribute('aria-expanded', 'false');
      }
    });

    // Resaltar subitem activo según sessionStorage
    try {
      const stored = JSON.parse(sessionStorage.getItem('envia_subroute') || 'null');
      if (stored && stored.module === route) {
        document.querySelectorAll('#sidebar-nav .nav-subitem').forEach((s) => {
          s.classList.toggle('active', s.dataset.sub === stored.sub);
        });
      } else {
        document.querySelectorAll('#sidebar-nav .nav-subitem').forEach((s) => s.classList.remove('active'));
      }
    } catch (e) { /* ignorar */ }

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

      // Ocultar estadísticas del encabezado (stat-strip) cuando se entra por un subitem
      if (currentSubroute) {
        const statStrip = view.querySelector('.stat-strip');
        if (statStrip) statStrip.style.display = 'none';
      }

      // Abrir modal de reportes automáticamente si se seleccionó "Reportes" del sidebar
      if (currentSubroute && currentSubroute.sub && String(currentSubroute.sub).endsWith('-reports')) {
        if (NS.reports && NS.reports.has(route) && canAction(route, 'reportes')) {
          setTimeout(() => {
            NS.reports.open(route);
          }, 100);
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
      // Resaltar subitem activo según sessionStorage
      try {
        const stored = JSON.parse(sessionStorage.getItem('envia_subroute') || 'null');
        if (stored) {
          document.querySelectorAll('#sidebar-nav .nav-subitem').forEach((s) => {
            s.classList.toggle('active', s.dataset.sub === stored.sub && s.dataset.route === stored.module);
          });
        }
      } catch (e) { /* ignorar */ }
    }
  }

  function init() {
    window.addEventListener('hashchange', () => {
      if (!NS.session.getSession()) return;
      const full = (location.hash || '').replace(/^#\/?/, '') || 'dashboard';
      const route = full.split('?')[0];
      const query = full.includes('?') ? full.split('?')[1] : '';
      // Re-renderizar si cambió el módulo O la sub-ruta (query string)
      if (route !== currentRoute || query !== currentSubquery) {
        renderRoute(false, route, query);
      }
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
    setSubroute,
    renderRoute,
    refresh,
    buildSidebar,
    buildTopbar,
    navCount,
    toggleMobileNav,
    closeMobileNav,
    refreshRateFromApi,
    openRateCalendar,
    init,
    getSubroute() { return currentSubroute; }
  };
})();
