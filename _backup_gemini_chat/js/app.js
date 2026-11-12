/* =========================================================================
   ENVIA ERP · app.js
   Orquestador de arranque: inicializa login, sesión, enrutador y listeners
   globales. La lógica de sesión vive en sessionService.js, el ruteo y el
   shell en routerService.js, y la API en supabaseService.js /
   exchangeRateService.js.
   ========================================================================= */
(function () {
  'use strict';

  const NS = (window.ENVIA = window.ENVIA || {});
  const $ = (s, r) => NS.ui.$(s, r);

  function startApp() {
    const s = NS.session.getSession();
    if (!s) {
      NS.login.showLogin();
      return;
    }
    // Si el usuario debe cambiar su clave en el próximo ingreso, se muestra el
    // formulario de cambio antes de entrar al dashboard.
    if (s.must_change_password) {
      NS.login.showPasswordChange(s);
      return;
    }
    document.body.classList.remove('on-login');
    $('#login-screen').classList.add('hidden');
    $('#app-shell').classList.remove('hidden');
    NS.router.buildSidebar();
    NS.router.buildTopbar();
    // La sesión siempre inicia en el Dashboard, sin recordar el último módulo.
    history.replaceState(null, '', '#/dashboard');
    NS.router.navigate('dashboard', true);
    // Tasa oficial BCV: se actualiza automáticamente al iniciar sesión.
    if (NS.exchangeRate && typeof NS.exchangeRate.start === 'function') NS.exchangeRate.start();
  }

  document.addEventListener('DOMContentLoaded', async () => {
    NS.login.bindLogin();
    NS.login.updateLoginClock();
    NS.router.init();

    const btnManual = document.getElementById('btn-manual');
    if (btnManual) btnManual.addEventListener('click', () => { location.href = 'manual.html'; });

    // Espera la migración de archivos a IndexedDB para que las previsualizaciones
    // estén disponibles antes del primer render.
    if (NS.supabase && NS.supabase.filesReady) {
      try {
        await NS.supabase.filesReady;
      } catch (e) {
        NS.errors.fail(e, 'Archivos locales');
      }
    }

    const existing = NS.session.readSession();
    if (existing) {
      try {
        const live = NS.store.db.users.find((u) => u.usuario === existing.usuario && u.activo);
        if (live) {
          NS.session.saveSession({ ...existing, nombre: live.nombre, rol: live.rol });
          startApp();
          return;
        }
      } catch (e) { /* ignorar: si falla la restauración, se muestra el login */ }
    }
    NS.login.showLogin();
  });

  window.addEventListener('error', (e) => {
    const msg = (e.error && e.error.message) ? e.error.message : (e.message || 'Error inesperado.');
    if (NS.ui && typeof NS.ui.toast === 'function') {
      NS.ui.toast('Error inesperado: ' + msg, 'error');
    } else {
      console.error('ENVIA global', e.error || e.message);
    }
  });

  NS.app = {
    navigate: NS.router.navigate,
    refresh: NS.router.refresh,
    logout: NS.login.logoutRequest,
    get session() { return NS.session.getSession(); },
    can: NS.router.can,
    canTab: NS.router.canTab,
    canAction: NS.router.canAction,
    canWrite: NS.router.canWrite,
    isAdmin: NS.router.isAdmin,
    MODULES: NS.router.MODULES,
    startApp
  };
  NS.modules = NS.modules || {};
})();
