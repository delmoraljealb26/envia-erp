/* =========================================================================
   ENVIA ERP · services/experienceService.js
   Capa de experiencia: tema Dark Fintech / Light Spatial, command palette
   global (módulos, cédulas, RIF, facturas y servicios) y sincronización del
   topbar. No modifica datos, sesión ni reglas de negocio.
   ========================================================================= */
(function () {
  'use strict';

  const NS = (window.ENVIA = window.ENVIA || {});
  const THEME_KEY = 'envia_theme_v2';
  let paletteItems = [];
  let paletteIndex = 0;
  let lastFocused = null;

  /* ------------------------------- Tema ---------------------------------- */
  function preferredTheme() {
    try {
      const saved = localStorage.getItem(THEME_KEY);
      if (saved === 'light' || saved === 'dark') return saved;
    } catch (e) { /* almacenamiento no disponible */ }
    return 'dark';
  }

  function currentTheme() {
    return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
  }

  function syncThemeButton() {
    const btn = document.getElementById('theme-toggle');
    if (!btn) return;
    const light = currentTheme() === 'light';
    btn.innerHTML = NS.ui.icon(light ? 'moon' : 'sun', 18);
    btn.setAttribute('aria-label', light ? 'Activar tema oscuro' : 'Activar tema claro');
    btn.setAttribute('title', light ? 'Cambiar a Dark Fintech' : 'Cambiar a Light Spatial');
    btn.setAttribute('aria-pressed', light ? 'true' : 'false');
  }

  function applyTheme(theme, persist) {
    const next = theme === 'light' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    document.body.classList.toggle('theme-light', next === 'light');
    document.body.classList.toggle('theme-dark', next === 'dark');
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', next === 'dark' ? '#07101F' : '#F4F7FC');
    if (persist) {
      try { localStorage.setItem(THEME_KEY, next); } catch (e) { /* ignorar */ }
    }
    syncThemeButton();
  }

  function toggleTheme() {
    const next = currentTheme() === 'light' ? 'dark' : 'light';
    applyTheme(next, true);
    // El cambio de tema es evidente por sí mismo; no se apilan avisos.
  }

  /* --------------------------- Command palette --------------------------- */
  function normalize(value) {
    return String(value == null ? '' : value)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  function access(module) {
    try {
      return !!(NS.session && NS.session.can && NS.session.can(module));
    } catch (e) { return false; }
  }

  function personName(rec) {
    return [rec.nombres, rec.apellidos].filter(Boolean).join(' ').trim() || rec.cedula_rif || rec.rif || '';
  }

  function go(module, sub) {
    if (!NS.router) return;
    try {
      if (sub) NS.router.navigate(module + '?sub=' + encodeURIComponent(sub), true);
      else NS.router.navigate(module, true);
    } catch (e) {
      if (NS.ui && NS.ui.toast) NS.ui.toast('No se pudo abrir el módulo.', 'error');
    }
  }

  function later(fn) {
    setTimeout(function () {
      try { fn(); } catch (e) { /* la vista aún no está lista */ }
    }, 220);
  }

  function moduleItems() {
    if (!NS.router || !NS.router.MODULES) return [];
    return Object.keys(NS.router.MODULES)
      .map(function (key) { return NS.router.MODULES[key]; })
      .filter(function (m) { return access(m.module); })
      .map(function (m) {
        return {
          type: 'Módulo',
          tone: 'blue',
          icon: m.icon,
          title: m.label,
          meta: m.sub || 'Abrir módulo',
          search: normalize(m.label + ' ' + m.sub + ' ' + m.module),
          run: function () { go(m.module); }
        };
      });
  }

  function buildResults() {
    const db = (NS.store && NS.store.db) ? NS.store.db : {};
    const items = moduleItems();

    if (access('clients')) {
      (db.clients || []).slice(0, 250).forEach(function (c) {
        const name = personName(c);
        items.push({
          type: 'Cliente',
          tone: 'orange',
          icon: 'users',
          title: name,
          meta: c.cedula_rif + ' · ' + (c.estatus || 'Cliente'),
          search: normalize(name + ' ' + c.cedula_rif + ' ' + (c.telefono || '') + ' ' + (c.correo || '')),
          run: function () {
            go('clients');
            later(function () { if (NS.modules.clients && NS.modules.clients.openDetail) NS.modules.clients.openDetail(c.cedula_rif); });
          }
        });
      });
    }

    if (access('drivers')) {
      (db.drivers || []).slice(0, 250).forEach(function (d) {
        const name = personName(d);
        items.push({
          type: 'Conductor',
          tone: 'sky',
          icon: 'car',
          title: name,
          meta: d.cedula_rif + ' · ' + (d.estatus_conductor || 'Conductor'),
          search: normalize(name + ' ' + d.cedula_rif + ' ' + (d.placa || '') + ' ' + (d.telefono || '')),
          run: function () {
            go('drivers');
            later(function () { if (NS.modules.drivers && NS.modules.drivers.openDetail) NS.modules.drivers.openDetail(d.cedula_rif); });
          }
        });
      });
    }

    if (access('payables')) {
      (db.payables || []).slice(0, 300).forEach(function (p) {
        const sup = (db.suppliers || []).find(function (s) { return s.rif === p.proveedor_rif; });
        const title = 'Factura ' + (p.numero_factura || p.id);
        items.push({
          type: 'Factura',
          tone: 'amber',
          icon: 'receipt',
          title: title,
          meta: (sup ? sup.razon_social : p.proveedor_rif) + ' · ' + (p.estatus || 'Pendiente'),
          search: normalize(title + ' ' + (p.numero_factura || '') + ' ' + (p.proveedor_rif || '') + ' ' + (p.control || '') + ' ' + (sup ? sup.razon_social : '')),
          run: function () {
            go('payables');
            later(function () { if (NS.modules.payables && NS.modules.payables.openDetail) NS.modules.payables.openDetail(p.id); });
          }
        });
      });
    }

    if (access('services')) {
      (db.services || []).slice(0, 300).forEach(function (s) {
        const client = (db.clients || []).find(function (c) { return c.cedula_rif === s.cliente_cedula_rif; });
        const driver = (db.drivers || []).find(function (d) { return d.cedula_rif === s.conductor_cedula_rif; });
        items.push({
          type: s.tipo === 'encomienda' ? 'Encomienda' : 'Carrera',
          tone: s.tipo === 'encomienda' ? 'orange' : 'blue',
          icon: s.tipo === 'encomienda' ? 'package' : 'route',
          title: s.id,
          meta: (client ? personName(client) : s.cliente_cedula_rif) + ' · ' + (driver ? personName(driver) : s.conductor_cedula_rif),
          search: normalize(s.id + ' ' + s.cliente_cedula_rif + ' ' + s.conductor_cedula_rif + ' ' + (s.origen || '') + ' ' + (s.destino || '') + ' ' + (client ? personName(client) : '')),
          run: function () {
            go('services');
            later(function () { if (NS.modules.services && NS.modules.services.openDetail) NS.modules.services.openDetail(s.id); });
          }
        });
      });
    }

    if (access('inventory')) {
      (db.products || []).slice(0, 120).forEach(function (prod) {
        items.push({
          type: 'Producto',
          tone: 'amber',
          icon: 'package',
          title: prod.nombre,
          meta: (prod.sku || 'SKU') + ' · ' + (prod.stock || 0) + ' disponibles',
          search: normalize(prod.nombre + ' ' + (prod.sku || '') + ' ' + (prod.categoria || '')),
          run: function () { go('inventory'); }
        });
      });
    }

    return items;
  }

  function filteredResults(query) {
    const all = buildResults();
    const q = normalize(query).trim();
    if (!q) return all.slice(0, 14);
    const words = q.split(/\s+/).filter(Boolean);
    const scored = [];
    all.forEach(function (item) {
      const hay = item.search || normalize(item.title + ' ' + item.meta);
      if (!words.every(function (w) { return hay.indexOf(w) !== -1; })) return;
      let score = 0;
      if (normalize(item.title) === q) score += 100;
      else if (normalize(item.title).indexOf(q) === 0) score += 60;
      else if (normalize(item.title).indexOf(q) !== -1) score += 30;
      if (normalize(item.meta).indexOf(q) !== -1) score += 12;
      if (item.type === 'Módulo') score += 4;
      scored.push({ item: item, score: score });
    });
    scored.sort(function (a, b) { return b.score - a.score; });
    return scored.slice(0, 18).map(function (s) { return s.item; });
  }

  function resultHTML(item, index) {
    return '<button type="button" class="command-item ' + (index === paletteIndex ? 'is-active' : '') + '" data-command-index="' + index + '" role="option" aria-selected="' + (index === paletteIndex ? 'true' : 'false') + '">' +
      '<span class="command-ico command-ico-' + item.tone + '">' + NS.ui.icon(item.icon, 18) + '</span>' +
      '<span class="command-text"><strong>' + NS.ui.esc(item.title) + '</strong><small>' + NS.ui.esc(item.meta) + '</small></span>' +
      '<span class="command-type">' + NS.ui.esc(item.type) + '</span>' +
      '<span class="command-enter">↵</span>' +
    '</button>';
  }

  function renderPalette() {
    const results = document.getElementById('command-results');
    const input = document.getElementById('command-input');
    if (!results || !input) return;
    const query = input.value || '';
    paletteItems = filteredResults(query);
    if (paletteIndex >= paletteItems.length) paletteIndex = Math.max(0, paletteItems.length - 1);
    if (!paletteItems.length) {
      results.innerHTML = '<div class="command-empty"><span>' + NS.ui.icon('search', 24) + '</span><strong>Sin coincidencias</strong><p>Prueba con un módulo, una cédula, un RIF o un número de factura.</p></div>';
      return;
    }
    results.innerHTML = paletteItems.map(resultHTML).join('');
    const active = results.querySelector('.command-item.is-active');
    if (active && active.scrollIntoView) active.scrollIntoView({ block: 'nearest' });
  }

  function movePalette(delta) {
    if (!paletteItems.length) return;
    paletteIndex = (paletteIndex + delta + paletteItems.length) % paletteItems.length;
    renderPalette();
  }

  function runPalette(index) {
    const item = paletteItems[index];
    if (!item) return;
    closePalette();
    item.run();
  }

  function openPalette(prefill) {
    const root = document.getElementById('command-palette');
    const input = document.getElementById('command-input');
    if (!root || !input) return;
    lastFocused = document.activeElement;
    root.classList.remove('hidden');
    document.body.classList.add('command-open');
    input.value = prefill || '';
    paletteIndex = 0;
    const ico = document.getElementById('command-search-ico');
    if (ico) ico.innerHTML = NS.ui.icon('search', 16);
    renderPalette();
    setTimeout(function () { input.focus(); input.select(); }, 40);
  }

  function closePalette() {
    const root = document.getElementById('command-palette');
    if (!root) return;
    root.classList.add('hidden');
    document.body.classList.remove('command-open');
    if (lastFocused && lastFocused.focus) {
      try { lastFocused.focus(); } catch (e) { /* ignorar */ }
    }
  }

  function syncTopbar() {
    syncThemeButton();
    const searchIco = document.getElementById('command-search-ico');
    if (searchIco && !searchIco.innerHTML.trim()) searchIco.innerHTML = NS.ui.icon('search', 16);
    const isMac = /Mac|iPhone|iPad/.test(navigator.platform || '');
    document.querySelectorAll('[data-command-kbd]').forEach(function (kbd) {
      kbd.textContent = isMac ? '⌘ K' : 'Ctrl K';
    });
    const trigger = document.getElementById('command-trigger');
    if (trigger && !trigger.querySelector('.command-trigger-ico')) {
      trigger.insertAdjacentHTML('afterbegin', '<span class="command-trigger-ico">' + NS.ui.icon('search', 17) + '</span>');
    }
    const triggerIco = document.getElementById('command-trigger');
    if (triggerIco) {
      const ico = triggerIco.querySelector('.command-trigger-ico');
      if (ico) ico.innerHTML = NS.ui.icon('search', 17);
    }
  }

  /* ------------------------------ Eventos -------------------------------- */
  function bindPalette() {
    const input = document.getElementById('command-input');
    const results = document.getElementById('command-results');
    if (input) {
      input.addEventListener('input', function () { paletteIndex = 0; renderPalette(); });
      input.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowDown') { e.preventDefault(); movePalette(1); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); movePalette(-1); }
        else if (e.key === 'Enter') { e.preventDefault(); runPalette(paletteIndex); }
        else if (e.key === 'Escape') { e.preventDefault(); closePalette(); }
      });
    }
    if (results) {
      results.addEventListener('click', function (e) {
        const btn = e.target.closest('[data-command-index]');
        if (!btn) return;
        runPalette(Number(btn.dataset.commandIndex));
      });
      results.addEventListener('mousemove', function (e) {
        const btn = e.target.closest('[data-command-index]');
        if (!btn) return;
        const idx = Number(btn.dataset.commandIndex);
        if (idx === paletteIndex) return;
        paletteIndex = idx;
        results.querySelectorAll('.command-item').forEach(function (el, i) {
          el.classList.toggle('is-active', i === paletteIndex);
          el.setAttribute('aria-selected', i === paletteIndex ? 'true' : 'false');
        });
      });
    }
  }

  document.addEventListener('click', function (e) {
    if (e.target.closest('#theme-toggle,[data-theme-toggle]')) {
      e.preventDefault();
      toggleTheme();
      return;
    }
    if (e.target.closest('#command-trigger,[data-command-open]')) {
      e.preventDefault();
      openPalette('');
      return;
    }
    if (e.target.closest('[data-command-close]')) {
      closePalette();
    }
  });

  document.addEventListener('keydown', function (e) {
    const key = String(e.key || '').toLowerCase();
    if ((e.ctrlKey || e.metaKey) && key === 'k') {
      e.preventDefault();
      const root = document.getElementById('command-palette');
      if (root && !root.classList.contains('hidden')) closePalette();
      else openPalette('');
      return;
    }
    if (e.key === 'Escape') {
      const root = document.getElementById('command-palette');
      if (root && !root.classList.contains('hidden')) closePalette();
    }
  });

  /* ------------------------------ Arranque ------------------------------- */
  applyTheme(preferredTheme(), false);
  document.addEventListener('DOMContentLoaded', function () {
    bindPalette();
    syncTopbar();
    if (window.matchMedia) {
      const mq = window.matchMedia('(prefers-color-scheme: light)');
      if (mq.addEventListener) mq.addEventListener('change', function () {
        try { if (!localStorage.getItem(THEME_KEY)) applyTheme(mq.matches ? 'light' : 'dark', false); } catch (e) { /* ignorar */ }
      });
    }
  });

  NS.experience = {
    applyTheme: applyTheme,
    toggleTheme: toggleTheme,
    currentTheme: currentTheme,
    openPalette: openPalette,
    closePalette: closePalette,
    syncTopbar: syncTopbar
  };
})();
