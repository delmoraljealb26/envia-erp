/* =========================================================================
   ENVIA ERP · services/exchangeRateService.js
   Integración con DolarVZLA (CDN público) para la tasa oficial del BCV.

   Fuente: https://rates.dolarvzla.com (sin API key para tasas BCV)
   Endpoints utilizados:
     - /bcv/current.json          → tasa vigente
     - /bcv/available-dates.json  → fechas con tasa publicada
     - /bcv/{yyyy}/{m}/{d}.json   → tasa de una fecha concreta

   La API key `x-dolarvzla-key` solo es necesaria para los endpoints USDT
   (Binance); las tasas BCV se sirven desde el CDN público. Por seguridad no
   se incrusta ninguna clave en el frontend (Artículo 11 de la Constitución).

   Reglas de negocio (Constitución ENVIA ERP):
   - La moneda funcional contable es VES.
   - La tasa activa vive en taxParams.bcvRate y se replica en sessionStorage
     para no saturar la API en cada cambio de módulo.
   - La tasa es de solo lectura: se obtiene de la API o por fecha, nunca se
     ajusta manualmente desde la interfaz.
   ========================================================================= */
(function () {
  'use strict';

  const NS = (window.ENVIA = window.ENVIA || {});

  const API_BASE = 'https://rates.dolarvzla.com';
  const ENDPOINTS = {
    current: API_BASE + '/bcv/current.json',
    availableDates: API_BASE + '/bcv/available-dates.json',
    day: (date) => {
      const [y, m, d] = String(date).split('-').map(Number);
      // DolarVZLA publica sin ceros a la izquierda: /2026/11/5.json
      return API_BASE + '/bcv/' + y + '/' + m + '/' + d + '.json';
    }
  };

  const SESSION_KEYS = {
    rate: 'tasaBcv',
    date: 'tasaBcvFecha',
    source: 'tasaBcvFuente',
    stamp: 'tasaBcvTimestamp',
    mode: 'tasaBcvModo'
  };
  // Tiempo de vida de la caché de sesión: 15 minutos.
  const CACHE_TTL = 15 * 60 * 1000;
  // Caché en memoria de las fechas disponibles: 1 hora.
  const DATES_TTL = 60 * 60 * 1000;

  let datesMemo = null;
  let datesMemoAt = 0;

  /* ------------------------------ Utilidades ------------------------------ */
  function toPositiveNumber(value) {
    const n = Number(String(value == null ? '' : value).replace(',', '.'));
    if (!isFinite(n) || n <= 0) return 0;
    return n;
  }

  function normalizeDate(value) {
    const s = String(value || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return '';
    const d = new Date(s + 'T12:00:00');
    return isNaN(d) ? '' : s;
  }

  function todayISO() {
    return new Date().toISOString().slice(0, 10);
  }

  /** Tasa activa: primero la caché de sesión, luego los parámetros del store. */
  function getActiveRate() {
    try {
      const cached = toPositiveNumber(sessionStorage.getItem(SESSION_KEYS.rate));
      if (cached > 0) return cached;
    } catch (e) { /* sessionStorage no disponible */ }
    if (NS.store && NS.store.db && NS.store.db.taxParams) {
      return toPositiveNumber(NS.store.db.taxParams.bcvRate);
    }
    return 0;
  }

  /** Metadatos de la última tasa aplicada (fecha, fuente y marca de tiempo). */
  function getMeta() {
    let rate = 0;
    let fecha = '';
    let fuente = '';
    let stamp = 0;
    let mode = '';
    try {
      rate = toPositiveNumber(sessionStorage.getItem(SESSION_KEYS.rate));
      fecha = sessionStorage.getItem(SESSION_KEYS.date) || '';
      fuente = sessionStorage.getItem(SESSION_KEYS.source) || '';
      stamp = Number(sessionStorage.getItem(SESSION_KEYS.stamp)) || 0;
      mode = sessionStorage.getItem(SESSION_KEYS.mode) || '';
    } catch (e) { /* ignore */ }
    if (!rate && NS.store && NS.store.db && NS.store.db.taxParams) {
      rate = toPositiveNumber(NS.store.db.taxParams.bcvRate);
      fecha = fecha || NS.store.db.taxParams.bcvUpdatedAt || '';
      fuente = fuente || 'local';
    }
    return { rate, fecha, fuente: fuente || 'local', stamp, mode: mode || 'current' };
  }

  /** Guarda la tasa en sessionStorage (caché de sesión, no satura la API). */
  function cacheRate(rate, fecha, fuente, mode) {
    const payload = {
      rate: String(rate),
      fecha: fecha || new Date().toISOString(),
      fuente: fuente || 'DolarVZLA',
      stamp: String(Date.now()),
      mode: mode || 'current'
    };
    try {
      sessionStorage.setItem(SESSION_KEYS.rate, payload.rate);
      sessionStorage.setItem(SESSION_KEYS.date, payload.fecha);
      sessionStorage.setItem(SESSION_KEYS.source, payload.fuente);
      sessionStorage.setItem(SESSION_KEYS.stamp, payload.stamp);
      sessionStorage.setItem(SESSION_KEYS.mode, payload.mode);
    } catch (e) { /* almacenamiento de sesión no disponible */ }
    return payload;
  }

  /** Aplica una tasa al ERP: sessionStorage + taxParams + bitácora. */
  function applyRate(rate, fecha, fuente, mode) {
    const n = toPositiveNumber(rate);
    if (!n) throw new Error('La tasa BCV debe ser un número mayor a cero.');
    cacheRate(n, fecha, fuente, mode);
    if (NS.store && typeof NS.store.setRate === 'function') {
      NS.store.setRate(n, fecha, fuente);
    }
    return n;
  }

  function emit(name, detail) {
    try {
      document.dispatchEvent(new CustomEvent(name, { detail: detail || {} }));
    } catch (e) { /* CustomEvent no disponible */ }
  }

  async function requestJson(url, timeout) {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), timeout || 10000) : null;
    try {
      const res = await fetch(url + (url.indexOf('?') >= 0 ? '&' : '?') + '_=' + Date.now(), {
        method: 'GET',
        headers: { Accept: 'application/json' },
        cache: 'no-store',
        signal: controller ? controller.signal : undefined
      });
      if (!res.ok) {
        const err = new Error('HTTP ' + res.status);
        err.status = res.status;
        throw err;
      }
      return await res.json();
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  /* --------------------------- Consulta a la API --------------------------- */
  /**
   * Obtiene la tasa oficial vigente del BCV desde DolarVZLA.
   * @param {{force?: boolean, timeout?: number}} options
   * @returns {Promise<{ok:boolean, rate:number, fecha:string, fuente:string,
   *                    cached?:boolean, raw?:object, error?:string}>}
   */
  async function fetchBcvRate(options) {
    const opts = options || {};
    const meta = getMeta();

    // Caché de sesión vigente: evita peticiones repetidas al cambiar de módulo.
    if (!opts.force && meta.rate > 0 && meta.stamp && (Date.now() - meta.stamp) < CACHE_TTL) {
      return { ok: true, cached: true, rate: meta.rate, fecha: meta.fecha, fuente: meta.fuente };
    }

    try {
      const data = await requestJson(ENDPOINTS.current, opts.timeout);
      const current = (data && data.current) || data || {};
      // DolarVZLA expone la tasa BCV en `usd` (y el euro en `eur`).
      const rate = toPositiveNumber(current.usd) || toPositiveNumber(data.usd);
      if (!rate) throw new Error('La API no devolvió una tasa válida.');

      const fecha = normalizeDate(current.date) || todayISO();
      applyRate(rate, fecha, 'DolarVZLA', 'current');
      return { ok: true, cached: false, rate, fecha, fuente: 'DolarVZLA', mode: 'current', raw: data };
    } catch (error) {
      const reason = error && error.name === 'AbortError'
        ? 'Tiempo de espera agotado al consultar DolarVZLA.'
        : (error && error.message) || 'Error de red.';
      return {
        ok: false,
        error: reason,
        rate: meta.rate || getActiveRate(),
        fecha: meta.fecha,
        fuente: meta.fuente
      };
    }
  }

  /** Tasa BCV de una fecha concreta (formato YYYY-MM-DD). */
  async function fetchBcvRateByDate(dateStr, options) {
    const opts = options || {};
    const fecha = normalizeDate(dateStr);
    if (!fecha) return { ok: false, error: 'Selecciona una fecha válida (YYYY-MM-DD).' };

    try {
      const data = await requestJson(ENDPOINTS.day(fecha), opts.timeout);
      const rate = toPositiveNumber(data && data.usd);
      if (!rate) throw new Error('No hay una tasa publicada para esa fecha.');
      const appliedDate = normalizeDate(data && data.date) || fecha;
      applyRate(rate, appliedDate, 'DolarVZLA', 'date');
      return { ok: true, rate, fecha: appliedDate, fuente: 'DolarVZLA', mode: 'date', raw: data };
    } catch (error) {
      const status = error && error.status;
      const reason = status === 404
        ? 'No hay tasa BCV publicada para el ' + fecha + ' (fin de semana o feriado).'
        : (error && error.name === 'AbortError')
          ? 'Tiempo de espera agotado al consultar DolarVZLA.'
          : (error && error.message) || 'Error de red.';
      return { ok: false, error: reason, fecha };
    }
  }

  /** Fechas con tasa publicada (ordenadas de más reciente a más antigua). */
  async function getAvailableDates(force) {
    if (!force && datesMemo && (Date.now() - datesMemoAt) < DATES_TTL) return datesMemo;
    try {
      const data = await requestJson(ENDPOINTS.availableDates);
      const list = Array.isArray(data)
        ? data.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(String(d)))
        : [];
      if (list.length) {
        datesMemo = list;
        datesMemoAt = Date.now();
      }
      return datesMemo || list;
    } catch (e) {
      return datesMemo || [];
    }
  }

  /* ------------------ Ajuste interno (no expuesto en la UI) --------------- */
  /**
   * Aplica una tasa concreta. Se mantiene para integraciones futuras, pero la
   * interfaz NO permite editar la tasa: solo API o selección de fecha.
   */
  function setManualRate(value) {
    const n = toPositiveNumber(value);
    if (!n) throw new Error('Introduce una tasa BCV válida (mayor a cero).');
    applyRate(n, new Date().toISOString(), 'manual', 'manual');
    return n;
  }

  /* --------------------------- Conversión monetaria ------------------------ */
  /**
   * Convierte entre USD y VES usando la tasa activa (sessionStorage o taxParams).
   * Función global pedida por la integración: window.convertirMoneda(...)
   */
  function convertirMoneda(monto, monedaOrigen, monedaDestino) {
    const amount = Number(monto) || 0;
    const origen = String(monedaOrigen || 'USD').toUpperCase();
    const destino = String(monedaDestino || 'VES').toUpperCase();
    if (origen === destino) return amount;

    const rate = getActiveRate();
    if (!rate) return 0;

    if (origen === 'USD' && destino === 'VES') return amount * rate;
    if (origen === 'VES' && destino === 'USD') return amount / rate;

    throw new Error('Moneda no soportada: ' + origen + ' → ' + destino);
  }

  /* ------------------------------- Arranque -------------------------------- */
  /**
   * Sincroniza la tasa al iniciar sesión. Si la API falla, mantiene la última
   * tasa conocida y avisa a la UI (la tasa no se edita manualmente).
   */
  async function start() {
    const result = await fetchBcvRate();
    const finalRate = (result && result.rate) || getActiveRate();
    const formatted = finalRate
      ? finalRate.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 4 })
      : '—';
    const origen = result && result.ok
      ? (result.cached ? ' · caché de sesión' : ' · DolarVZLA')
      : ' · última tasa conocida';
    console.log('Integración DolarVZLA BCV iniciada. Tasa actual: Bs ' + formatted + ' / USD' + origen);

    if (result && result.ok) {
      emit('envia:rate-updated', result);
    } else {
      console.warn('DolarVZLA BCV: no se pudo actualizar la tasa.', result && result.error);
      emit('envia:rate-error', result);
    }
    return result;
  }

  function clearCache() {
    try {
      Object.keys(SESSION_KEYS).forEach((k) => sessionStorage.removeItem(SESSION_KEYS[k]));
    } catch (e) { /* ignore */ }
    datesMemo = null;
    datesMemoAt = 0;
  }

  NS.exchangeRate = {
    API_BASE,
    ENDPOINTS,
    CACHE_TTL,
    fetchBcvRate,
    fetchBcvRateByDate,
    getAvailableDates,
    getActiveRate,
    getMeta,
    setManualRate,
    convertirMoneda,
    start,
    clearCache
  };

  // Función global de conversión pedida por la integración.
  window.convertirMoneda = convertirMoneda;
})();
