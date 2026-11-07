/* =========================================================================
   ENVIA ERP · modules/accounting.js
   Contabilidad venezolana: plan de cuentas, reglas automáticas, asientos,
   libro diario, mayor, balance, resultados y libros SENIAT (ventas/compras).
   ========================================================================= */
(function () {
  'use strict';
  const NS = (window.ENVIA = window.ENVIA || {});
  NS.modules = NS.modules || {};

  const TABS = [
    { id: 'entries', label: 'Asientos', icon: 'book' },
    { id: 'accounts', label: 'Plan de cuentas', icon: 'grid' },
    { id: 'rules', label: 'Reglas automáticas', icon: 'settings' },
    { id: 'journal', label: 'Libro Diario', icon: 'file' },
    { id: 'ledger', label: 'Libro Mayor', icon: 'chart' },
    { id: 'trial', label: 'Balance de Comprobación', icon: 'activity' },
    { id: 'balance', label: 'Balance General', icon: 'grid' },
    { id: 'income', label: 'Estado de Resultados', icon: 'trendUp' },
    { id: 'sales', label: 'Libro de Ventas', icon: 'receipt' },
    { id: 'purchases', label: 'Libro de Compras', icon: 'wallet' }
  ];

  let state = {
    tab: 'entries',
    q: '',
    accountQ: '',
    ledgerAccount: '1.1.1.02',
    from: NS.store.iso(60),
    to: NS.store.today()
  };

  const ACC = () => NS.store.db.accounts;
  const leafAccounts = () => ACC().filter((a) => a.nivel === 'Cuenta de Movimiento');

  function render(view) {
    const ui = NS.ui;
    const store = NS.store;
    const db = store.db;
    const tb = store.trialBalance();
    const totals = tb.reduce((s, r) => ({ debe: s.debe + r.debe, haber: s.haber + r.haber, deudor: s.deudor + r.deudor, acreedor: s.acreedor + r.acreedor }), { debe: 0, haber: 0, deudor: 0, acreedor: 0 });
    const diff = Math.abs(totals.debe - totals.haber);
    const canWrite = NS.app.canAction('accounting', 'editar');
    const canDelete = NS.app.canAction('accounting', 'eliminar');
    const allowedTabs = TABS.filter((t) => NS.app.canTab('accounting', t.id));
    if (!allowedTabs.length) {
      view.innerHTML = ui.empty('lock', 'Sin opciones contables asignadas', 'Tu rol no tiene pestañas habilitadas dentro de Contabilidad. Solicita permisos al administrador.');
      return;
    }
    if (!allowedTabs.some((t) => t.id === state.tab)) state.tab = allowedTabs[0].id;

    view.innerHTML = `
      <div class="page-head">
        <div>
          <span class="eyebrow">Contabilidad · normativa SENIAT / VEN-NIF</span>
          <h2 class="page-title">Contabilidad y libros fiscales</h2>
          <p class="page-sub">${db.entries.length} asientos · ${db.accounts.length} cuentas · ${db.accountingRules.length} reglas automáticas · Moneda funcional VES a tasa ${ui.bs(db.taxParams.bcvRate)} / USD.</p>
        </div>
        <div class="page-actions">
          ${NS.reports.button('accounting')}
          <span class="balance-chip ${diff < 0.02 ? 'ok' : 'bad'}">${ui.icon(diff < 0.02 ? 'check' : 'alert', 15)} ${diff < 0.02 ? 'Partida doble cuadrada' : 'Descuadre ' + ui.bs(diff)}</span>
          ${NS.app.canAction('accounting', 'crear') ? `<button class="btn btn-primary" id="acc-new-entry">${ui.icon('plus', 16)} Asiento manual</button>` : ''}
        </div>
      </div>

      <div class="stat-strip">
        <div class="stat-strip-item"><span>Total DEBE</span><strong>${ui.bs(totals.debe)}</strong><small>${ui.usd(totals.debe / ui.rate())} referencial</small></div>
        <div class="stat-strip-item"><span>Total HABER</span><strong>${ui.bs(totals.haber)}</strong><small>${ui.usd(totals.haber / ui.rate())} referencial</small></div>
        <div class="stat-strip-item"><span>Diferencia</span><strong class="${diff < 0.02 ? 'text-success' : 'text-danger'}">${ui.bs(diff)}</strong><small>${diff < 0.02 ? 'DEBE = HABER ✓' : 'Revisar asientos'}</small></div>
        <div class="stat-strip-item"><span>Resultado del ejercicio</span><strong class="${store.incomeStatement().profit >= 0 ? 'text-success' : 'text-danger'}">${ui.bs(store.incomeStatement().profit)}</strong><small>Ingresos − Costos − Gastos</small></div>
      </div>

      <div class="tabs-scroll">
        <div class="tabs">
          ${allowedTabs.map((t) => `<button class="tab ${state.tab === t.id ? 'active' : ''}" data-tab="${t.id}">${ui.icon(t.icon, 15)} ${t.label}</button>`).join('')}
        </div>
      </div>
      <div id="acc-tab-content"></div>
    `;

    view.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => {
      state.tab = b.dataset.tab;
      render(view);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }));
    const newEntry = $('#acc-new-entry');
    if (newEntry) newEntry.addEventListener('click', () => openEntryForm());

    const content = view.querySelector('#acc-tab-content');
    if (state.tab === 'entries') renderEntries(content);
    else if (state.tab === 'accounts') renderAccounts(content, view);
    else if (state.tab === 'rules') renderRules(content, view);
    else if (state.tab === 'journal') renderJournal(content, view);
    else if (state.tab === 'ledger') renderLedger(content, view);
    else if (state.tab === 'trial') renderTrial(content);
    else if (state.tab === 'balance') renderBalance(content);
    else if (state.tab === 'income') renderIncome(content);
    else if (state.tab === 'sales') renderSales(content, view);
    else if (state.tab === 'purchases') renderPurchases(content, view);
  }

  /* ----------------------------- ASIENTOS ----------------------------- */
  function renderEntries(el) {
    const ui = NS.ui;
    const db = NS.store.db;
    const canDelete = NS.app.canAction('accounting', 'eliminar');
    const q = state.q.toLowerCase();
    const list = db.entries.slice().sort((a, b) => b.fecha.localeCompare(a.fecha) || b.numero.localeCompare(a.numero)).filter((e) => {
      if (!q) return true;
      return [e.numero, e.descripcion, e.referencia, e.origen].join(' ').toLowerCase().includes(q);
    });

    el.innerHTML = `<section class="card card-flush">
      <div class="toolbar">
        <div class="search-box">${ui.icon('search', 17)}<input id="entry-search" type="search" placeholder="Buscar por número, descripción, referencia..." value="${ui.esc(state.q)}"></div>
        <div class="toolbar-right">
          <button class="btn btn-ghost btn-sm" id="entries-print">${ui.icon('print', 15)} Imprimir libro</button>
          <button class="btn btn-ghost btn-sm" id="entries-export">${ui.icon('download', 15)} CSV</button>
          <span class="count-chip">${list.length} asientos</span>
        </div>
      </div>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Número</th><th>Fecha</th><th>Descripción</th><th>Referencia</th><th>Origen</th><th class="num">DEBE</th><th class="num">HABER</th><th>Cuadre</th><th class="actions-col"></th></tr></thead>
          <tbody>
            ${list.length ? list.map((e) => {
              const d = e.lines.reduce((s, l) => s + Number(l.debe), 0);
              const h = e.lines.reduce((s, l) => s + Number(l.haber), 0);
              return `<tr>
                <td><strong class="mono">${ui.esc(e.numero)}</strong><small class="block muted">${e.lines.length} líneas</small></td>
                <td>${ui.date(e.fecha)}</td>
                <td class="wrap-cell"><span class="truncate" title="${ui.esc(e.descripcion)}">${ui.esc(e.descripcion)}</span></td>
                <td class="mono small">${ui.esc(e.referencia || '—')}</td>
                <td>${ui.badge(e.origen, e.origen === 'manual' ? 'purple' : 'neutral')}</td>
                <td class="num">${ui.bs(d)}</td>
                <td class="num">${ui.bs(h)}</td>
                <td>${Math.abs(d - h) < 0.02 ? ui.badge('Cuadra', 'success') : ui.badge('Descuadre', 'danger')}</td>
                <td class="actions-col">
                  <button class="icon-btn" data-view-entry="${ui.esc(e.id)}" title="Ver comprobante">${ui.icon('eye', 16)}</button>
                  ${canDelete && e.origen === 'manual' ? `<button class="icon-btn danger" data-del-entry="${ui.esc(e.id)}" title="Eliminar asiento manual">${ui.icon('trash', 16)}</button>` : ''}
                </td>
              </tr>`;
            }).join('') : `<tr><td colspan="9">${ui.empty('book', 'Sin asientos', 'No hay partidas que coincidan con la búsqueda.')}</td></tr>`}
          </tbody>
        </table>
      </div>
    </section>`;

    let t;
    el.querySelector('#entry-search').addEventListener('input', (ev) => {
      state.q = ev.target.value;
      clearTimeout(t);
      t = setTimeout(() => {
        const parent = el.parentElement;
        renderEntries(el);
        const inp = el.querySelector('#entry-search');
        if (inp) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
      }, 180);
    });
    el.querySelectorAll('[data-view-entry]').forEach((b) => b.addEventListener('click', () => openEntry(b.dataset.viewEntry)));
    el.querySelectorAll('[data-del-entry]').forEach((b) => b.addEventListener('click', () => askDeleteEntry(b.dataset.delEntry)));
    el.querySelector('#entries-export').addEventListener('click', exportEntriesCsv);
    el.querySelector('#entries-print').addEventListener('click', printJournal);
  }

  function askDeleteEntry(id) {
    const ui = NS.ui;
    const e = NS.store.db.entries.find((x) => x.id === id);
    ui.confirm({
      title: 'Eliminar asiento manual',
      message: `Se eliminará el asiento ${e ? e.numero : ''} de ${ui.bs(e ? e.lines.reduce((s, l) => s + l.debe, 0) : 0)}. Esta acción altera los libros contables. ¿Continuar?`,
      confirmText: 'Eliminar asiento', danger: true
    }).then((ok) => {
      if (!ok) return;
      NS.store.deleteEntry(id);
      ui.toast('Asiento eliminado.', 'success');
      NS.app.refresh(true);
    });
  }

  function openEntry(id) {
    const ui = NS.ui;
    const e = NS.store.db.entries.find((x) => x.id === id);
    if (!e) return;
    const total = e.lines.reduce((s, l) => s + Number(l.debe), 0);
    const body = `
      <div class="entry-doc-head">
        <div><span>Comprobante de asiento contable</span><strong class="mono">${ui.esc(e.numero)}</strong></div>
        <div class="entry-doc-meta"><span>${ui.dateLong(e.fecha)}</span><span>Tasa BCV ${ui.bs(e.tasa_bcv)} / USD</span></div>
      </div>
      <p class="entry-desc">${ui.esc(e.descripcion)}</p>
      <div class="entry-refs"><span>Referencia: <strong>${ui.esc(e.referencia || '—')}</strong></span><span>Origen: <strong>${ui.esc(e.origen)}</strong></span><span>Registrado: <strong>${ui.dateTime(e.created_at)}</strong></span></div>
      <table class="mini-table entry-lines">
        <thead><tr><th>Código</th><th>Cuenta</th><th class="num">DEBE</th><th class="num">HABER</th></tr></thead>
        <tbody>
          ${e.lines.map((l) => `<tr><td class="mono">${ui.esc(l.cuenta)}</td><td>${ui.esc(NS.store.accountName(l.cuenta))}</td><td class="num">${l.debe ? ui.bs(l.debe) : ''}</td><td class="num">${l.haber ? ui.bs(l.haber) : ''}</td></tr>`).join('')}
        </tbody>
        <tfoot><tr><td colspan="2">Totales · ${Math.abs(total - e.lines.reduce((s, l) => s + Number(l.haber), 0)) < 0.02 ? 'Partida doble cuadrada' : 'Descuadre'}</td><td class="num">${ui.bs(total)}</td><td class="num">${ui.bs(e.lines.reduce((s, l) => s + Number(l.haber), 0))}</td></tr></tfoot>
      </table>
      <div class="entry-foot"><span>Elaborado por: ${ui.esc(NS.app.session.nombre)}</span><span>ENVIA ERP · Contabilidad</span></div>`;
    const overlay = ui.modal({
      title: 'Asiento contable',
      eyebrow: 'Libro Diario · comprobante',
      size: 'lg',
      body,
      footer: `<button class="btn btn-ghost" id="print-entry">${ui.icon('print', 15)} Imprimir</button><button class="btn btn-primary" data-close-modal>Cerrar</button>`
    });
    overlay.querySelector('#print-entry').addEventListener('click', () => {
      ui.printHTML('Comprobante de Asiento', body, { title: 'Comprobante de Asiento Contable', subtitle: 'ENVIA ERP · Partida doble' });
    });
  }

  function openEntryForm() {
    const ui = NS.ui;
    if (!NS.app.canAction('accounting', 'crear')) return ui.toast('No tienes permiso para crear asientos.', 'warning');
    const options = leafAccounts().map((a) => `<option value="${ui.esc(a.codigo)}">${ui.esc(a.codigo)} · ${ui.esc(a.nombre)}</option>`).join('');
    const lineHtml = (d, h) => `<div class="entry-line" data-line>
      <select class="line-account">${options}</select>
      <input class="line-debe" type="number" min="0" step="0.01" placeholder="DEBE" value="${d || ''}">
      <input class="line-haber" type="number" min="0" step="0.01" placeholder="HABER" value="${h || ''}">
      <button type="button" class="icon-btn line-remove" title="Quitar línea">${ui.icon('x', 15)}</button>
    </div>`;
    const overlay = ui.modal({
      title: 'Nuevo asiento manual',
      eyebrow: 'Contabilidad · partida doble',
      subtitle: 'Todo asiento debe cumplir estrictamente: Suma del DEBE = Suma del HABER.',
      size: 'lg',
      body: `<form id="entry-form">
        <div class="form-grid">
          <label class="field"><span>Fecha *</span><input name="fecha" type="date" value="${NS.store.today()}" required></label>
          <label class="field"><span>Referencia</span><input name="referencia" placeholder="Documento / comprobante"></label>
          <label class="field field-full"><span>Descripción *</span><input name="descripcion" placeholder="Concepto del asiento" required></label>
        </div>
        <div class="entry-lines-head"><span>Cuenta contable</span><span>DEBE</span><span>HABER</span><span></span></div>
        <div id="entry-lines">${lineHtml()}</div>
        <button type="button" class="btn btn-ghost btn-sm" id="add-line">${ui.icon('plus', 14)} Agregar línea</button>
        <div class="entry-totals" id="entry-totals">
          <div><span>Total DEBE</span><strong>Bs 0,00</strong></div>
          <div><span>Total HABER</span><strong>Bs 0,00</strong></div>
          <div class="entry-diff"><span>Diferencia</span><strong>Bs 0,00</strong></div>
        </div>
      </form>`,
      footer: `<button class="btn btn-ghost" data-cancel>Cancelar</button><button class="btn btn-primary" id="entry-save">${ui.icon('check', 16)} Registrar asiento</button>`
    });

    const form = overlay.querySelector('#entry-form');
    const linesBox = overlay.querySelector('#entry-lines');
    const optionsHtml = options;

    const updateTotals = () => {
      let d = 0, h = 0;
      linesBox.querySelectorAll('[data-line]').forEach((row) => {
        d += Number(row.querySelector('.line-debe').value) || 0;
        h += Number(row.querySelector('.line-haber').value) || 0;
      });
      const box = overlay.querySelector('#entry-totals');
      const diff = d - h;
      box.querySelectorAll('strong')[0].textContent = ui.bs(d);
      box.querySelectorAll('strong')[1].textContent = ui.bs(h);
      box.querySelectorAll('strong')[2].textContent = ui.bs(Math.abs(diff));
      box.querySelector('.entry-diff').classList.toggle('ok', Math.abs(diff) < 0.011 && d > 0);
      box.querySelector('.entry-diff').classList.toggle('bad', Math.abs(diff) >= 0.011);
    };
    const bindRow = (row) => {
      row.querySelector('.line-debe').addEventListener('input', () => { if (row.querySelector('.line-debe').value) row.querySelector('.line-haber').value = ''; updateTotals(); });
      row.querySelector('.line-haber').addEventListener('input', () => { if (row.querySelector('.line-haber').value) row.querySelector('.line-debe').value = ''; updateTotals(); });
      row.querySelector('.line-remove').addEventListener('click', () => {
        if (linesBox.children.length <= 2) return ui.toast('Un asiento requiere al menos dos líneas.', 'warning');
        row.remove(); updateTotals();
      });
    };
    linesBox.querySelectorAll('[data-line]').forEach(bindRow);
    overlay.querySelector('#add-line').addEventListener('click', () => {
      linesBox.insertAdjacentHTML('beforeend', `<div class="entry-line" data-line>
        <select class="line-account">${optionsHtml}</select>
        <input class="line-debe" type="number" min="0" step="0.01" placeholder="DEBE">
        <input class="line-haber" type="number" min="0" step="0.01" placeholder="HABER">
        <button type="button" class="icon-btn line-remove" title="Quitar línea">${NS.ui.icon('x', 15)}</button>
      </div>`);
      bindRow(linesBox.lastElementChild);
      updateTotals();
    });
    overlay.querySelector('[data-cancel]').addEventListener('click', () => ui.closeModal(overlay));
    overlay.querySelector('#entry-save').addEventListener('click', () => {
      if (!form.reportValidity()) return;
      const lines = [];
      let valid = true;
      linesBox.querySelectorAll('[data-line]').forEach((row) => {
        const cuenta = row.querySelector('.line-account').value;
        const debe = Number(row.querySelector('.line-debe').value) || 0;
        const haber = Number(row.querySelector('.line-haber').value) || 0;
        if (!debe && !haber) return;
        if (!cuenta) valid = false;
        lines.push({ cuenta, debe, haber });
      });
      if (!valid || lines.length < 2) return ui.toast('Completa al menos dos líneas con cuenta y monto.', 'error');
      try {
        const entry = NS.store.postEntry({
          fecha: form.elements.fecha.value,
          descripcion: form.elements.descripcion.value,
          referencia: form.elements.referencia.value,
          origen: 'manual',
          lines
        });
        ui.closeModal(overlay);
        ui.toast('Asiento ' + entry.numero + ' registrado y cuadrado.', 'success');
        NS.app.refresh(true);
      } catch (e) { ui.toast(e.message, 'error'); }
    });
  }

  /* --------------------------- PLAN DE CUENTAS ------------------------- */
  function renderAccounts(el, view) {
    const ui = NS.ui;
    const db = NS.store.db;
    const canWrite = NS.app.canAction('accounting', 'editar');
    const canCreate = NS.app.canAction('accounting', 'crear');
    const canDelete = NS.app.canAction('accounting', 'eliminar');
    const q = state.accountQ.toLowerCase();
    const balances = NS.store.getAccountBalances();
    const balMap = {};
    balances.forEach((b) => { balMap[b.account.codigo] = b; });
    const list = ACC().filter((a) => !q || (a.codigo + ' ' + a.nombre + ' ' + a.nivel).toLowerCase().includes(q));

    el.innerHTML = `<section class="card card-flush">
      <div class="toolbar">
        <div class="search-box">${ui.icon('search', 17)}<input id="account-search" type="search" placeholder="Buscar cuenta por código o nombre..." value="${ui.esc(state.accountQ)}"></div>
        <div class="toolbar-right">
          <button class="btn btn-ghost btn-sm" id="accounts-print">${ui.icon('print', 15)} Imprimir plan</button>
          ${canCreate ? `<button class="btn btn-primary btn-sm" id="account-new">${ui.icon('plus', 15)} Nueva cuenta</button>` : ''}
        </div>
      </div>
      <div class="table-wrap">
        <table class="data-table account-table">
          <thead><tr><th>Código</th><th>Nombre de la cuenta</th><th>Nivel</th><th>Naturaleza</th><th>Moneda</th><th>Estado</th><th class="num">Saldo (VES)</th><th class="actions-col"></th></tr></thead>
          <tbody>
            ${list.length ? list.map((a) => {
              const b = balMap[a.codigo];
              const saldo = b ? b.saldo : 0;
              const lvl = a.nivel === 'Grupo' ? 1 : a.nivel === 'Subgrupo' ? 2 : a.nivel === 'Rubro' ? 3 : 4;
              return `<tr class="lvl-${lvl}">
                <td><span class="acc-code">${ui.esc(a.codigo)}</span></td>
                <td><span class="acc-name" style="padding-left:${(lvl - 1) * 14}px">${lvl > 1 ? '<span class="tree-line"></span>' : ''}${ui.esc(a.nombre)}</span></td>
                <td><span class="level-pill">${ui.esc(a.nivel)}</span></td>
                <td><span class="nat ${a.naturaleza === 'Deudora' ? 'nat-d' : 'nat-a'}">${ui.esc(a.naturaleza)}</span></td>
                <td>${ui.esc(a.moneda)}</td>
                <td>${ui.badge(a.estado)}</td>
                <td class="num">${b && (b.debe || b.haber) ? `<strong>${ui.bs(Math.abs(saldo))}</strong><small class="block muted">${saldo >= 0 ? 'Deudor' : 'Acreedor'}</small>` : '<span class="muted">—</span>'}</td>
                <td class="actions-col">
                  ${canWrite ? `<button class="icon-btn" data-edit-account="${ui.esc(a.codigo)}" title="Editar">${ui.icon('edit', 15)}</button>` : ''}
                  ${canDelete ? `<button class="icon-btn danger" data-del-account="${ui.esc(a.codigo)}" title="Eliminar">${ui.icon('trash', 15)}</button>` : ''}
                </td>
              </tr>`;
            }).join('') : `<tr><td colspan="8">${ui.empty('grid', 'Sin cuentas', 'Ajusta la búsqueda o crea una nueva cuenta contable.')}</td></tr>`}
          </tbody>
        </table>
      </div>
      <div class="card-foot-note">${ui.icon('info', 14)} Estructura: <strong>1</strong> Activos · <strong>2</strong> Pasivos · <strong>3</strong> Patrimonio · <strong>4</strong> Ingresos · <strong>5</strong> Costos · <strong>6</strong> Gastos. Puedes crear, editar y jerarquizar cuentas libremente.</div>
    </section>`;

    let t;
    el.querySelector('#account-search').addEventListener('input', (e) => {
      state.accountQ = e.target.value;
      clearTimeout(t);
      t = setTimeout(() => {
        renderAccounts(el, view);
        const inp = el.querySelector('#account-search');
        if (inp) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
      }, 160);
    });
    el.querySelectorAll('[data-edit-account]').forEach((b) => b.addEventListener('click', () => openAccountForm(b.dataset.editAccount)));
    el.querySelectorAll('[data-del-account]').forEach((b) => b.addEventListener('click', () => askDeleteAccount(b.dataset.delAccount)));
    const newAccount = el.querySelector('#account-new');
    if (newAccount) newAccount.addEventListener('click', () => openAccountForm());
    el.querySelector('#accounts-print').addEventListener('click', () => {
      const rows = ACC().map((a) => `<tr><td class="mono">${ui.esc(a.codigo)}</td><td>${ui.esc(a.nombre)}</td><td>${ui.esc(a.nivel)}</td><td>${ui.esc(a.naturaleza)}</td><td>${ui.esc(a.moneda)}</td><td>${ui.esc(a.estado)}</td></tr>`).join('');
      ui.printHTML('Plan de Cuentas', `<h2>Plan de Cuentas Contable</h2><table><thead><tr><th>Código</th><th>Nombre</th><th>Nivel</th><th>Naturaleza</th><th>Moneda</th><th>Estado</th></tr></thead><tbody>${rows}</tbody></table>`, { title: 'Plan de Cuentas', subtitle: 'Catálogo contable parametrizable · VEN-NIF' });
    });
  }

  function openAccountForm(codigo) {
    const ui = NS.ui;
    if (!NS.app.canAction('accounting', codigo ? 'editar' : 'crear')) return ui.toast('No tienes permiso para administrar el plan de cuentas.', 'warning');
    const a = codigo ? ACC().find((x) => x.codigo === codigo) : null;
    const overlay = ui.modal({
      title: a ? 'Editar cuenta contable' : 'Nueva cuenta contable',
      eyebrow: 'Plan de cuentas',
      size: 'sm',
      body: `<form id="account-form" class="form-grid">
        <label class="field"><span>Código contable *</span><input name="codigo" value="${ui.esc(a ? a.codigo : '')}" placeholder="6.1.2.07" ${a ? 'disabled' : ''} required><small>La jerarquía se construye con puntos.</small></label>
        <label class="field"><span>Nivel *</span><select name="nivel">${NS.store.ACCOUNT_LEVELS.map((n) => `<option ${a && a.nivel === n ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
        <label class="field field-full"><span>Nombre *</span><input name="nombre" value="${ui.esc(a ? a.nombre : '')}" placeholder="Nombre descriptivo de la cuenta" required></label>
        <label class="field"><span>Naturaleza *</span><select name="naturaleza"><option ${a && a.naturaleza === 'Deudora' ? 'selected' : ''}>Deudora</option><option ${a && a.naturaleza === 'Acreedora' ? 'selected' : ''}>Acreedora</option></select></label>
        <label class="field"><span>Moneda</span><select name="moneda"><option ${a && a.moneda === 'VES' ? 'selected' : ''}>VES</option><option ${a && a.moneda === 'USD' ? 'selected' : ''}>USD</option></select></label>
        <label class="field"><span>Estado</span><select name="estado"><option ${a && a.estado === 'Activa' ? 'selected' : ''}>Activa</option><option ${a && a.estado === 'Inactiva' ? 'selected' : ''}>Inactiva</option></select></label>
        <p class="form-note field-full">${ui.icon('info', 14)} Si creas una cuenta de movimiento con código hijo, aparecerá automáticamente debajo de su rubro en el árbol contable.</p>
      </form>`,
      footer: `<button class="btn btn-ghost" data-cancel>Cancelar</button><button class="btn btn-primary" id="account-save">${ui.icon('check', 15)} Guardar</button>`
    });
    overlay.querySelector('[data-cancel]').addEventListener('click', () => ui.closeModal(overlay));
    overlay.querySelector('#account-save').addEventListener('click', () => {
      const form = overlay.querySelector('#account-form');
      if (!form.reportValidity()) return;
      const data = {};
      Array.from(form.elements).forEach((elm) => { if (elm.name) data[elm.name] = elm.value; });
      if (a) data.codigo = a.codigo;
      try {
        NS.store.upsertAccount(data);
        ui.closeModal(overlay);
        ui.toast(a ? 'Cuenta actualizada.' : 'Cuenta contable creada.', 'success');
        NS.app.refresh(true);
      } catch (e) { ui.toast(e.message, 'error'); }
    });
  }

  function askDeleteAccount(codigo) {
    const ui = NS.ui;
    ui.confirm({ title: 'Eliminar cuenta', message: 'Solo se pueden eliminar cuentas sin subcuentas ni movimientos contables. ¿Continuar?', confirmText: 'Eliminar', danger: true }).then((ok) => {
      if (!ok) return;
      try { NS.store.deleteAccount(codigo); ui.toast('Cuenta eliminada.', 'success'); NS.app.refresh(true); }
      catch (e) { ui.toast(e.message, 'error'); }
    });
  }

  /* ------------------------------- REGLAS ------------------------------ */
  function renderRules(el, view) {
    const ui = NS.ui;
    const db = NS.store.db;
    const canWrite = NS.app.canAction('accounting', 'editar');
    el.innerHTML = `<div class="rule-grid">
      ${db.accountingRules.map((r) => `<article class="rule-card">
        <div class="rule-head"><span class="rule-ico">${ui.icon(ruleIcon(r.evento), 20)}</span><div><strong>${ui.esc(r.nombre)}</strong><span class="event-pill">${ui.esc(r.evento)}</span></div>${ui.badge(r.activo ? 'Activa' : 'Inactiva')}</div>
        <p class="rule-desc">${ui.esc(r.descripcion || '')}</p>
        <div class="rule-lines">
          <div class="rule-line"><span class="rule-tag debe">DEBE</span><div><strong class="mono">${ui.esc(r.cuenta_debe)}</strong><small>${ui.esc(NS.store.accountName(r.cuenta_debe))}</small></div></div>
          <div class="rule-line"><span class="rule-tag haber">HABER</span><div><strong class="mono">${ui.esc(r.cuenta_haber)}</strong><small>${ui.esc(NS.store.accountName(r.cuenta_haber))}</small></div></div>
          ${r.cuenta_iva ? `<div class="rule-line rule-aux"><span class="rule-tag iva">IVA</span><div><strong class="mono">${ui.esc(r.cuenta_iva)}</strong><small>${ui.esc(NS.store.accountName(r.cuenta_iva))}</small></div></div>` : ''}
          ${r.cuenta_igtf ? `<div class="rule-line rule-aux"><span class="rule-tag igtf">IGTF</span><div><strong class="mono">${ui.esc(r.cuenta_igtf)}</strong><small>${ui.esc(NS.store.accountName(r.cuenta_igtf))}</small></div></div>` : ''}
        </div>
        ${canWrite ? `<button class="btn btn-ghost btn-sm btn-block" data-rule="${ui.esc(r.evento)}">${ui.icon('edit', 14)} Editar regla</button>` : ''}
      </article>`).join('')}
    </div>
    <div class="card rule-note">${ui.icon('info', 16)} <div><strong>Parametrización automática.</strong> Cada servicio, recarga o factura consulta estas reglas para decidir qué cuentas se afectan. Si modificas una regla, los asientos futuros usarán la nueva configuración; los asientos históricos no se alteran.</div></div>`;

    el.querySelectorAll('[data-rule]').forEach((b) => b.addEventListener('click', () => openRuleForm(b.dataset.rule)));
  }

  function ruleIcon(ev) {
    return ({ traslado: 'car', encomienda: 'package', recarga_wallet: 'wallet', recarga_wallet_ves: 'wallet', liquidacion_conductor: 'moto', compra_proveedor: 'receipt', pago_proveedor: 'bank' })[ev] || 'settings';
  }

  function openRuleForm(ev) {
    const ui = NS.ui;
    if (!NS.app.canAction('accounting', 'editar')) return ui.toast('No tienes permiso para editar reglas contables.', 'warning');
    const r = NS.store.db.accountingRules.find((x) => x.evento === ev);
    if (!r) return;
    const opts = (selected) => `<option value="">— Sin cuenta —</option>` + leafAccounts().map((a) => `<option value="${ui.esc(a.codigo)}" ${selected === a.codigo ? 'selected' : ''}>${ui.esc(a.codigo)} · ${ui.esc(a.nombre)}</option>`).join('');
    const overlay = ui.modal({
      title: 'Editar regla contable',
      eyebrow: r.nombre,
      size: 'md',
      body: `<form id="rule-form" class="form-grid">
        <label class="field field-full"><span>Descripción</span><input name="descripcion" value="${ui.esc(r.descripcion || '')}"></label>
        <label class="field field-full"><span>Cuenta DEBE *</span><select name="cuenta_debe">${opts(r.cuenta_debe)}</select></label>
        <label class="field field-full"><span>Cuenta HABER *</span><select name="cuenta_haber">${opts(r.cuenta_haber)}</select></label>
        <label class="field"><span>Cuenta IVA</span><select name="cuenta_iva">${opts(r.cuenta_iva)}</select></label>
        <label class="field"><span>Cuenta IGTF</span><select name="cuenta_igtf">${opts(r.cuenta_igtf)}</select></label>
        <label class="field field-full"><span>Estado</span><select name="activo"><option value="true" ${r.activo ? 'selected' : ''}>Activa</option><option value="false" ${!r.activo ? 'selected' : ''}>Inactiva</option></select></label>
        <p class="form-note field-full">${ui.icon('alert', 14)} Verifica que las cuentas correspondan a la naturaleza del movimiento. La regla se aplicará a los próximos registros automáticos.</p>
      </form>`,
      footer: `<button class="btn btn-ghost" data-cancel>Cancelar</button><button class="btn btn-primary" id="rule-save">${ui.icon('check', 15)} Guardar regla</button>`
    });
    overlay.querySelector('[data-cancel]').addEventListener('click', () => ui.closeModal(overlay));
    overlay.querySelector('#rule-save').addEventListener('click', () => {
      const form = overlay.querySelector('#rule-form');
      const data = {
        evento: r.evento,
        nombre: r.nombre,
        descripcion: form.elements.descripcion.value,
        cuenta_debe: form.elements.cuenta_debe.value,
        cuenta_haber: form.elements.cuenta_haber.value,
        cuenta_iva: form.elements.cuenta_iva.value,
        cuenta_igtf: form.elements.cuenta_igtf.value,
        activo: form.elements.activo.value === 'true'
      };
      if (!data.cuenta_debe || !data.cuenta_haber) return ui.toast('Debes indicar las cuentas DEBE y HABER.', 'error');
      NS.store.saveRule(data);
      ui.closeModal(overlay);
      ui.toast('Regla contable actualizada.', 'success');
      NS.app.refresh(true);
    });
  }

  /* ----------------------------- LIBRO DIARIO -------------------------- */
  function filteredEntries() {
    return NS.store.db.entries.filter((e) => e.fecha >= state.from && e.fecha <= state.to).slice().sort((a, b) => a.fecha.localeCompare(b.fecha) || a.numero.localeCompare(b.numero));
  }

  function rangeBar() {
    const ui = NS.ui;
    return `<div class="toolbar range-toolbar">
      <div class="range-inputs">
        <label>Desde <input type="date" id="range-from" value="${state.from}"></label>
        <label>Hasta <input type="date" id="range-to" value="${state.to}"></label>
        <button class="btn btn-xs btn-ghost" id="range-month">Mes actual</button>
        <button class="btn btn-xs btn-ghost" id="range-all">Todo</button>
      </div>
      <div class="toolbar-right">
        <button class="btn btn-ghost btn-sm" id="report-csv">${ui.icon('download', 14)} CSV</button>
        <button class="btn btn-ghost btn-sm" id="report-print">${ui.icon('print', 14)} Imprimir</button>
      </div>
    </div>`;
  }

  function bindRange(el, view) {
    const from = el.querySelector('#range-from');
    const to = el.querySelector('#range-to');
    const apply = () => { state.from = from.value; state.to = to.value; render(view); };
    from.addEventListener('change', apply);
    to.addEventListener('change', apply);
    el.querySelector('#range-month').addEventListener('click', () => {
      const now = new Date();
      state.from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
      state.to = NS.store.today();
      render(view);
    });
    el.querySelector('#range-all').addEventListener('click', () => { state.from = '2000-01-01'; state.to = '2100-12-31'; render(view); });
  }

  function renderJournal(el, view) {
    const ui = NS.ui;
    const entries = filteredEntries();
    const totalD = entries.reduce((s, e) => s + e.lines.reduce((x, l) => x + Number(l.debe), 0), 0);
    const totalH = entries.reduce((s, e) => s + e.lines.reduce((x, l) => x + Number(l.haber), 0), 0);
    el.innerHTML = `<section class="card card-flush">
      ${rangeBar()}
      <div class="table-wrap">
        <table class="data-table journal-table">
          <thead><tr><th>Fecha</th><th>Comprobante</th><th>Descripción</th><th>Cuenta</th><th class="num">DEBE</th><th class="num">HABER</th></tr></thead>
          <tbody>
            ${entries.length ? entries.map((e) => e.lines.map((l, i) => `<tr class="${i === 0 ? 'first-line' : ''}">
              <td>${i === 0 ? ui.date(e.fecha) : ''}</td>
              <td>${i === 0 ? `<span class="mono">${ui.esc(e.numero)}</span>` : ''}</td>
              <td>${i === 0 ? ui.esc(e.descripcion) : ''}</td>
              <td><span class="mono">${ui.esc(l.cuenta)}</span> ${ui.esc(NS.store.accountName(l.cuenta))}</td>
              <td class="num">${l.debe ? ui.bs(l.debe) : ''}</td>
              <td class="num">${l.haber ? ui.bs(l.haber) : ''}</td>
            </tr>`).join('')).join('') : `<tr><td colspan="6">${ui.empty('book', 'Sin movimientos', 'No hay asientos en el período seleccionado.')}</td></tr>`}
          </tbody>
          <tfoot><tr><td colspan="4">Totales del período · ${entries.length} asientos</td><td class="num">${ui.bs(totalD)}</td><td class="num">${ui.bs(totalH)}</td></tr></tfoot>
        </table>
      </div>
    </section>`;
    bindRange(el, view);
    el.querySelector('#report-csv').addEventListener('click', () => {
      const rows = [['Fecha', 'Comprobante', 'Descripción', 'Código', 'Cuenta', 'DEBE', 'HABER']];
      entries.forEach((e) => e.lines.forEach((l) => rows.push([e.fecha, e.numero, e.descripcion, l.cuenta, NS.store.accountName(l.cuenta), l.debe, l.haber])));
      rows.push([], ['TOTALES', '', '', '', '', totalD, totalH]);
      ui.downloadFile('ENVIA_libro_diario_' + state.from + '_' + state.to + '.csv', ui.csv(rows));
    });
    el.querySelector('#report-print').addEventListener('click', printJournal);
  }

  function printJournal() {
    const ui = NS.ui;
    const entries = filteredEntries();
    const rows = [];
    entries.forEach((e) => e.lines.forEach((l, i) => rows.push(`<tr><td>${i === 0 ? ui.date(e.fecha) : ''}</td><td>${i === 0 ? ui.esc(e.numero) : ''}</td><td>${i === 0 ? ui.esc(e.descripcion) : ''}</td><td>${ui.esc(l.cuenta)} · ${ui.esc(NS.store.accountName(l.cuenta))}</td><td class="num">${l.debe ? ui.bs(l.debe) : ''}</td><td class="num">${l.haber ? ui.bs(l.haber) : ''}</td></tr>`)));
    const td = entries.reduce((s, e) => s + e.lines.reduce((x, l) => x + l.debe, 0), 0);
    const th = entries.reduce((s, e) => s + e.lines.reduce((x, l) => x + l.haber, 0), 0);
    ui.printHTML('Libro Diario', `<h2>Libro Diario</h2><p style="font-size:10px;color:#5B6B82">Período: ${ui.date(state.from)} al ${ui.date(state.to)} · ${entries.length} asientos</p>
      <table><thead><tr><th>Fecha</th><th>Comprobante</th><th>Descripción</th><th>Cuenta</th><th class="num">DEBE</th><th class="num">HABER</th></tr></thead><tbody>${rows.join('')}</tbody><tfoot><tr><td colspan="4">TOTALES</td><td class="num">${ui.bs(td)}</td><td class="num">${ui.bs(th)}</td></tr></tfoot></table>`,
      { title: 'Libro Diario', subtitle: 'Registro cronológico de asientos · Partida doble', meta: 'Período: ' + ui.date(state.from) + ' — ' + ui.date(state.to) });
  }

  /* ------------------------------ LIBRO MAYOR -------------------------- */
  function renderLedger(el, view) {
    const ui = NS.ui;
    const accounts = leafAccounts().filter((a) => NS.store.db.entries.some((e) => e.lines.some((l) => l.cuenta === a.codigo)));
    const acc = state.ledgerAccount;
    const entries = NS.store.db.entries.filter((e) => e.fecha >= state.from && e.fecha <= state.to && e.lines.some((l) => l.cuenta === acc))
      .slice().sort((a, b) => a.fecha.localeCompare(b.fecha) || a.numero.localeCompare(b.numero));
    let running = 0;
    const rows = [];
    entries.forEach((e) => {
      e.lines.filter((l) => l.cuenta === acc).forEach((l) => {
        running += Number(l.debe) - Number(l.haber);
        rows.push(`<tr><td>${ui.date(e.fecha)}</td><td class="mono">${ui.esc(e.numero)}</td><td>${ui.esc(e.descripcion)}</td><td class="num">${l.debe ? ui.bs(l.debe) : ''}</td><td class="num">${l.haber ? ui.bs(l.haber) : ''}</td><td class="num"><strong>${ui.bs(Math.abs(running))} ${running >= 0 ? 'D' : 'A'}</strong></td></tr>`);
      });
    });
    const totalD = entries.reduce((s, e) => s + e.lines.filter((l) => l.cuenta === acc).reduce((x, l) => x + Number(l.debe), 0), 0);
    const totalH = entries.reduce((s, e) => s + e.lines.filter((l) => l.cuenta === acc).reduce((x, l) => x + Number(l.haber), 0), 0);
    const account = NS.store.account(acc);

    el.innerHTML = `<section class="card card-flush">
      ${rangeBar()}
      <div class="toolbar toolbar-sub">
        <label class="select-label">Cuenta:
          <select id="ledger-account" class="select-inline">${accounts.map((a) => `<option value="${ui.esc(a.codigo)}" ${a.codigo === acc ? 'selected' : ''}>${ui.esc(a.codigo)} · ${ui.esc(a.nombre)}</option>`).join('')}</select>
        </label>
        <span class="count-chip">Saldo: ${ui.bs(Math.abs(running))} ${running >= 0 ? 'deudor' : 'acreedor'}</span>
      </div>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Fecha</th><th>Comprobante</th><th>Descripción</th><th class="num">DEBE</th><th class="num">HABER</th><th class="num">Saldo acumulado</th></tr></thead>
          <tbody>${rows.length ? rows.join('') : `<tr><td colspan="6">${ui.empty('chart', 'Sin movimientos', 'La cuenta no tiene movimientos en el período.')}</td></tr>`}</tbody>
          <tfoot><tr><td colspan="3">Totales · ${account ? ui.esc(account.nombre) : ''}</td><td class="num">${ui.bs(totalD)}</td><td class="num">${ui.bs(totalH)}</td><td class="num">${ui.bs(Math.abs(running))} ${running >= 0 ? 'D' : 'A'}</td></tr></tfoot>
        </table>
      </div>
    </section>`;
    bindRange(el, view);
    el.querySelector('#ledger-account').addEventListener('change', (e) => { state.ledgerAccount = e.target.value; render(view); });
    el.querySelector('#report-csv').addEventListener('click', () => {
      const csvRows = [['Fecha', 'Comprobante', 'Descripción', 'Debe', 'Haber']];
      entries.forEach((e) => e.lines.filter((l) => l.cuenta === acc).forEach((l) => csvRows.push([e.fecha, e.numero, e.descripcion, l.debe, l.haber])));
      csvRows.push([], ['TOTALES', '', '', totalD, totalH]);
      ui.downloadFile('ENVIA_mayor_' + acc + '_' + state.from + '_' + state.to + '.csv', ui.csv(csvRows));
    });
    el.querySelector('#report-print').addEventListener('click', () => {
      ui.printHTML('Libro Mayor', `<h2>Libro Mayor</h2><p style="font-size:10px">Cuenta: <strong>${ui.esc(acc)} · ${ui.esc(account ? account.nombre : '')}</strong> · Período ${ui.date(state.from)} al ${ui.date(state.to)}</p>
        <table><thead><tr><th>Fecha</th><th>Comprobante</th><th>Descripción</th><th class="num">DEBE</th><th class="num">HABER</th><th class="num">Saldo</th></tr></thead><tbody>${rows.join('')}</tbody><tfoot><tr><td colspan="3">TOTALES</td><td class="num">${ui.bs(totalD)}</td><td class="num">${ui.bs(totalH)}</td><td class="num">${ui.bs(Math.abs(running))} ${running >= 0 ? 'D' : 'A'}</td></tr></tfoot></table>`,
        { title: 'Libro Mayor', subtitle: 'Movimientos por cuenta contable', meta: 'Cuenta ' + acc });
    });
  }

  /* -------------------------- BALANCE DE COMPROBACIÓN ------------------ */
  function renderTrial(el) {
    const ui = NS.ui;
    const rows = NS.store.trialBalance();
    const totals = rows.reduce((s, r) => ({ debe: s.debe + r.debe, haber: s.haber + r.haber, deudor: s.deudor + r.deudor, acreedor: s.acreedor + r.acreedor }), { debe: 0, haber: 0, deudor: 0, acreedor: 0 });
    const ok = Math.abs(totals.deudor - totals.acreedor) < 0.02;
    el.innerHTML = `<section class="card card-flush">
      <div class="toolbar">
        <div class="report-title-inline"><h3>Balance de Comprobación</h3><span>Al ${ui.dateLong(NS.store.today())} · saldos históricos</span></div>
        <div class="toolbar-right">
          <span class="balance-chip ${ok ? 'ok' : 'bad'}">${ui.icon(ok ? 'check' : 'alert', 15)} ${ok ? 'Cuadra' : 'Descuadre'}</span>
          <button class="btn btn-ghost btn-sm" id="report-csv">${ui.icon('download', 14)} CSV</button>
          <button class="btn btn-ghost btn-sm" id="report-print">${ui.icon('print', 14)} Imprimir</button>
        </div>
      </div>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Código</th><th>Cuenta</th><th class="num">Movimientos DEBE</th><th class="num">Movimientos HABER</th><th class="num">Saldo Deudor</th><th class="num">Saldo Acreedor</th></tr></thead>
          <tbody>${rows.map((r) => `<tr><td class="mono">${ui.esc(r.codigo)}</td><td>${ui.esc(r.nombre)}</td><td class="num">${ui.bs(r.debe)}</td><td class="num">${ui.bs(r.haber)}</td><td class="num">${r.deudor ? ui.bs(r.deudor) : ''}</td><td class="num">${r.acreedor ? ui.bs(r.acreedor) : ''}</td></tr>`).join('')}</tbody>
          <tfoot><tr><td colspan="2">TOTALES</td><td class="num">${ui.bs(totals.debe)}</td><td class="num">${ui.bs(totals.haber)}</td><td class="num">${ui.bs(totals.deudor)}</td><td class="num">${ui.bs(totals.acreedor)}</td></tr></tfoot>
        </table>
      </div>
      <div class="card-foot-note">${ui.icon(ok ? 'check' : 'alert', 14)} ${ok ? 'La suma de saldos deudores es igual a la suma de saldos acreedores.' : 'Existe una diferencia de ' + ui.bs(Math.abs(totals.deudor - totals.acreedor)) + '. Revisa los asientos.'}</div>
    </section>`;
    el.querySelector('#report-csv').addEventListener('click', () => {
      const csvRows = [['Código', 'Cuenta', 'Debe', 'Haber', 'Saldo deudor', 'Saldo acreedor']];
      rows.forEach((r) => csvRows.push([r.codigo, r.nombre, r.debe, r.haber, r.deudor, r.acreedor]));
      csvRows.push([], ['TOTALES', '', totals.debe, totals.haber, totals.deudor, totals.acreedor]);
      ui.downloadFile('ENVIA_balance_comprobacion_' + NS.store.today() + '.csv', ui.csv(csvRows));
    });
    el.querySelector('#report-print').addEventListener('click', () => {
      ui.printHTML('Balance de Comprobación', `<h2>Balance de Comprobación</h2><table><thead><tr><th>Código</th><th>Cuenta</th><th class="num">DEBE</th><th class="num">HABER</th><th class="num">Deudor</th><th class="num">Acreedor</th></tr></thead><tbody>${rows.map((r) => `<tr><td>${ui.esc(r.codigo)}</td><td>${ui.esc(r.nombre)}</td><td class="num">${ui.bs(r.debe)}</td><td class="num">${ui.bs(r.haber)}</td><td class="num">${r.deudor ? ui.bs(r.deudor) : ''}</td><td class="num">${r.acreedor ? ui.bs(r.acreedor) : ''}</td></tr>`).join('')}</tbody><tfoot><tr><td colspan="2">TOTALES</td><td class="num">${ui.bs(totals.debe)}</td><td class="num">${ui.bs(totals.haber)}</td><td class="num">${ui.bs(totals.deudor)}</td><td class="num">${ui.bs(totals.acreedor)}</td></tr></tfoot></table>`, { title: 'Balance de Comprobación', subtitle: 'Saldos históricos · VEN-NIF' });
    });
  }

  /* ------------------------- ESTADO DE RESULTADOS ---------------------- */
  function renderIncome(el) {
    const ui = NS.ui;
    const r = NS.store.incomeStatement();
    const rowLine = (row, kind) => `<tr><td>${ui.esc(row.account.codigo)} · ${ui.esc(row.account.nombre)}</td><td class="num">${ui.bs(Math.abs(row.saldo))}</td></tr>`;
    el.innerHTML = `<section class="card card-flush">
      <div class="toolbar">
        <div class="report-title-inline"><h3>Estado de Resultados</h3><span>Del 01/01/${new Date().getFullYear()} al ${ui.dateLong(NS.store.today())}</span></div>
        <div class="toolbar-right"><button class="btn btn-ghost btn-sm" id="report-csv">${ui.icon('download', 14)} CSV</button><button class="btn btn-ghost btn-sm" id="report-print">${ui.icon('print', 14)} Imprimir</button></div>
      </div>
      <div class="income-sheet">
        <div class="income-block income-positive">
          <h4>Ingresos operativos</h4>
          <table><tbody>${r.incomeRows.map((row) => rowLine(row)).join('') || '<tr><td colspan="2" class="muted small">Sin ingresos.</td></tr>'}</tbody></table>
          <div class="income-subtotal"><span>Total ingresos</span><strong>${ui.bs(r.income)}</strong></div>
        </div>
        <div class="income-block income-negative">
          <h4>Costos de flota y plataforma</h4>
          <table><tbody>${r.costRows.map((row) => rowLine(row)).join('') || '<tr><td colspan="2" class="muted small">Sin costos.</td></tr>'}</tbody></table>
          <div class="income-subtotal"><span>Total costos</span><strong>${ui.bs(r.cost)}</strong></div>
        </div>
        <div class="income-block income-negative">
          <h4>Gastos operativos</h4>
          <table><tbody>${r.expenseRows.map((row) => rowLine(row)).join('') || '<tr><td colspan="2" class="muted small">Sin gastos.</td></tr>'}</tbody></table>
          <div class="income-subtotal"><span>Total gastos</span><strong>${ui.bs(r.expense)}</strong></div>
        </div>
        <div class="result-cards">
          <div class="result-card"><span>Utilidad bruta</span><strong>${ui.bs(r.gross)}</strong><small>Ingresos − Costos</small></div>
          <div class="result-card result-final ${r.profit >= 0 ? 'ok' : 'bad'}"><span>Utilidad neta del ejercicio</span><strong>${ui.bs(r.profit)}</strong><small>Ingresos − Costos − Gastos</small></div>
        </div>
      </div>
    </section>`;
    const body = () => `<h2>Estado de Resultados</h2><p style="font-size:10px">Del 01/01/${new Date().getFullYear()} al ${ui.dateLong(NS.store.today())}</p>
      <table><tbody>
        <tr><th colspan="2">INGRESOS</th></tr>${r.incomeRows.map((row) => `<tr><td>${ui.esc(row.account.codigo)} · ${ui.esc(row.account.nombre)}</td><td class="num">${ui.bs(Math.abs(row.saldo))}</td></tr>`).join('')}
        <tr><td><strong>Total ingresos</strong></td><td class="num"><strong>${ui.bs(r.income)}</strong></td></tr>
        <tr><th colspan="2">COSTOS</th></tr>${r.costRows.map((row) => `<tr><td>${ui.esc(row.account.codigo)} · ${ui.esc(row.account.nombre)}</td><td class="num">${ui.bs(Math.abs(row.saldo))}</td></tr>`).join('')}
        <tr><td><strong>Total costos</strong></td><td class="num"><strong>${ui.bs(r.cost)}</strong></td></tr>
        <tr><th colspan="2">GASTOS</th></tr>${r.expenseRows.map((row) => `<tr><td>${ui.esc(row.account.codigo)} · ${ui.esc(row.account.nombre)}</td><td class="num">${ui.bs(Math.abs(row.saldo))}</td></tr>`).join('')}
        <tr><td><strong>Total gastos</strong></td><td class="num"><strong>${ui.bs(r.expense)}</strong></td></tr>
        <tr><td><strong>UTILIDAD NETA</strong></td><td class="num"><strong>${ui.bs(r.profit)}</strong></td></tr>
      </tbody></table>`;
    el.querySelector('#report-csv').addEventListener('click', () => {
      const rows = [['Tipo', 'Código', 'Cuenta', 'Saldo VES']];
      r.incomeRows.forEach((x) => rows.push(['Ingreso', x.account.codigo, x.account.nombre, Math.abs(x.saldo)]));
      rows.push(['', '', 'Total ingresos', r.income]);
      r.costRows.forEach((x) => rows.push(['Costo', x.account.codigo, x.account.nombre, Math.abs(x.saldo)]));
      rows.push(['', '', 'Total costos', r.cost]);
      r.expenseRows.forEach((x) => rows.push(['Gasto', x.account.codigo, x.account.nombre, Math.abs(x.saldo)]));
      rows.push(['', '', 'Total gastos', r.expense], ['', '', 'Utilidad neta', r.profit]);
      ui.downloadFile('ENVIA_estado_resultados_' + NS.store.today() + '.csv', ui.csv(rows));
    });
    el.querySelector('#report-print').addEventListener('click', () => ui.printHTML('Estado de Resultados', body(), { title: 'Estado de Resultados', subtitle: 'Ingresos − Costos − Gastos = Utilidad' }));
  }

  /* --------------------------- BALANCE GENERAL ------------------------- */
  function renderBalance(el) {
    const ui = NS.ui;
    const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
    const balances = NS.store.getAccountBalances().filter((b) => b.account.nivel === 'Cuenta de Movimiento' && Math.abs(b.saldo) > 0.005);
    const rowsOf = (prefix) => balances
      .filter((b) => b.account.codigo === prefix || b.account.codigo.startsWith(prefix + '.'))
      .sort((a, b) => a.account.codigo.localeCompare(b.account.codigo, undefined, { numeric: true }));
    const assets = rowsOf('1');
    const liabilities = rowsOf('2');
    const equity = rowsOf('3');
    const profit = NS.store.incomeStatement().profit;
    const totalAssets = r2(assets.reduce((s, x) => s + x.saldo, 0));
    const totalLiabilities = r2(liabilities.reduce((s, x) => s - x.saldo, 0));
    const totalEquity = r2(equity.reduce((s, x) => s - x.saldo, 0) + profit);
    const totalPassive = r2(totalLiabilities + totalEquity);
    const diff = r2(totalAssets - totalPassive);

    const line = (row, invert) => `<tr><td><span class="mono">${ui.esc(row.account.codigo)}</span> ${ui.esc(row.account.nombre)}</td><td class="num">${ui.bs(invert ? -row.saldo : row.saldo)}</td></tr>`;
    const empty = '<tr><td colspan="2" class="muted small">Sin saldos.</td></tr>';

    el.innerHTML = `<section class="card card-flush">
      <div class="toolbar">
        <div class="report-title-inline"><h3>Balance General</h3><span>Al ${ui.dateLong(NS.store.today())} · Expresado en VES</span></div>
        <div class="toolbar-right"><button class="btn btn-ghost btn-sm" id="report-csv">${ui.icon('download', 14)} CSV</button><button class="btn btn-ghost btn-sm" id="report-print">${ui.icon('print', 14)} Imprimir</button></div>
      </div>
      <div class="income-sheet">
        <div class="balance-pair">
          <div>
            <div class="income-block income-positive">
              <h4>Activos</h4>
              <table><tbody>${assets.map((x) => line(x, false)).join('') || empty}</tbody></table>
              <div class="income-subtotal"><span>Total activos</span><strong>${ui.bs(totalAssets)}</strong></div>
            </div>
          </div>
          <div>
            <div class="income-block income-negative">
              <h4>Pasivos</h4>
              <table><tbody>${liabilities.map((x) => line(x, true)).join('') || empty}</tbody></table>
              <div class="income-subtotal"><span>Total pasivos</span><strong>${ui.bs(totalLiabilities)}</strong></div>
            </div>
            <div class="income-block income-negative">
              <h4>Patrimonio</h4>
              <table><tbody>
                ${equity.map((x) => line(x, true)).join('')}
                <tr><td><span class="mono">3.1.3.01</span> Resultado del ejercicio</td><td class="num">${ui.bs(profit)}</td></tr>
              </tbody></table>
              <div class="income-subtotal"><span>Total patrimonio</span><strong>${ui.bs(totalEquity)}</strong></div>
            </div>
          </div>
        </div>
        <div class="result-cards">
          <div class="result-card"><span>Total pasivo + patrimonio</span><strong>${ui.bs(totalPassive)}</strong><small>Pasivos + Patrimonio + Resultado</small></div>
          <div class="result-card result-final ${Math.abs(diff) < 0.02 ? 'ok' : 'bad'}"><span>Cuadre del balance</span><strong>${ui.bs(diff)}</strong><small>${Math.abs(diff) < 0.02 ? 'Activo = Pasivo + Patrimonio ✓' : 'Revisar saldos contables'}</small></div>
        </div>
      </div>
    </section>`;

    const csvRows = [['Tipo', 'Código', 'Cuenta', 'Saldo VES']];
    assets.forEach((x) => csvRows.push(['Activo', x.account.codigo, x.account.nombre, r2(x.saldo)]));
    csvRows.push(['', '', 'Total activos', totalAssets]);
    liabilities.forEach((x) => csvRows.push(['Pasivo', x.account.codigo, x.account.nombre, r2(-x.saldo)]));
    csvRows.push(['', '', 'Total pasivos', totalLiabilities]);
    equity.forEach((x) => csvRows.push(['Patrimonio', x.account.codigo, x.account.nombre, r2(-x.saldo)]));
    csvRows.push(['', '', 'Resultado del ejercicio', r2(profit)], ['', '', 'Total patrimonio', totalEquity], ['', '', 'Total pasivo + patrimonio', totalPassive]);

    el.querySelector('#report-csv').addEventListener('click', () => {
      ui.downloadFile('ENVIA_balance_general_' + NS.store.today() + '.csv', ui.csv(csvRows));
    });
    el.querySelector('#report-print').addEventListener('click', () => {
      const body = `<h2>Balance General</h2><p style="font-size:10px">Al ${ui.dateLong(NS.store.today())} · VES</p>
        <table><tbody>
          <tr><th colspan="2">ACTIVOS</th></tr>${assets.map((x) => `<tr><td>${ui.esc(x.account.codigo)} · ${ui.esc(x.account.nombre)}</td><td class="num">${ui.bs(x.saldo)}</td></tr>`).join('')}
          <tr><td><strong>Total activos</strong></td><td class="num"><strong>${ui.bs(totalAssets)}</strong></td></tr>
          <tr><th colspan="2">PASIVOS</th></tr>${liabilities.map((x) => `<tr><td>${ui.esc(x.account.codigo)} · ${ui.esc(x.account.nombre)}</td><td class="num">${ui.bs(-x.saldo)}</td></tr>`).join('')}
          <tr><td><strong>Total pasivos</strong></td><td class="num"><strong>${ui.bs(totalLiabilities)}</strong></td></tr>
          <tr><th colspan="2">PATRIMONIO</th></tr>${equity.map((x) => `<tr><td>${ui.esc(x.account.codigo)} · ${ui.esc(x.account.nombre)}</td><td class="num">${ui.bs(-x.saldo)}</td></tr>`).join('')}
          <tr><td>Resultado del ejercicio</td><td class="num">${ui.bs(profit)}</td></tr>
          <tr><td><strong>Total patrimonio</strong></td><td class="num"><strong>${ui.bs(totalEquity)}</strong></td></tr>
          <tr><td><strong>TOTAL PASIVO + PATRIMONIO</strong></td><td class="num"><strong>${ui.bs(totalPassive)}</strong></td></tr>
        </tbody></table>`;
      ui.printHTML('Balance General', body, { title: 'Balance General', subtitle: 'Activo = Pasivo + Patrimonio' });
    });
  }

  /* ---------------------------- LIBRO DE VENTAS ------------------------ */
  function renderSales(el, view) {
    const ui = NS.ui;
    const db = NS.store.db;
    const services = db.services.filter((s) => s.fecha >= state.from && s.fecha <= state.to).slice().sort((a, b) => a.fecha.localeCompare(b.fecha));
    const totals = services.reduce((s, x) => ({ base: s.base + x.base_usd, iva: s.iva + x.iva_usd, igtf: s.igtf + x.igtf_usd, total: s.total + x.total_usd }), { base: 0, iva: 0, igtf: 0, total: 0 });
    el.innerHTML = `<section class="card card-flush">
      ${rangeBar()}
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Fecha</th><th>N° Factura</th><th>N° Control</th><th>Cliente</th><th>Cédula / RIF</th><th class="num">Base imponible</th><th class="num">IVA</th><th class="num">IGTF</th><th class="num">Total</th><th class="num">Tasa BCV</th></tr></thead>
          <tbody>
            ${services.length ? services.map((s) => {
              const c = db.clients.find((x) => x.cedula_rif === s.cliente_cedula_rif);
              return `<tr><td>${ui.date(s.fecha)}</td><td class="mono">${ui.esc(s.factura_numero)}</td><td class="mono">${ui.esc(s.control_numero || '—')}</td><td>${ui.esc(c ? c.nombres + ' ' + c.apellidos : '—')}</td><td class="mono">${ui.esc(s.cliente_cedula_rif)}</td><td class="num">${ui.usd(s.base_usd)}</td><td class="num">${ui.usd(s.iva_usd)}</td><td class="num">${ui.usd(s.igtf_usd)}</td><td class="num"><strong>${ui.usd(s.total_usd)}</strong></td><td class="num">${ui.num(db.taxParams.bcvRate)}</td></tr>`;
            }).join('') : `<tr><td colspan="10">${ui.empty('receipt', 'Sin ventas', 'No hay servicios facturados en el período.')}</td></tr>`}
          </tbody>
          <tfoot><tr><td colspan="5">TOTALES · ${services.length} documentos</td><td class="num">${ui.usd(totals.base)}</td><td class="num">${ui.usd(totals.iva)}</td><td class="num">${ui.usd(totals.igtf)}</td><td class="num">${ui.usd(totals.total)}</td><td></td></tr></tfoot>
        </table>
      </div>
      <div class="card-foot-note">${ui.icon('info', 14)} Libro de Ventas conforme al SENIAT · IVA general 16%, reducido 8% o exento · IGTF 3% sobre pagos en divisas o criptoactivos.</div>
    </section>`;
    bindRange(el, view);
    el.querySelector('#report-csv').addEventListener('click', () => {
      const rows = [['Fecha', 'Factura', 'Control', 'Cliente', 'Cédula/RIF', 'Base USD', 'IVA USD', 'IGTF USD', 'Total USD', 'Tasa BCV']];
      services.forEach((s) => { const c = db.clients.find((x) => x.cedula_rif === s.cliente_cedula_rif); rows.push([s.fecha, s.factura_numero, s.control_numero, c ? c.nombres + ' ' + c.apellidos : '', s.cliente_cedula_rif, s.base_usd, s.iva_usd, s.igtf_usd, s.total_usd, db.taxParams.bcvRate]); });
      rows.push([], ['TOTALES', '', '', '', '', totals.base, totals.iva, totals.igtf, totals.total, '']);
      ui.downloadFile('ENVIA_libro_ventas_' + state.from + '_' + state.to + '.csv', ui.csv(rows));
    });
    el.querySelector('#report-print').addEventListener('click', () => {
      ui.printHTML('Libro de Ventas', `<h2>Libro de Ventas SENIAT</h2><p style="font-size:10px">Período ${ui.date(state.from)} al ${ui.date(state.to)}</p>
        <table><thead><tr><th>Fecha</th><th>Factura</th><th>Control</th><th>Cliente</th><th>Cédula/RIF</th><th class="num">Base</th><th class="num">IVA</th><th class="num">IGTF</th><th class="num">Total</th></tr></thead><tbody>${services.map((s) => { const c = db.clients.find((x) => x.cedula_rif === s.cliente_cedula_rif); return `<tr><td>${ui.date(s.fecha)}</td><td>${ui.esc(s.factura_numero)}</td><td>${ui.esc(s.control_numero || '—')}</td><td>${ui.esc(c ? c.nombres + ' ' + c.apellidos : '')}</td><td>${ui.esc(s.cliente_cedula_rif)}</td><td class="num">${ui.usd(s.base_usd)}</td><td class="num">${ui.usd(s.iva_usd)}</td><td class="num">${ui.usd(s.igtf_usd)}</td><td class="num">${ui.usd(s.total_usd)}</td></tr>`; }).join('')}</tbody><tfoot><tr><td colspan="5">TOTALES</td><td class="num">${ui.usd(totals.base)}</td><td class="num">${ui.usd(totals.iva)}</td><td class="num">${ui.usd(totals.igtf)}</td><td class="num">${ui.usd(totals.total)}</td></tr></tfoot></table>`,
        { title: 'Libro de Ventas', subtitle: 'Registro fiscal de ventas y servicios' });
    });
  }

  /* ---------------------------- LIBRO DE COMPRAS ----------------------- */
  function renderPurchases(el, view) {
    const ui = NS.ui;
    const db = NS.store.db;
    const payables = db.payables.filter((p) => p.fecha_emision >= state.from && p.fecha_emision <= state.to).slice().sort((a, b) => a.fecha_emision.localeCompare(b.fecha_emision));
    const t = payables.reduce((s, p) => ({
      base: s.base + p.base_usd, exento: s.exento + (p.exento_usd || 0), iva: s.iva + p.iva_usd,
      igtf: s.igtf + p.igtf_usd, retIva: s.retIva + p.ret_iva_usd, retIslr: s.retIslr + p.ret_islr_usd, total: s.total + p.total_usd
    }), { base: 0, exento: 0, iva: 0, igtf: 0, retIva: 0, retIslr: 0, total: 0 });
    el.innerHTML = `<section class="card card-flush">
      ${rangeBar()}
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Fecha</th><th>N° Factura</th><th>N° Control</th><th>Proveedor</th><th>RIF</th><th class="num">Base</th><th class="num">Exento</th><th class="num">IVA</th><th class="num">IGTF</th><th class="num">Ret. IVA</th><th class="num">Ret. ISLR</th><th class="num">Total</th><th>Comprobante</th></tr></thead>
          <tbody>${payables.length ? payables.map((p) => {
            const sup = db.suppliers.find((s) => s.rif === p.proveedor_rif);
            return `<tr><td>${ui.date(p.fecha_emision)}</td><td class="mono">${ui.esc(p.numero_factura)}</td><td class="mono">${ui.esc(p.numero_control)}</td><td>${ui.esc(sup ? sup.razon_social : p.proveedor_rif)}</td><td class="mono">${ui.esc(p.proveedor_rif)}</td><td class="num">${ui.usd(p.base_usd)}</td><td class="num">${ui.usd(p.exento_usd || 0)}</td><td class="num">${ui.usd(p.iva_usd)}</td><td class="num">${ui.usd(p.igtf_usd)}</td><td class="num">${ui.usd(p.ret_iva_usd)}</td><td class="num">${ui.usd(p.ret_islr_usd)}</td><td class="num"><strong>${ui.usd(p.total_usd)}</strong></td><td class="mono small">${ui.esc(p.comprobante_numero || '—')}</td></tr>`;
          }).join('') : `<tr><td colspan="13">${ui.empty('wallet', 'Sin compras', 'No hay facturas de compra en el período.')}</td></tr>`}</tbody>
          <tfoot><tr><td colspan="5">TOTALES · ${payables.length} documentos</td><td class="num">${ui.usd(t.base)}</td><td class="num">${ui.usd(t.exento)}</td><td class="num">${ui.usd(t.iva)}</td><td class="num">${ui.usd(t.igtf)}</td><td class="num">${ui.usd(t.retIva)}</td><td class="num">${ui.usd(t.retIslr)}</td><td class="num">${ui.usd(t.total)}</td><td></td></tr></tfoot>
        </table>
      </div>
      <div class="card-foot-note">${ui.icon('info', 14)} Libro de Compras · IVA crédito fiscal · Retenciones de IVA 75%/100% · Retención ISLR Decreto 1.808 con sustraendo en UT.</div>
    </section>`;
    bindRange(el, view);
    el.querySelector('#report-csv').addEventListener('click', () => {
      const rows = [['Fecha', 'Factura', 'Control', 'Proveedor', 'RIF', 'Base', 'Exento', 'IVA', 'IGTF', 'Ret IVA', 'Ret ISLR', 'Total', 'Comprobante']];
      payables.forEach((p) => { const sup = db.suppliers.find((s) => s.rif === p.proveedor_rif); rows.push([p.fecha_emision, p.numero_factura, p.numero_control, sup ? sup.razon_social : '', p.proveedor_rif, p.base_usd, p.exento_usd || 0, p.iva_usd, p.igtf_usd, p.ret_iva_usd, p.ret_islr_usd, p.total_usd, p.comprobante_numero]); });
      rows.push([], ['TOTALES', '', '', '', '', t.base, t.exento, t.iva, t.igtf, t.retIva, t.retIslr, t.total, '']);
      ui.downloadFile('ENVIA_libro_compras_' + state.from + '_' + state.to + '.csv', ui.csv(rows));
    });
    el.querySelector('#report-print').addEventListener('click', () => {
      ui.printHTML('Libro de Compras', `<h2>Libro de Compras SENIAT</h2><p style="font-size:10px">Período ${ui.date(state.from)} al ${ui.date(state.to)}</p>
        <table><thead><tr><th>Fecha</th><th>Factura</th><th>Proveedor</th><th>RIF</th><th class="num">Base</th><th class="num">IVA</th><th class="num">IGTF</th><th class="num">Ret IVA</th><th class="num">Ret ISLR</th><th class="num">Total</th></tr></thead><tbody>${payables.map((p) => { const sup = db.suppliers.find((s) => s.rif === p.proveedor_rif); return `<tr><td>${ui.date(p.fecha_emision)}</td><td>${ui.esc(p.numero_factura)}</td><td>${ui.esc(sup ? sup.razon_social : '')}</td><td>${ui.esc(p.proveedor_rif)}</td><td class="num">${ui.usd(p.base_usd)}</td><td class="num">${ui.usd(p.iva_usd)}</td><td class="num">${ui.usd(p.igtf_usd)}</td><td class="num">${ui.usd(p.ret_iva_usd)}</td><td class="num">${ui.usd(p.ret_islr_usd)}</td><td class="num">${ui.usd(p.total_usd)}</td></tr>`; }).join('')}</tbody><tfoot><tr><td colspan="4">TOTALES</td><td class="num">${ui.usd(t.base)}</td><td class="num">${ui.usd(t.iva)}</td><td class="num">${ui.usd(t.igtf)}</td><td class="num">${ui.usd(t.retIva)}</td><td class="num">${ui.usd(t.retIslr)}</td><td class="num">${ui.usd(t.total)}</td></tr></tfoot></table>`,
        { title: 'Libro de Compras', subtitle: 'Registro fiscal de compras y retenciones' });
    });
  }

  function exportEntriesCsv() {
    const ui = NS.ui;
    const rows = [['Número', 'Fecha', 'Descripción', 'Referencia', 'Origen', 'Cuenta', 'Nombre cuenta', 'DEBE', 'HABER']];
    filteredEntries().forEach((e) => e.lines.forEach((l) => rows.push([e.numero, e.fecha, e.descripcion, e.referencia, e.origen, l.cuenta, NS.store.accountName(l.cuenta), l.debe, l.haber])));
    ui.downloadFile('ENVIA_asientos_' + NS.store.today() + '.csv', ui.csv(rows));
    ui.toast('Asientos exportados a CSV.', 'success');
  }

  // Exponer vista actual para los bindRange de ventas/compras
  const origRender = render;
  NS.modules.accounting = {
    render(view) { NS.__accountingView = view; origRender(view); },
    openEntry
  };
})();
