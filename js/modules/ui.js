/* =========================================================================
   ENVIA ERP · ui.js
   Kit de interfaz: formato monetario, iconos SVG, modales, toasts,
   validaciones, gráficos sin dependencias y utilidades de impresión.
   ========================================================================= */
(function () {
  'use strict';

  const NS = (window.ENVIA = window.ENVIA || {});
  const IMG = {
    logo: 'imagen/WhatsApp%20Image%202026-11-03%20at%2010.49.04%20PM.jpeg',
    logoSquare: 'imagen/WhatsApp%20Image%202026-11-03%20at%2010.49.20%20PM.jpeg',
    palette: 'imagen/WhatsApp%20Image%202026-11-03%20at%2011.00.44%20PM.jpeg'
  };

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const esc = (v) => String(v == null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');

  const nf2 = new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const nf0 = new Intl.NumberFormat('es-VE', { maximumFractionDigits: 0 });
  const rate = () => {
    if (NS.exchangeRate && typeof NS.exchangeRate.getActiveRate === 'function') {
      const live = NS.exchangeRate.getActiveRate();
      if (live > 0) return live;
    }
    return Number(NS.store.db.taxParams.bcvRate) || 0;
  };
  const currency = () => (NS.store.prefs.currency === 'VES' ? 'VES' : 'USD');

  const usd = (n) => '$ ' + nf2.format(Number(n) || 0);
  const bs = (n) => 'Bs ' + nf2.format(Number(n) || 0);
  const usdRaw = (n) => nf2.format(Number(n) || 0);
  const bsRaw = (n) => nf2.format(Number(n) || 0);
  const toBs = (n) => (NS.exchangeRate && typeof NS.exchangeRate.convertirMoneda === 'function')
    ? NS.exchangeRate.convertirMoneda(n, 'USD', 'VES')
    : (Number(n) || 0) * rate();
  const fromBs = (n) => (NS.exchangeRate && typeof NS.exchangeRate.convertirMoneda === 'function')
    ? NS.exchangeRate.convertirMoneda(n, 'VES', 'USD')
    : (rate() ? (Number(n) || 0) / rate() : 0);

  function money(usdAmount) {
    if (currency() === 'VES') return bs(toBs(usdAmount));
    return usd(usdAmount);
  }
  function moneyBoth(usdAmount) {
    return `<span class="money-main">${usd(usdAmount)}</span><span class="money-alt">${bs(toBs(usdAmount))}</span>`;
  }
  function num(n, decimals) {
    return decimals === 0 ? nf0.format(Number(n) || 0) : nf2.format(Number(n) || 0);
  }
  function pct(n) { return (Number(n) || 0).toFixed(2).replace(/\.00$/, '') + '%'; }
  function date(d) {
    if (!d) return '—';
    const dt = new Date(String(d).length <= 10 ? d + 'T12:00:00' : d);
    if (isNaN(dt)) return d;
    return dt.toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }
  function dateLong(d) {
    if (!d) return '—';
    const dt = new Date(String(d).length <= 10 ? d + 'T12:00:00' : d);
    if (isNaN(dt)) return d;
    return dt.toLocaleDateString('es-VE', { day: '2-digit', month: 'long', year: 'numeric' });
  }
  function dateTime(d) {
    if (!d) return '—';
    const dt = new Date(String(d).length <= 10 ? d + 'T12:00:00' : d);
    if (isNaN(dt)) return d;
    return dt.toLocaleString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
  function monthLabel(ym) {
    if (!ym) return '—';
    const [y, m] = ym.split('-');
    return new Date(Number(y), Number(m) - 1, 2).toLocaleDateString('es-VE', { month: 'long', year: 'numeric' });
  }

  /* ------------------------------- Iconos ------------------------------- */
  const ICONS = {
    dashboard: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
    route: '<circle cx="6" cy="19" r="2.5"/><circle cx="18" cy="5" r="2.5"/><path d="M8.5 19H14a4 4 0 0 0 0-8H9a4 4 0 0 1 0-8h6.5"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    car: '<path d="M5 17h14l1.5-5.5L18 6H6L3.5 11.5 5 17Z"/><path d="M5 17v3h3v-3M16 17v3h3v-3"/><circle cx="7" cy="14" r="1.2"/><circle cx="17" cy="14" r="1.2"/>',
    moto: '<circle cx="5" cy="17" r="3"/><circle cx="19" cy="17" r="3"/><path d="M8 17h7l-2-6h-3l-1.5 4M13 11l3-4h3"/><path d="M4 10h4"/>',
    book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5v14Z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/><path d="M8 7h8M8 11h6"/>',
    percent: '<line x1="19" y1="5" x2="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>',
    wallet: '<path d="M20 12V8H6a2 2 0 0 1 0-4h12v4"/><path d="M4 6v12a2 2 0 0 0 2 2h14v-4"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/>',
    building: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8 7h3M13 7h3M8 11h3M13 11h3M8 15h3M13 15h3M9 21v-3h6v3"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/>',
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    edit: '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z"/>',
    trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5M12 3v12"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5M12 15V3"/>',
    file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>',
    image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    eye: '<path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z"/><circle cx="12" cy="12" r="3"/>',
    print: '<path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    arrowRight: '<path d="M5 12h14M12 5l7 7-7 7"/>',
    menu: '<path d="M3 12h18M3 6h18M3 18h18"/>',
    chevronDown: '<path d="m6 9 6 6 6-6"/>',
    camera: '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2Z"/><circle cx="12" cy="13" r="4"/>',
    bank: '<path d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 14v3M12 14v3M16 14v3"/>',
    alert: '<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"/><path d="M12 9v4M12 17h.01"/>',
    refresh: '<path d="M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
    cloud: '<path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/><path d="m9 13 2 2 4-4"/>',
    lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    filter: '<path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3Z"/>',
    clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    trendUp: '<path d="m23 6-9.5 9.5-5-5L1 18"/><path d="M17 6h6v6"/>',
    package: '<path d="m21 16-9 5-9-5V8l9-5 9 5Z"/><path d="M3.27 6.96 12 12.01l8.73-5.05M12 22.08V12"/>',
    receipt: '<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M8 7h8M8 11h8M8 15h5"/>',
    chart: '<path d="M3 3v18h18"/><path d="m7 16 4-5 4 3 5-7"/>',
    database: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/><path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3"/>',
    key: '<circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6M15 6l3 3M18 3l3 3"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    activity: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
    truck: '<path d="M1 3h15v13H1zM16 8h4l3 3v5h-7V8Z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>',
    mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/>',
    phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92Z"/>',
    pin: '<path d="M21 10c0 7-9 12-9 12s-9-5-9-12a9 9 0 0 1 18 0Z"/><circle cx="12" cy="10" r="3"/>',
    briefcase: '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>',
    info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>'
  };

  function icon(name, size, cls) {
    const path = ICONS[name] || ICONS.info;
    return `<svg class="ico ${cls || ''}" width="${size || 18}" height="${size || 18}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
  }

  /* ------------------------------- Toasts ------------------------------- */
  function toast(message, type, title) {
    let root = $('#toast-root');
    if (!root) {
      root = document.createElement('div');
      root.id = 'toast-root';
      document.body.appendChild(root);
    }
    const el = document.createElement('div');
    el.className = 'toast toast-' + (type || 'info');
    const ico = type === 'success' ? 'check' : (type === 'error' ? 'alert' : (type === 'warning' ? 'alert' : 'info'));
    el.innerHTML = `<span class="toast-ico">${icon(ico, 18)}</span><div class="toast-body">${title ? `<strong>${esc(title)}</strong>` : ''}<span>${esc(message)}</span></div><button class="toast-x" aria-label="Cerrar">${icon('x', 14)}</button>`;
    root.appendChild(el);
    const kill = () => { el.classList.add('out'); setTimeout(() => el.remove(), 240); };
    el.querySelector('.toast-x').addEventListener('click', kill);
    setTimeout(kill, type === 'error' ? 6500 : 4200);
  }

  /* ------------------------------- Modales ------------------------------ */
  const openModals = [];

  function modal(opts) {
    const root = $('#modal-root') || document.body;
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal ${opts.size === 'lg' ? 'modal-lg' : ''} ${opts.size === 'xl' ? 'modal-xl' : ''} ${opts.size === 'sm' ? 'modal-sm' : ''}" role="dialog" aria-modal="true" aria-label="${esc(opts.title || 'Ventana')}">
        <div class="modal-head">
          <div class="modal-heading">
            ${opts.eyebrow ? `<span class="modal-eyebrow">${esc(opts.eyebrow)}</span>` : ''}
            <h2>${esc(opts.title || '')}</h2>
            ${opts.subtitle ? `<p>${esc(opts.subtitle)}</p>` : ''}
          </div>
          <button class="icon-btn modal-close" type="button" aria-label="Cerrar">${icon('x', 20)}</button>
        </div>
        <div class="modal-body">${opts.body || ''}</div>
        ${opts.footer ? `<div class="modal-foot">${opts.footer}</div>` : ''}
      </div>`;
    root.appendChild(overlay);
    openModals.push(overlay);
    requestAnimationFrame(() => overlay.classList.add('open'));
    const close = () => closeModal(overlay);
    overlay.querySelector('.modal-close').addEventListener('click', close);
    overlay.addEventListener('mousedown', (e) => {
      if (e.target === overlay && opts.closable !== false) close();
    });
    if (opts.onMount) opts.onMount(overlay);
    const focusable = overlay.querySelector('input:not([type="hidden"]), select, textarea, button:not(.modal-close)');
    if (focusable && !/^(checkbox|radio)$/.test(focusable.type)) setTimeout(() => focusable.focus(), 60);
    return overlay;
  }

  function closeModal(el) {
    const target = el || openModals[openModals.length - 1];
    if (!target) return;
    target.classList.remove('open');
    setTimeout(() => {
      target.remove();
      const i = openModals.indexOf(target);
      if (i >= 0) openModals.splice(i, 1);
    }, 180);
  }

  function closeAllModals() {
    openModals.slice().forEach((m) => m.remove());
    openModals.length = 0;
  }

  function confirm(opts) {
    return new Promise((resolve) => {
      const o = modal({
        title: opts.title || 'Confirmar acción',
        size: 'sm',
        body: `<div class="confirm-body"><span class="confirm-ico ${opts.danger ? 'danger' : ''}">${icon(opts.danger ? 'alert' : 'info', 24)}</span><p>${esc(opts.message || '¿Deseas continuar?')}</p></div>`,
        footer: `<button class="btn btn-ghost" data-ans="0">Cancelar</button><button class="btn ${opts.danger ? 'btn-danger' : 'btn-primary'}" data-ans="1">${esc(opts.confirmText || 'Confirmar')}</button>`
      });
      o.querySelectorAll('[data-ans]').forEach((b) => b.addEventListener('click', () => {
        resolve(b.dataset.ans === '1');
        closeModal(o);
      }));
      o.addEventListener('mousedown', (e) => { if (e.target === o) resolve(false); });
    });
  }

  /* ------------------------------- Prompt (input de texto) ------------------------------- */
  function prompt(title, message, value) {
    return new Promise((resolve) => {
      const o = modal({
        title: title || 'Ingresar valor',
        size: 'sm',
        body: `<div class="confirm-body"><p>${esc(message || '')}</p><input type="text" id="prompt-input" value="${esc(value || '')}" style="width:100%;padding:8px;border:1px solid var(--line);border-radius:8px;margin-top:8px;box-sizing:border-box;"></div>`,
        footer: `<button class="btn btn-ghost" data-ans="0">Cancelar</button><button class="btn btn-primary" data-ans="1">Aceptar</button>`
      });
      const input = o.querySelector('#prompt-input');
      setTimeout(() => input.focus(), 50);
      o.querySelectorAll('[data-ans]').forEach((b) => {
        b.addEventListener('click', () => {
          resolve(b.dataset.ans === '1' ? input.value : null);
          closeModal(o);
        });
      });
      o.addEventListener('mousedown', (e) => { if (e.target === o) resolve(null); });
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { o.querySelector('[data-ans="1"]').click(); } });
    });
  }

  /* ------------------------------- Badges ------------------------------- */
  function badge(text, tone) {
    const t = tone || toneFor(text);
    return `<span class="badge badge-${t}">${esc(text)}</span>`;
  }
  function toneFor(text) {
    const s = String(text || '').toLowerCase();
    if (/(activo|aprobado|pagado|completado|emitido|corporativo|disponible|success|vigente)/.test(s)) return 'success';
    if (/(pendiente|parcial|revisión|verificación|proceso|warning)/.test(s)) return 'warning';
    if (/(suspendido|rechazado|vencido|anulado|error|danger|inactivo)/.test(s)) return 'danger';
    if (/(en servicio|servicio|info|emitida)/.test(s)) return 'info';
    if (/(superadmin|contador|tesorero|auditor)/.test(s)) return 'purple';
    return 'neutral';
  }

  /* ------------------------------ Validación ---------------------------- */
  function normalizeId(v) {
    let s = String(v || '').toUpperCase().replace(/\s+/g, '').replace(/[^VEJ0-9-]/g, '');
    if (!s.includes('-') && /^[VEJ]/.test(s)) s = s[0] + '-' + s.slice(1);
    return s;
  }
  function validId(v) {
    const s = normalizeId(v);
    return /^[VEJ]-[0-9]{7,9}$/.test(s);
  }
  function validEmail(v) {
    return !v || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v));
  }
  function validPhone(v) {
    const d = String(v || '').replace(/\D/g, '');
    return d.length >= 10 && d.length <= 13;
  }
  function idError(v) {
    if (!v) return 'La Cédula / RIF es obligatoria.';
    if (!validId(v)) return 'Formato inválido. Usa V-12345678, E-12345678 o J-123456789.';
    return '';
  }

  /* ------------------------------- Gráficos ----------------------------- */
  const PALETTE = ['#F05A24', '#FF9900', '#005FFF', '#46B6F9', '#FFD200', '#0F1E36', '#7C5CFC', '#1FA97A'];

  function donut(segments, opts) {
    const data = segments.filter((s) => Number(s.value) > 0);
    const total = data.reduce((s, x) => s + Number(x.value), 0);
    const size = (opts && opts.size) || 190;
    const stroke = (opts && opts.stroke) || 26;
    const r = (size - stroke) / 2;
    const c = 2 * Math.PI * r;
    let offset = 0;
    const circles = data.length ? data.map((s, i) => {
      const part = Number(s.value) / total;
      const dash = part * c;
      const el = `<circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${s.color || PALETTE[i % PALETTE.length]}" stroke-width="${stroke}" stroke-dasharray="${dash} ${c - dash}" stroke-dashoffset="${-offset}" transform="rotate(-90 ${size / 2} ${size / 2})" stroke-linecap="butt"><title>${esc(s.label)}: ${usd(s.value)}</title></circle>`;
      offset += dash;
      return el;
    }).join('') : `<circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="#E8EDF5" stroke-width="${stroke}"/>`;
    const center = opts && opts.center !== false
      ? `<text x="50%" y="47%" text-anchor="middle" font-size="12" fill="#6B7C96" font-family="Inter, sans-serif">${esc(opts.centerLabel || 'TOTAL')}</text>
         <text x="50%" y="61%" text-anchor="middle" font-size="19" font-weight="700" fill="#0F1E36" font-family="Sora, sans-serif">${usd(total)}</text>`
      : '';
    return `<div class="donut-wrap">
      <div class="donut-chart" style="width:${size}px;height:${size}px">
        <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${circles}${center}</svg>
      </div>
      <div class="donut-legend">${segments.map((s, i) => `<div class="legend-row"><span class="legend-dot" style="background:${s.color || PALETTE[i % PALETTE.length]}"></span><span class="legend-label">${esc(s.label)}</span><span class="legend-value">${usd(s.value)}</span><span class="legend-pct">${total ? ((Number(s.value) / total) * 100).toFixed(0) : 0}%</span></div>`).join('')}</div>
    </div>`;
  }

  function bars(rows, opts) {
    const max = Math.max(...rows.map((r) => Number(r.value) || 0), 1);
    return `<div class="bars">${rows.map((r, i) => `
      <div class="bar-row">
        <div class="bar-meta"><span>${esc(r.label)}</span><strong>${r.format === 'count' ? num(r.value, 0) : usd(r.value)}</strong></div>
        <div class="bar-track"><span class="bar-fill" style="width:${Math.max(2, (Number(r.value) / max) * 100)}%;background:${r.color || PALETTE[i % PALETTE.length]}"></span></div>
        ${r.sub ? `<span class="bar-sub">${esc(r.sub)}</span>` : ''}
      </div>`).join('')}</div>`;
  }

  function spark(values, color) {
    if (!values || values.length < 2) return '';
    const w = 260, h = 64, max = Math.max(...values), min = Math.min(...values), range = max - min || 1;
    const pts = values.map((v, i) => `${(i / (values.length - 1)) * w},${h - 6 - ((v - min) / range) * (h - 16)}`).join(' ');
    return `<svg class="spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><polyline points="${pts}" fill="none" stroke="${color || '#F05A24'}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
  }

  /* ------------------------------- Tablas ------------------------------- */
  function empty(iconName, title, text, action) {
    return `<div class="empty-state"><span class="empty-ico">${icon(iconName || 'search', 28)}</span><h3>${esc(title)}</h3><p>${esc(text || '')}</p>${action || ''}</div>`;
  }

  function avatar(name, size) {
    const initials = String(name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
    return `<span class="avatar" style="width:${size || 36}px;height:${size || 36}px;font-size:${(size || 36) / 2.6}px">${esc(initials)}</span>`;
  }

  /* ---------------------------- Impresión ------------------------------- */
  const printCss = `
    * { box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; color: #16233A; margin: 0; padding: 28px; font-size: 11px; }
    .report-brand { display:flex; align-items:center; justify-content:space-between; gap:24px; border-bottom:3px solid #F05A24; padding-bottom:14px; margin-bottom:18px; }
    .report-brand img { height:42px; object-fit:contain; }
    .report-title h1 { margin:0; font-size:18px; color:#0F1E36; letter-spacing:.2px; }
    .report-title p { margin:4px 0 0; color:#5B6B82; font-size:10px; }
    .report-meta { text-align:right; color:#5B6B82; font-size:9px; line-height:1.6; }
    h2 { font-size:13px; margin:18px 0 8px; color:#0F1E36; }
    table { width:100%; border-collapse:collapse; margin:8px 0 16px; }
    th { background:#0F1E36; color:#fff; padding:7px 8px; text-align:left; font-size:9px; text-transform:uppercase; letter-spacing:.4px; }
    td { padding:6px 8px; border-bottom:1px solid #E3E8F0; font-size:10px; vertical-align:top; }
    tbody tr:nth-child(even) td { background:#F7F9FC; }
    .num { text-align:right; white-space:nowrap; }
    tfoot td { font-weight:bold; background:#EEF2F8 !important; border-top:2px solid #0F1E36; }
    .doc-box { border:1px solid #C9D3E2; border-radius:8px; padding:14px; margin:12px 0; }
    .grid2 { display:grid; grid-template-columns:1fr 1fr; gap:10px 24px; }
    .field { font-size:10px; }
    .field span { display:block; color:#6B7C96; font-size:8px; text-transform:uppercase; letter-spacing:.4px; margin-bottom:2px; }
    .field strong { font-size:11px; }
    .totals { margin-left:auto; width:48%; }
    .totals div { display:flex; justify-content:space-between; padding:5px 0; border-bottom:1px dotted #CBD4E1; }
    .totals .grand { border-top:2px solid #0F1E36; border-bottom:none; font-size:13px; font-weight:bold; padding-top:8px; }
    .signatures { display:flex; gap:60px; margin-top:54px; }
    .signatures div { flex:1; border-top:1px solid #33445F; padding-top:6px; text-align:center; font-size:9px; color:#4A5C75; }
    .legal { margin-top:24px; font-size:8px; color:#6B7C96; line-height:1.5; border-top:1px solid #E3E8F0; padding-top:8px; }
    .stamp { display:inline-block; border:2px solid #F05A24; color:#F05A24; border-radius:5px; padding:4px 12px; font-weight:bold; font-size:10px; letter-spacing:1px; transform:rotate(-3deg); }
    .no-print { display:none; }
    @page { size: A4 portrait; margin: 12mm; }
  `;

  function reportHeader(title, subtitle, meta) {
    const logo = new URL(IMG.logo, location.href).href;
    return `<div class="report-brand">
      <div style="display:flex;align-items:center;gap:16px">
        <img src="${logo}" alt="ENVIA">
        <div class="report-title"><h1>${esc(title)}</h1><p>${esc(subtitle || 'ENVIA ERP · Administración, contabilidad y tributos')}</p></div>
      </div>
      <div class="report-meta">${meta || ''}<br>RIF J-41000000-0 · Caracas, Venezuela</div>
    </div>`;
  }

  function printHTML(title, bodyHtml, opts) {
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${esc(title)}</title><style>${printCss}</style></head><body>${reportHeader((opts && opts.title) || title, (opts && opts.subtitle) || '', (opts && opts.meta) || '')}${bodyHtml}<div class="legal">Documento generado por ENVIA ERP · ${new Date().toLocaleString('es-VE')} · Moneda funcional: Bolívares (VES) · Tasa BCV: ${bs(rate())} por USD. Este documento cumple con los formatos de control interno y referencia la normativa SENIAT (IVA, IGTF, retenciones de IVA e ISLR Decreto 1.808).</div></body></html>`);
    doc.close();
    setTimeout(() => {
      try {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      } catch (e) {
        console.error(e);
      }
      setTimeout(() => iframe.remove(), 2500);
    }, 450);
    if (opts && opts.after) opts.after();
  }

  function downloadFile(filename, content, type) {
    const blob = new Blob([content], { type: type || 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 800);
  }

  function csv(rows) {
    return '\ufeff' + rows.map((r) => r.map((c) => {
      const s = String(c == null ? '' : c).replace(/"/g, '""');
      return /[",;\n]/.test(s) ? '"' + s + '"' : s;
    }).join(';')).join('\r\n');
  }

  function fileCard(label, ref, opts) {
    const url = NS.supabase.resolve(ref);
    const iconName = url && url.startsWith('data:application/pdf') ? 'file' : 'image';
    return `<div class="file-card ${url ? 'has-file' : 'no-file'}">
      <button type="button" class="file-preview" data-preview="${esc(ref || '')}" data-label="${esc(label)}" ${url ? '' : 'disabled'}>
        ${url ? (url.startsWith('data:image') ? `<img src="${esc(url)}" alt="${esc(label)}">` : `<span class="file-ico">${icon(iconName, 24)}</span>`) : `<span class="file-ico">${icon(iconName, 24)}</span>`}
      </button>
      <div class="file-info">
        <strong>${esc(label)}</strong>
        <span>${url ? 'Documento cargado' : 'Sin documento'}</span>
      </div>
      ${url ? `<button type="button" class="icon-btn" data-preview="${esc(ref || '')}" data-label="${esc(label)}" title="Ver">${icon('eye', 16)}</button>` : ''}
    </div>`;
  }

  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-preview]');
    if (!t) return;
    const ref = t.dataset.preview;
    if (!ref) return;
    const url = NS.supabase.resolve(ref);
    if (!url) return toast('No se encontró el archivo solicitado.', 'warning');
    const isPdf = /^data:application\/pdf/i.test(url) || /\.pdf($|\?)/i.test(url);
    modal({
      title: t.dataset.label || 'Documento',
      size: 'lg',
      body: isPdf
        ? `<iframe src="${esc(url)}" class="doc-frame" title="${esc(t.dataset.label || 'PDF')}"></iframe>`
        : `<div class="doc-viewer"><img src="${esc(url)}" alt="${esc(t.dataset.label || 'Documento')}"></div>`,
      footer: `<a class="btn btn-ghost" href="${esc(url)}" download="${esc((t.dataset.label || 'documento').replace(/\s+/g, '-'))}" target="_blank">${icon('download', 16)} Descargar</a><button class="btn btn-primary" data-close-modal>Cerrar</button>`
    });
  });

  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-close-modal]')) closeModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && openModals.length) closeModal();
  });

  // Helpers globales usados por los módulos (scripts clásicos).
  window.$ = window.$ || $;
  window.$$ = window.$$ || $$;

  NS.ui = {
    $, $$, esc, icon, IMG, PALETTE,    rate, currency, usd, bs, usdRaw, bsRaw, toBs, fromBs, money, moneyBoth, num, pct,
    date, dateLong, dateTime, monthLabel,
    toast, modal, closeModal, closeAllModals, confirm, prompt, badge, toneFor,
    normalizeId, validId, validEmail, validPhone, idError,
    donut, bars, spark, empty, avatar, fileCard,
    printHTML, reportHeader, downloadFile, csv,
    // helpers de formulario
    val: (form, name) => {
      const el = form.elements[name];
      if (!el) return '';
      if (el.type === 'checkbox') return el.checked;
      return String(el.value || '').trim();
    },
    setBusy: (btn, busy, label) => {
      if (!btn) return;
      if (busy) {
        btn.dataset.label = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = `<span class="spinner"></span> ${esc(label || 'Procesando...')}`;
      } else {
        btn.disabled = false;
        if (btn.dataset.label) btn.innerHTML = btn.dataset.label;
      }
    }
  };
})();
