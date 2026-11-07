/* =========================================================================
   ENVIA ERP · services/sessionService.js
   Gestión de sesión, expiración (12 h) y controles de acceso (RBAC).
   Separa la lógica de sesión de la manipulación del DOM.
   ========================================================================= */
(function () {
  'use strict';

  const NS = (window.ENVIA = window.ENVIA || {});
  const SESSION_KEY = 'envia_session';
  const MAX_AGE = 12 * 60 * 60 * 1000; // 12 horas

  let session = null;

  function readSession() {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY) || localStorage.getItem('envia_last_session');
      if (!raw) return null;
      const s = JSON.parse(raw);
      if (!s || !s.usuario) return null;
      if (Date.now() - new Date(s.loginAt).getTime() > MAX_AGE) return null;
      return s;
    } catch (e) {
      return null;
    }
  }

  function saveSession(user) {
    session = {
      usuario: user.usuario,
      nombre: user.nombre,
      rol: user.rol,
      correo: user.correo,
      loginAt: new Date().toISOString()
    };
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } catch (e) { /* sessionStorage no disponible */ }
    try {
      localStorage.setItem('envia_last_session', JSON.stringify(session));
    } catch (e) { /* localStorage no disponible */ }
    return session;
  }

  function clearSession() {
    session = null;
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch (e) { /* ignorar */ }
    try {
      localStorage.removeItem('envia_last_session');
    } catch (e) { /* ignorar */ }
  }

  function getSession() {
    return session;
  }

  function authenticate(usuario, password) {
    if (!NS.store) throw new Error('Capa de datos no disponible.');
    const u = NS.store.authenticate(usuario, password);
    return u;
  }

  function can(module) {
    const s = session;
    return s ? NS.store.can(s.rol, module, s.usuario) : false;
  }

  function canTab(module, tab) {
    const s = session;
    return s ? NS.store.canTab(s.rol, module, tab, s.usuario) : false;
  }

  function canAction(module, action) {
    const s = session;
    return s ? NS.store.canAction(s.rol, module, action, s.usuario) : false;
  }

  function canWrite(module, action) {
    const s = session;
    if (!s) return false;
    if (!NS.store.canWrite(s.rol, s.usuario)) return false;
    if (!module) return true;
    return NS.store.canAction(s.rol, module, action || 'editar', s.usuario);
  }

  function isAdmin() {
    const s = session;
    return s ? NS.store.isAdmin(s.rol) : false;
  }

  NS.session = {
    readSession,
    saveSession,
    clearSession,
    getSession,
    authenticate,
    can,
    canTab,
    canAction,
    canWrite,
    isAdmin
  };
})();
