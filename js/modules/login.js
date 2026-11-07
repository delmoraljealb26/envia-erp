/* =========================================================================
   ENVIA ERP · modules/login.js
   Pantalla de acceso corporativo: credenciales de demostración precargadas,
   bloqueo por intentos y envío del formulario. La lógica de autenticación
   vive en sessionService.js y store.js.
   ========================================================================= */
(function () {
  'use strict';

  const NS = (window.ENVIA = window.ENVIA || {});
  const $ = (s, r) => NS.ui.$(s, r);

  let attempts = 0;
  let lockedUntil = 0;

  function showLogin() {
    $('#app-shell').classList.add('hidden');
    $('#login-screen').classList.remove('hidden');
    document.body.classList.add('on-login');
    const form = $('#login-form');
    if (form) {
      // Demo: credenciales de prueba precargadas; el usuario solo pulsa Ingresar.
      form.elements.usuario.value = 'ENVIA';
      form.elements.password.value = '123456789';
      const err = $('#login-error');
      err.classList.add('hidden');
      err.textContent = '';
      setTimeout(() => {
        const submit = $('#login-submit');
        if (submit) submit.focus();
      }, 100);
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
    if (!form) return;
    const toggle = $('#toggle-pass');
    const input = form.elements.password;
    const err = $('#login-error');

    toggle.addEventListener('click', () => {
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      toggle.innerHTML = NS.ui.icon(show ? 'x' : 'eye', 18);
      toggle.setAttribute('aria-label', show ? 'Ocultar clave' : 'Mostrar clave');
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
          const user = NS.session.authenticate(usuario, password);
          attempts = 0;
          NS.session.saveSession(user);
          NS.app.startApp();
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

  function logoutRequest() {
    NS.ui.confirm({
      title: 'Cerrar sesión',
      message: 'Se cerrará tu sesión segura y volverás a la pantalla de acceso corporativo. ¿Deseas continuar?',
      confirmText: 'Cerrar sesión',
      danger: true
    }).then((ok) => {
      if (!ok) return;
      NS.ui.closeAllModals();
      NS.session.clearSession();
      NS.login.showLogin();
      NS.ui.toast('Sesión finalizada de forma segura.', 'info');
    });
  }

  NS.login = {
    showLogin,
    bindLogin,
    updateLoginClock,
    showLoginError,
    logoutRequest
  };
})();
