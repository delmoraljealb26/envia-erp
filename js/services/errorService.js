/* =========================================================================
   ENVIA ERP · services/errorService.js
   Manejo centralizado de errores: captura fallas asíncronas y las traduce a
   feedback en pantalla (toasts/modales) en español. Nunca expone errores
   crudos al usuario; solo trazas internas si no hay UI disponible.
   ========================================================================= */
(function () {
  'use strict';

  const NS = (window.ENVIA = window.ENVIA || {});

  function messageOf(e) {
    if (!e) return 'Error desconocido.';
    if (e.message) return e.message;
    return String(e);
  }

  function showToast(type, text, title) {
    if (NS.ui && typeof NS.ui.toast === 'function') {
      NS.ui.toast(text, type, title);
      return true;
    }
    return false;
  }

  NS.errors = {
    /** Ejecuta fn; si falla, muestra el error en UI y devuelve undefined. */
    capture: async function (fn, contexto) {
      try {
        return await fn();
      } catch (e) {
        const m = messageOf(e);
        const full = contexto ? contexto + ': ' + m : m;
        if (!showToast('error', full, 'Error')) {
          console.error(full);
        }
        return undefined;
      }
    },

    /** Notifica un error sincrónico/asíncrono ya capturado al usuario. */
    fail: function (e, contexto) {
      const m = messageOf(e);
      const full = contexto ? contexto + ': ' + m : m;
      if (!showToast('error', full, 'Error')) {
        console.error(full);
      }
    },

    /** Lanza un error con mensaje amigable si la condición se cumple. */
    throwIf: function (cond, msg) {
      if (cond) throw new Error(msg || 'Operación no válida.');
    }
  };
})();
