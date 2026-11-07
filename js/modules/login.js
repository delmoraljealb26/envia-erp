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
          if (user.must_change_password) {
            NS.session.saveSession(user);
            showPasswordChange(user);
            return;
          }
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

  function showPasswordChange(user) {
    const ui = NS.ui;
    const overlay = ui.modal({
      title: 'Cambiar clave de acceso',
      eyebrow: 'Primer ingreso · debes actualizar tu clave',
      size: 'sm',
      body: `<form id="pwd-change-form" class="form-grid" autocomplete="off">
        <label class="field field-full"><span>Usuario</span><input name="usuario" value="${ui.esc(user.usuario)}" readonly></label>
        <label class="field field-full"><span>Clave actual *</span><input name="current_password" type="password" minlength="6" placeholder="Clave asignada por el administrador" required></label>
        <label class="field field-full"><span>Nueva clave *</span><input name="new_password" type="password" minlength="6" placeholder="Mínimo 6 caracteres" required></label>
        <label class="field field-full"><span>Confirmar nueva clave *</span><input name="confirm_password" type="password" minlength="6" placeholder="Repite la nueva clave" required></label>
        <p class="form-note field-full">${ui.icon('alert', 14)} Es obligatorio cambiar la clave antes de acceder al sistema.</p>
      </form>`,
      footer: `<button class="btn btn-primary" id="pwd-change-save">${ui.icon('check', 15)} Cambiar clave y entrar</button>`
    });
    overlay.querySelector('#pwd-change-save').addEventListener('click', () => {
      const form = overlay.querySelector('#pwd-change-form');
      if (!form.reportValidity()) return;
      const current = form.elements.current_password.value;
      const nuevo = form.elements.new_password.value;
      const confirm = form.elements.confirm_password.value;
      if (current !== user.password) {
        ui.toast('La clave actual no es correcta.', 'error');
        return;
      }
      if (nuevo !== confirm) {
        ui.toast('La nueva clave y su confirmación no coinciden.', 'error');
        return;
      }
      if (nuevo === current) {
        ui.toast('La nueva clave debe ser diferente a la actual.', 'error');
        return;
      }
      try {
        NS.store.upsertUser({
          id: user.id,
          usuario: user.usuario,
          password: nuevo,
          rol: user.rol,
          nombre: user.nombre,
          correo: user.correo,
          activo: user.activo !== false,
          permisos: user.permisos,
          must_change_password: false
        });
        user.password = nuevo;
        user.must_change_password = false;
        NS.session.saveSession(user);
        ui.closeModal(overlay);
        ui.toast('Clave actualizada correctamente. Bienvenido al sistema.', 'success');
        NS.app.startApp();
      } catch (e) { ui.toast(e.message, 'error'); }
    });
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
    logoutRequest,
    showPasswordChange
  };
})();
