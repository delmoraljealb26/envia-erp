/* =========================================================================
   ENVIA ERP · modules/services.js
   Registro y consulta de carreras de taxi y encomiendas.
   Genera asientos automáticos (ingreso + IVA + IGTF + liquidación).
   ========================================================================= */
(function () {
  'use strict';
  const NS = (window.ENVIA = window.ENVIA || {});
  NS.modules = NS.modules || {};

  let filters = { q: '', tipo: '', metodo: '' };

  function render(view) {
    const ui = NS.ui;
    const store = NS.store;
    const db = store.db;
    const canCreate = NS.app.canAction('services', 'crear');
    const canExport = NS.app.canAction('services', 'exportar');
    const q = filters.q.toLowerCase();
    const list = db.services.filter((s) => {
      const c = db.clients.find((x) => x.cedula_rif === s.cliente_cedula_rif);
      const d = db.drivers.find((x) => x.cedula_rif === s.conductor_cedula_rif);
      const hay = [s.id, s.cliente_cedula_rif, s.conductor_cedula_rif, s.origen, s.destino, s.metodo_pago, c ? c.nombres + ' ' + c.apellidos : '', d ? d.nombres + ' ' + d.apellidos : ''].join(' ').toLowerCase();
      return (!q || hay.includes(q)) && (!filters.tipo || s.tipo === filters.tipo) && (!filters.metodo || s.metodo_pago === filters.metodo);
    });
    const m = store.metrics();

    view.innerHTML = `
      <div class="page-head">
        <div>
          <span class="eyebrow">Operación · carreras y encomiendas</span>
          <h2 class="page-title">Servicios completados</h2>
          <p class="page-sub">Cada servicio genera ingreso, IVA, IGTF cuando aplica y la liquidación del conductor en partida doble.</p>
        </div>
        <div class="page-actions">
          ${NS.reports.button('services')}
          ${canExport ? `<button class="btn btn-ghost" id="services-export">${ui.icon('download', 16)} Exportar CSV</button>` : ''}
          ${canCreate ? `<button class="btn btn-primary" id="services-new">${ui.icon('plus', 16)} Nuevo servicio</button>` : ''}
        </div>
      </div>

      <div class="stat-strip">
        <div class="stat-strip-item"><span>Ingresos brutos</span><strong>${ui.usd(m.gross)}</strong><small>${ui.bs(ui.toBs(m.gross))}</small></div>
        <div class="stat-strip-item"><span>Carreras</span><strong>${ui.num(m.ridesCount, 0)}</strong><small>${ui.usd(m.rideIncome)} facturados</small></div>
        <div class="stat-strip-item"><span>Encomiendas</span><strong>${ui.num(m.deliveriesCount, 0)}</strong><small>${ui.usd(m.deliveryIncome)} facturados</small></div>
        <div class="stat-strip-item"><span>Comisión ENVIA</span><strong>${ui.usd(m.commission)}</strong><small>Ticket promedio ${ui.usd(m.ticketAvg)}</small></div>
      </div>

      <section class="card card-flush">
        <div class="toolbar">
          <div class="search-box">${ui.icon('search', 17)}<input id="service-search" type="search" placeholder="Buscar por ID, cliente, conductor, ruta..." value="${ui.esc(filters.q)}"></div>
          <div class="toolbar-right">
            <select id="service-type" class="select-inline">
              <option value="">Todos los tipos</option>
              <option value="carrera" ${filters.tipo === 'carrera' ? 'selected' : ''}>Carreras</option>
              <option value="encomienda" ${filters.tipo === 'encomienda' ? 'selected' : ''}>Encomiendas</option>
            </select>
            <select id="service-method" class="select-inline">
              <option value="">Todos los métodos</option>
              ${store.PAYMENT_METHODS.map((x) => `<option ${filters.metodo === x ? 'selected' : ''}>${x}</option>`).join('')}
            </select>
            <span class="count-chip">${list.length} servicio${list.length === 1 ? '' : 's'}</span>
          </div>
        </div>
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr>
              <th>Servicio</th><th>Tipo</th><th>Cliente</th><th>Conductor</th><th>Ruta</th>
              <th class="num">Base</th><th class="num">IVA</th><th class="num">IGTF</th><th class="num">Total</th><th class="num">Comisión</th><th>Pago</th><th class="actions-col"></th>
            </tr></thead>
            <tbody>
              ${list.length ? list.map((s) => {
                const c = db.clients.find((x) => x.cedula_rif === s.cliente_cedula_rif);
                const d = db.drivers.find((x) => x.cedula_rif === s.conductor_cedula_rif);
                return `<tr>
                  <td><strong class="mono">${ui.esc(s.id)}</strong><small class="block muted">${ui.date(s.fecha)} · ${ui.esc(s.factura_numero)}</small></td>
                  <td>${ui.badge(s.tipo === 'carrera' ? 'Carrera' : 'Encomienda', s.tipo === 'carrera' ? 'info' : 'orange')}</td>
                  <td><button class="cell-link" data-client="${ui.esc(s.cliente_cedula_rif)}"><strong>${ui.esc(c ? c.nombres + ' ' + c.apellidos : s.cliente_cedula_rif)}</strong><small class="block mono">${ui.esc(s.cliente_cedula_rif)}</small></button></td>
                  <td><button class="cell-link" data-driver="${ui.esc(s.conductor_cedula_rif)}"><strong>${ui.esc(d ? d.nombres + ' ' + d.apellidos : s.conductor_cedula_rif)}</strong><small class="block mono">${ui.esc(s.conductor_cedula_rif)}</small></button></td>
                  <td><span class="route-cell">${ui.esc(s.origen)} ${ui.icon('arrowRight', 12)} ${ui.esc(s.destino)}</span><small class="block muted">${ui.num(s.distancia_km)} km · ${s.duracion_min} min</small></td>
                  <td class="num">${ui.usd(s.base_usd)}</td>
                  <td class="num">${s.iva_usd ? ui.usd(s.iva_usd) + `<small class="block muted">${s.iva_pct}%</small>` : '<span class="muted">Exento</span>'}</td>
                  <td class="num">${s.igtf_usd ? ui.usd(s.igtf_usd) : '<span class="muted">—</span>'}</td>
                  <td class="num"><strong>${ui.usd(s.total_usd)}</strong></td>
                  <td class="num">${ui.usd(s.comision_usd)}<small class="block muted">${s.comision_pct}%</small></td>
                  <td><span class="pay-method">${ui.esc(s.metodo_pago)}</span></td>
                  <td class="actions-col"><button class="icon-btn" data-service="${ui.esc(s.id)}" title="Ver detalle">${ui.icon('eye', 16)}</button></td>
                </tr>`;
              }).join('') : `<tr><td colspan="12">${ui.empty('route', 'Sin servicios registrados', 'Registra la primera carrera o encomienda para generar contabilidad automática.')}</td></tr>`}
            </tbody>
          </table>
        </div>
      </section>
    `;

    const rerender = () => {
      filters.q = $('#service-search').value;
      filters.tipo = $('#service-type').value;
      filters.metodo = $('#service-method').value;
      render(view);
      const input = $('#service-search');
      if (input) { input.focus(); input.setSelectionRange(input.value.length, input.value.length); }
    };
    let t;
    $('#service-search').addEventListener('input', () => { clearTimeout(t); t = setTimeout(rerender, 180); });
    $('#service-type').addEventListener('change', rerender);
    $('#service-method').addEventListener('change', rerender);
    const newBtn = $('#services-new');
    if (newBtn) newBtn.addEventListener('click', () => openForm());
    const exportBtn = $('#services-export');
    if (exportBtn) exportBtn.addEventListener('click', exportCsv);
    view.querySelectorAll('[data-service]').forEach((b) => b.addEventListener('click', () => openDetail(b.dataset.service)));
    view.querySelectorAll('[data-client]').forEach((b) => b.addEventListener('click', () => NS.modules.clients.openDetail(b.dataset.client)));
    view.querySelectorAll('[data-driver]').forEach((b) => b.addEventListener('click', () => NS.modules.drivers.openDetail(b.dataset.driver)));
  }

  function exportCsv() {
    const db = NS.store.db;
    const rows = [['ID', 'Fecha', 'Tipo', 'Cliente', 'Conductor', 'Origen', 'Destino', 'Km', 'Min', 'Base USD', 'IVA %', 'IVA USD', 'IGTF %', 'IGTF USD', 'Total USD', 'Comisión %', 'Comisión USD', 'Pago conductor', 'Método', 'Factura', 'Control', 'Estatus']];
    db.services.forEach((s) => rows.push([s.id, s.fecha, s.tipo, s.cliente_cedula_rif, s.conductor_cedula_rif, s.origen, s.destino, s.distancia_km, s.duracion_min, s.base_usd, s.iva_pct, s.iva_usd, s.igtf_pct, s.igtf_usd, s.total_usd, s.comision_pct, s.comision_usd, s.pago_conductor_usd, s.metodo_pago, s.factura_numero, s.control_numero, s.estatus]));
    NS.ui.downloadFile('ENVIA_servicios_' + NS.store.today() + '.csv', NS.ui.csv(rows));
    NS.ui.toast('Historial de servicios exportado a CSV.', 'success');
  }

  function formHtml() {
    const ui = NS.ui;
    const db = NS.store.db;
    return `<form id="service-form" class="form-grid" autocomplete="off">
      <div class="form-section-title"><span>01</span><div><strong>Servicio y asignación</strong><small>Cliente y conductor se vinculan por su cédula / RIF (clave primaria).</small></div></div>
      <label class="field"><span>Tipo de servicio *</span><select name="tipo" id="svc-tipo"><option value="carrera">Carrera / Traslado</option><option value="encomienda">Encomienda / Delivery</option></select></label>
      <label class="field"><span>Fecha *</span><input name="fecha" type="date" value="${NS.store.today()}" required></label>
      <label class="field"><span>Cliente *</span><select name="cliente_cedula_rif" id="svc-client" required>
        <option value="">Selecciona un cliente...</option>
        ${db.clients.map((c) => `<option value="${ui.esc(c.cedula_rif)}">${ui.esc(c.cedula_rif)} · ${ui.esc(c.nombres + ' ' + c.apellidos)}</option>`).join('')}
      </select></label>
      <label class="field"><span>Conductor *</span><select name="conductor_cedula_rif" id="svc-driver" required>
        <option value="">Selecciona un conductor...</option>
        ${db.drivers.filter((d) => d.estatus_conductor !== 'Suspendido').map((d) => `<option value="${ui.esc(d.cedula_rif)}" data-com="${d.porcentaje_comision}">${ui.esc(d.cedula_rif)} · ${ui.esc(d.nombres + ' ' + d.apellidos)} · ${ui.esc(d.placa)}</option>`).join('')}
      </select></label>
      <label class="field"><span>Origen *</span><input name="origen" placeholder="Ej. Torre Delta, Chacao" required></label>
      <label class="field"><span>Destino *</span><input name="destino" placeholder="Ej. Aeropuerto de Maiquetía" required></label>
      <label class="field"><span>Distancia (km)</span><input name="distancia_km" type="number" min="0" step="0.1" value="0"></label>
      <label class="field"><span>Duración (min)</span><input name="duracion_min" type="number" min="0" step="1" value="0"></label>

      <div class="form-section-title"><span>02</span><div><strong>Tarifa y tributos</strong><small>IVA general 16%, reducido 8% o exento. IGTF 3% sobre pagos en divisas.</small></div></div>
      <label class="field"><span>Tarifa base (USD) *</span><input name="base_usd" id="svc-base" type="number" min="0.01" step="0.01" placeholder="0,00" required></label>
      <label class="field"><span>IVA</span><select name="iva_pct" id="svc-iva"><option value="16">16% · General</option><option value="8">8% · Reducido</option><option value="0">Exento / 0%</option></select></label>
      <label class="field"><span>Método de pago *</span><select name="metodo_pago" id="svc-method">${NS.store.PAYMENT_METHODS.map((m) => `<option>${m}</option>`).join('')}</select></label>
      <label class="field"><span>IGTF</span><input name="igtf_pct" id="svc-igtf" type="number" min="0" max="3" step="0.01" value="0" readonly><small>3% automático para Efectivo USD / Zelle.</small></label>
      <label class="field"><span>% Comisión ENVIA *</span><input name="comision_pct" id="svc-com" type="number" min="0" max="60" step="0.5" value="20" required></label>
      <label class="field"><span>N° Factura</span><input name="factura_numero" placeholder="FAC-2026-000"></label>
      <label class="field"><span>N° Control</span><input name="control_numero" placeholder="00-0000"></label>
      <label class="field field-full"><span>Notas</span><input name="notas" placeholder="Observaciones del servicio"></label>

      <div class="form-note field-full service-calc" id="svc-calc">
        <div><span>Base</span><strong>$ 0,00</strong></div>
        <div><span>IVA</span><strong>$ 0,00</strong></div>
        <div><span>IGTF</span><strong>$ 0,00</strong></div>
        <div><span>Total cliente</span><strong>$ 0,00</strong></div>
        <div><span>Comisión ENVIA</span><strong>$ 0,00</strong></div>
        <div><span>Pago conductor</span><strong>$ 0,00</strong></div>
      </div>
      <p class="form-note field-full">${ui.icon('info', 14)} Al guardar se generarán automáticamente: asiento de ingreso (con IVA/IGTF), asiento de costo por liquidación al conductor e incremento de sus contadores. Los montos contables se registran en VES a la tasa BCV del día.</p>
    </form>`;
  }

  function openForm() {
    const ui = NS.ui;
    if (!NS.app.canAction('services', 'crear')) return ui.toast('No tienes permiso para registrar servicios.', 'warning');
    const overlay = ui.modal({
      title: 'Nuevo servicio',
      eyebrow: 'Operación · carrera o encomienda',
      subtitle: 'Registra el servicio y deja que ENVIA ERP genere la contabilidad automática.',
      size: 'lg',
      body: formHtml(),
      footer: `<button class="btn btn-ghost" data-cancel>Cancelar</button><button class="btn btn-primary" id="service-save">${ui.icon('check', 16)} Registrar servicio</button>`
    });

    const form = overlay.querySelector('#service-form');
    const calc = () => {
      const base = Number(form.elements.base_usd.value) || 0;
      const ivaPct = Number(form.elements.iva_pct.value) || 0;
      const igtfPct = Number(form.elements.igtf_pct.value) || 0;
      const comPct = Number(form.elements.comision_pct.value) || 0;
      const iva = base * ivaPct / 100;
      const igtf = (base + iva) * igtfPct / 100;
      const total = base + iva + igtf;
      const com = base * comPct / 100;
      const box = overlay.querySelector('#svc-calc');
      const vals = [base, iva, igtf, total, com, base - com];
      box.querySelectorAll('strong').forEach((el, i) => { el.textContent = ui.usd(vals[i]); });
    };
    form.elements.base_usd.addEventListener('input', calc);
    form.elements.iva_pct.addEventListener('change', calc);
    form.elements.comision_pct.addEventListener('input', calc);
    const syncTax = () => {
      const method = form.elements.metodo_pago.value;
      const igtf = ['Efectivo USD', 'Zelle'].includes(method) ? 3 : 0;
      form.elements.igtf_pct.value = igtf;
      calc();
    };
    form.elements.metodo_pago.addEventListener('change', syncTax);
    form.elements.conductor_cedula_rif.addEventListener('change', () => {
      const opt = form.elements.conductor_cedula_rif.selectedOptions[0];
      if (opt && opt.dataset.com) form.elements.comision_pct.value = opt.dataset.com;
      calc();
    });
    calc();

    overlay.querySelector('[data-cancel]').addEventListener('click', () => ui.closeModal(overlay));
    overlay.querySelector('#service-save').addEventListener('click', () => {
      if (!form.reportValidity()) return;
      const data = {};
      Array.from(form.elements).forEach((el) => { if (el.name) data[el.name] = el.value; });
      data.base_usd = Number(data.base_usd);
      data.iva_pct = Number(data.iva_pct);
      data.igtf_pct = Number(form.elements.igtf_pct.value);
      data.comision_pct = Number(data.comision_pct);
      const btn = overlay.querySelector('#service-save');
      ui.setBusy(btn, true, 'Contabilizando...');
      try {
        const svc = NS.store.addService(data);
        ui.closeModal(overlay);
        ui.toast('Servicio ' + svc.id + ' registrado. Asientos de ingreso y liquidación generados.', 'success');
        NS.app.refresh(true);
        openDetail(svc.id);
      } catch (e) {
        ui.setBusy(btn, false);
        ui.toast(e.message, 'error');
      }
    });
  }

  function openDetail(id) {
    const ui = NS.ui;
    const db = NS.store.db;
    const s = db.services.find((x) => x.id === id);
    if (!s) return;
    const c = db.clients.find((x) => x.cedula_rif === s.cliente_cedula_rif);
    const d = db.drivers.find((x) => x.cedula_rif === s.conductor_cedula_rif);
    const entries = db.entries.filter((e) => e.referencia === s.id);
    const body = `
      <div class="service-hero">
        <div class="service-hero-id"><span class="service-icon">${ui.icon(s.tipo === 'carrera' ? 'car' : 'package', 28)}</span><div><span class="mono">${ui.esc(s.id)}</span><strong>${ui.esc(s.origen)} ${ui.icon('arrowRight', 16)} ${ui.esc(s.destino)}</strong><small>${ui.dateLong(s.fecha)} · ${ui.esc(s.metodo_pago)} · ${s.distancia_km} km / ${s.duracion_min} min</small></div></div>
        <div class="service-hero-total"><span>Total cobrado</span><strong>${ui.usd(s.total_usd)}</strong><small>${ui.bs(ui.toBs(s.total_usd))}</small></div>
      </div>

      <div class="detail-grid">
        <div class="detail-main">
          <div class="detail-block">
            <h4>Partes del servicio</h4>
            <div class="party-grid">
              <button class="party-card" data-client="${ui.esc(s.cliente_cedula_rif)}">
                ${ui.avatar(c ? c.nombres + ' ' + c.apellidos : s.cliente_cedula_rif, 42)}
                <div><span>Cliente</span><strong>${ui.esc(c ? c.nombres + ' ' + c.apellidos : 'No encontrado')}</strong><small class="mono">${ui.esc(s.cliente_cedula_rif)}</small></div>
              </button>
              <button class="party-card" data-driver="${ui.esc(s.conductor_cedula_rif)}">
                ${ui.avatar(d ? d.nombres + ' ' + d.apellidos : s.conductor_cedula_rif, 42)}
                <div><span>Conductor</span><strong>${ui.esc(d ? d.nombres + ' ' + d.apellidos : 'No encontrado')}</strong><small class="mono">${ui.esc(s.conductor_cedula_rif)} · ${ui.esc(d ? d.placa : '')}</small></div>
              </button>
            </div>
          </div>

          <div class="detail-block">
            <h4>Desglose financiero</h4>
            <table class="mini-table">
              <tbody>
                <tr><td>Tarifa base</td><td class="num">${ui.usd(s.base_usd)}</td><td class="num muted">${ui.bs(ui.toBs(s.base_usd))}</td></tr>
                <tr><td>IVA ${s.iva_pct}%</td><td class="num">${ui.usd(s.iva_usd)}</td><td class="num muted">${ui.bs(ui.toBs(s.iva_usd))}</td></tr>
                <tr><td>IGTF ${s.igtf_pct}%</td><td class="num">${ui.usd(s.igtf_usd)}</td><td class="num muted">${ui.bs(ui.toBs(s.igtf_usd))}</td></tr>
                <tr class="total-row"><td>Total cobrado al cliente</td><td class="num">${ui.usd(s.total_usd)}</td><td class="num muted">${ui.bs(ui.toBs(s.total_usd))}</td></tr>
                <tr><td>Comisión ENVIA (${s.comision_pct}%)</td><td class="num text-green">${ui.usd(s.comision_usd)}</td><td class="num muted">${ui.bs(ui.toBs(s.comision_usd))}</td></tr>
                <tr><td>Liquidación al conductor</td><td class="num">${ui.usd(s.pago_conductor_usd)}</td><td class="num muted">${ui.bs(ui.toBs(s.pago_conductor_usd))}</td></tr>
              </tbody>
            </table>
          </div>

          <div class="detail-block">
            <h4>Asientos contables generados <span class="h4-note">${entries.length} partidas</span></h4>
            ${entries.length ? entries.map((e) => `<div class="entry-mini">
              <div class="entry-mini-head"><strong class="mono">${ui.esc(e.numero)}</strong><span>${ui.esc(e.descripcion)}</span><button class="link" data-entry="${ui.esc(e.id)}">Ver</button></div>
              <table class="mini-table"><tbody>${e.lines.map((l) => `<tr><td class="mono">${ui.esc(l.cuenta)} · ${ui.esc(NS.store.accountName(l.cuenta))}</td><td class="num">${l.debe ? ui.bs(l.debe) : ''}</td><td class="num">${l.haber ? ui.bs(l.haber) : ''}</td></tr>`).join('')}</tbody></table>
            </div>`).join('') : `<p class="muted small">Sin asientos vinculados.</p>`}
          </div>
        </div>

        <aside class="detail-side">
          <div class="side-metrics">
            <div class="side-metric"><span>Estatus</span><strong style="font-size:14px">${ui.badge(s.estatus)}</strong></div>
            <div class="side-metric"><span>N° Factura</span><strong class="mono" style="font-size:13px">${ui.esc(s.factura_numero)}</strong></div>
            <div class="side-metric"><span>N° Control</span><strong class="mono" style="font-size:13px">${ui.esc(s.control_numero || '—')}</strong></div>
          </div>
          <div class="detail-block"><h4>Observaciones</h4><p class="small muted">${ui.esc(s.notas || 'Sin observaciones registradas.')}</p></div>
          <div class="audit-note">${ui.icon('book', 14)} Los asientos se generaron con tasa BCV de Bs ${ui.num(s.base_usd ? db.taxParams.bcvRate : 0)} / USD al momento del registro.</div>
        </aside>
      </div>`;
    const overlay = ui.modal({
      title: 'Detalle del servicio',
      eyebrow: 'Operación · ' + s.tipo,
      size: 'xl',
      body,
      footer: `<button class="btn btn-primary" data-close-detail>Cerrar</button>`
    });
    overlay.querySelector('[data-close-detail]').addEventListener('click', () => ui.closeModal(overlay));
    overlay.querySelectorAll('[data-client]').forEach((b) => b.addEventListener('click', () => { ui.closeModal(overlay); NS.modules.clients.openDetail(b.dataset.client); }));
    overlay.querySelectorAll('[data-driver]').forEach((b) => b.addEventListener('click', () => { ui.closeModal(overlay); NS.modules.drivers.openDetail(b.dataset.driver); }));
    overlay.querySelectorAll('[data-entry]').forEach((b) => b.addEventListener('click', () => {
      ui.closeModal(overlay);
      NS.modules.accounting.openEntry(b.dataset.entry);
    }));
  }

  NS.modules.services = { render, openForm, openDetail };
})();
