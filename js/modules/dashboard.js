/* =========================================================================
   ENVIA ERP · modules/dashboard.js
   Tablero de operación: pulso de 14 días, ritmo de ingresos, composición,
   cobros y obligaciones pendientes.
   ========================================================================= */
(function () {
  'use strict';
  const NS = (window.ENVIA = window.ENVIA || {});
  NS.modules = NS.modules || {};
  const U = () => NS.ui;

  function render(view) {
    const ui = NS.ui;
    const store = NS.store;
    const db = store.db;
    const m = store.metrics();
    const rate = ui.rate();
    const canNewClient = NS.app.canAction('clients', 'crear');
    const canNewPayable = NS.app.canAction('payables', 'crear');
    const canNewService = NS.app.canAction('services', 'crear');
    const todayKey = store.today();
    const todayRaw = new Date(todayKey + 'T12:00:00').toLocaleDateString('es-VE', {
      weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
    });
    const todayLong = todayRaw.charAt(0).toUpperCase() + todayRaw.slice(1);
    const recent = db.services.slice(0, 8);

    const pendingAll = db.payables
      .filter((p) => p.estatus !== 'Pagado')
      .sort((a, b) => a.fecha_vencimiento.localeCompare(b.fecha_vencimiento));
    const pending = pendingAll.slice(0, 4);
    const overdueCount = pendingAll.filter((p) => p.fecha_vencimiento < todayKey).length;

    /* Serie de 14 días */
    const days = [];
    for (let i = 13; i >= 0; i--) {
      const day = store.iso(i);
      const total = db.services
        .filter((s) => s.fecha === day)
        .reduce((sum, s) => sum + Number(s.base_usd), 0);
      days.push({
        day,
        total,
        label: new Date(day + 'T12:00:00').toLocaleDateString('es-VE', { day: '2-digit' }),
        dow: new Date(day + 'T12:00:00').toLocaleDateString('es-VE', { weekday: 'short' })
      });
    }
    const maxDay = Math.max(...days.map((d) => d.total), 1);
    const best = days.reduce((a, b) => (b.total > a.total ? b : a), days[0]);
    const bestLabel = best.total
      ? `Mejor día: ${ui.date(best.day)}, ${ui.usd(best.total)}`
      : 'Sin servicios en el período';

    const periodStart = days[0].day;
    const period = db.services.filter((s) => s.fecha >= periodStart && s.fecha <= todayKey);
    const sumBy = (arr, key) => arr.reduce((s, x) => s + Number(x[key] || 0), 0);
    const pGross = sumBy(period, 'base_usd');
    const pCommission = sumBy(period, 'comision_usd');
    const pTax = sumBy(period, 'iva_usd') + sumBy(period, 'igtf_usd');
    const pRides = period.filter((s) => s.tipo === 'carrera');
    const pDeliveries = period.filter((s) => s.tipo === 'encomienda');
    const margin = pGross ? (pCommission / pGross) * 100 : 0;
    const marginLabel = ui.pct(margin).replace('.', ',');
    const avgDay = pGross / 14;

    const todayServices = db.services.filter((s) => s.fecha === todayKey);
    const todayGross = sumBy(todayServices, 'base_usd');

    /* Alertas operativas: documentos por vencer, stock bajo y cartera de asociados. */
    const docAlerts = store.documentAlerts().slice(0, 4);
    const lowStock = db.products.filter((p) => p.activo && p.stock <= p.stock_min).slice(0, 4);
    const topPartners = db.partners.filter((p) => p.saldo_por_cobrar_usd > 0).sort((a, b) => b.saldo_por_cobrar_usd - a.saldo_por_cobrar_usd).slice(0, 4);

    const startLabel = new Date(periodStart + 'T12:00:00').toLocaleDateString('es-VE', { day: '2-digit', month: 'short' });
    const endLabel = new Date(todayKey + 'T12:00:00').toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' });

    /* Métodos de pago */
    const payMethods = {};
    period.forEach((s) => {
      payMethods[s.metodo_pago] = (payMethods[s.metodo_pago] || 0) + Number(s.total_usd);
    });
    const methodColors = {
      'Pago Móvil': '#005FFF',
      'Efectivo USD': '#F05A24',
      'Zelle': '#7C5CFC',
      'Tarjeta': '#C99A00',
      'Wallet': '#46B6F9'
    };
    const methodRows = Object.keys(payMethods)
      .map((k) => ({ label: k, value: payMethods[k], color: methodColors[k] || '#34537F' }))
      .sort((a, b) => b.value - a.value);
    const methodTotal = methodRows.reduce((s, x) => s + x.value, 0);

    /* Estado de vencimiento */
    function dueInfo(date) {
      if (!date) return { label: 'Sin fecha', tone: '', days: 0 };
      const diff = Math.round((new Date(date + 'T12:00:00') - new Date(todayKey + 'T12:00:00')) / 86400000);
      if (diff < 0) return { label: 'Vencida', tone: 'overdue', days: Math.abs(diff) };
      if (diff === 0) return { label: 'Vence hoy', tone: 'soon', days: 0 };
      if (diff === 1) return { label: 'Mañana', tone: 'soon', days: 1 };
      if (diff <= 7) return { label: 'En ' + diff + ' d', tone: 'soon', days: diff };
      return {
        label: new Date(date + 'T12:00:00').toLocaleDateString('es-VE', { day: '2-digit', month: 'short' }),
        tone: '',
        days: diff
      };
    }

    const payableRows = pending.map((p) => {
      const sup = db.suppliers.find((s) => s.rif === p.proveedor_rif);
      const info = dueInfo(p.fecha_vencimiento);
      const flag = info.tone === 'overdue'
        ? `<span class="payable-flag overdue"><i></i>${info.label}</span>`
        : `<span class="payable-flag ${info.tone}">${info.label}</span>`;
      return `<button class="payable-row" data-payable="${ui.esc(p.id)}" title="${info.tone === 'overdue' ? 'Vencida hace ' + info.days + ' días' : info.label}">
        ${flag}
        <span class="payable-main">
          <strong>${ui.esc(sup ? sup.razon_social : p.proveedor_rif)}</strong>
          <small>Factura ${ui.esc(p.numero_factura)}, vence ${ui.date(p.fecha_vencimiento)}</small>
        </span>
        <span class="payable-amount">${ui.usd(p.neto_pagar_usd - p.pagado_usd)}</span>
      </button>`;
    }).join('');

    const methodRowsHtml = methodRows.length ? methodRows.map((row) => {
      const pct = methodTotal ? (row.value / methodTotal) * 100 : 0;
      return `<div class="pay-row">
        <span class="pay-dot" style="background:${row.color}"></span>
        <span class="pay-name">${ui.esc(row.label)}</span>
        <span class="pay-track"><i style="width:${pct.toFixed(1)}%;background:${row.color}"></i></span>
        <span class="pay-amount">${ui.usd(row.value)}</span>
        <span class="pay-pct">${pct.toFixed(0)}%</span>
      </div>`;
    }).join('') : ui.empty('wallet', 'Sin cobros', 'No hay pagos registrados en el período.');

    view.innerHTML = `
      <div class="page-head dash-head">
        <div>
          <div class="dash-date">${ui.icon('clock', 12)} ${ui.esc(todayLong)}</div>
          <h2 class="page-title">Así va la operación.</h2>
          <p class="page-sub">${m.activeDrivers} de ${m.totalDrivers} conductores activos y ${pendingAll.length} facturas pendientes por revisar.</p>
        </div>
        <div class="page-actions">
          ${NS.reports.button('dashboard')}
          ${canNewClient ? `<button class="btn btn-ghost" id="dash-new-client">${ui.icon('plus', 16)} Cliente</button>` : ''}
          ${canNewPayable ? `<button class="btn btn-ghost" id="dash-new-payable">${ui.icon('receipt', 16)} Factura</button>` : ''}
          ${canNewService ? `<button class="btn btn-primary" id="dash-new-service">${ui.icon('route', 16)} Nuevo servicio</button>` : `<span class="readonly-chip">${ui.icon('eye', 14)} Modo auditoría · solo lectura</span>`}
        </div>
      </div>

      <section class="ops-band" aria-label="Resumen de los últimos 14 días">
        <div class="ops-grid">
          <div class="ops-cell ops-lead">
            <span class="ops-kicker">Operación de 14 días</span>
            <strong class="ops-range">Del ${ui.esc(startLabel)} al ${ui.esc(endLabel)}</strong>
            <span class="ops-live"><i></i> Hoy: ${todayServices.length} servicios, ${ui.usd(todayGross)}</span>
          </div>
          <div class="ops-cell ops-cell-main">
            <span class="ops-label">Ingresos brutos</span>
            <strong class="ops-value">${ui.usd(pGross)}</strong>
            <span class="ops-sub">${ui.bs(ui.toBs(pGross))}</span>
          </div>
          <div class="ops-cell">
            <span class="ops-label">Comisión ENVIA</span>
            <strong class="ops-value">${ui.usd(pCommission)}</strong>
            <span class="ops-sub">${marginLabel} de margen</span>
          </div>
          <div class="ops-cell">
            <span class="ops-label">Servicios</span>
            <strong class="ops-value">${period.length}</strong>
            <span class="ops-sub">${pRides.length} carreras y ${pDeliveries.length} encomiendas</span>
          </div>
        </div>
        <div class="ops-foot">
          <span><b>${m.activeDrivers}</b> de ${m.totalDrivers} conductores activos</span>
          <span><b>${pendingAll.length}</b> facturas pendientes por <b>${ui.usd(m.pending)}</b></span>
          <span>IVA + IGTF del período <b>${ui.usd(pTax)}</b></span>
          <span class="ops-rate">Tasa BCV <b>${ui.num(rate, 2)}</b></span>
        </div>
      </section>

      <section class="panel ops-alerts">
        <div class="panel-head">
          <div><h3>Alertas operativas</h3><p>Documentos, inventario y cartera de negocios asociados</p></div>
          <a class="link" href="#/drivers">Conductores ${ui.icon('arrowRight', 13)}</a>
        </div>
        <div class="dash-alert-grid">
          <div class="dash-alert-col">
            <div class="dash-alert-title">${ui.icon('alert', 15)} Documentos por vencer o vencidos <span>${docAlerts.length}</span></div>
            ${docAlerts.length ? docAlerts.map(({ driver, alert }) => `<button class="dash-alert-row" data-alert-driver="${ui.esc(driver.cedula_rif)}">
              <span class="dash-alert-main"><strong>${ui.esc(driver.nombres + ' ' + driver.apellidos)}</strong><small>${ui.esc(alert.label)} · ${alert.vencimiento ? ui.date(alert.vencimiento) : 'sin fecha'}</small></span>
              ${alert.vencido ? ui.badge('Vencido', 'danger') : ui.badge(alert.dias + ' d', 'warning')}
            </button>`).join('') : `<p class="muted small">Sin documentos críticos. Todos los expedientes están al día.</p>`}
          </div>
          <div class="dash-alert-col">
            <div class="dash-alert-title">${ui.icon('package', 15)} Inventario bajo mínimo <span>${m.lowStock}</span></div>
            ${lowStock.length ? lowStock.map((p) => `<a class="dash-alert-row" href="#/inventory">
              <span class="dash-alert-main"><strong>${ui.esc(p.nombre)}</strong><small>${ui.esc(p.sku)} · mínimo ${p.stock_min}</small></span>
              ${ui.badge(p.stock + ' disp.', 'warning')}
            </a>`).join('') : `<p class="muted small">Inventario saludable. No hay productos bajo el mínimo.</p>`}
          </div>
          <div class="dash-alert-col">
            <div class="dash-alert-title">${ui.icon('building', 15)} Comisiones de asociados <span>${ui.usd(m.partnersReceivable)}</span></div>
            ${topPartners.length ? topPartners.map((p) => `<a class="dash-alert-row" href="#/partners">
              <span class="dash-alert-main"><strong>${ui.esc(p.razon_social)}</strong><small>${p.comision_pct}% · ${ui.esc(p.tipo)}</small></span>
              <strong class="text-orange">${ui.usd(p.saldo_por_cobrar_usd)}</strong>
            </a>`).join('') : `<p class="muted small">Sin comisiones pendientes de cobro.</p>`}
          </div>
        </div>
      </section>

      <div class="dash-row dash-row-main">
        <section class="panel">
          <div class="panel-head">
            <div><h3>Ritmo de ingresos</h3><p>Valor base de los servicios, día por día</p></div>
            <span class="panel-note">${bestLabel}</span>
          </div>
          <div class="rhythm-chart">
            ${days.map((d) => {
              const isToday = d.day === todayKey;
              const isBest = d.day === best.day;
              const height = Math.max(d.total ? 5 : 2, (d.total / maxDay) * 100);
              return `<div class="rhythm-col ${isToday ? 'is-today' : ''} ${isBest ? 'is-best' : ''}" title="${ui.date(d.day)}: ${ui.usd(d.total)}">
                <span class="rhythm-value">${(isToday || isBest) && d.total ? ui.usdRaw(d.total) : ''}</span>
                <span class="rhythm-track"><i style="height:${height}%"></i></span>
                <span class="rhythm-label">${d.label}<small>${d.dow}</small></span>
              </div>`;
            }).join('')}
          </div>
          <div class="rhythm-foot">
            <span>Promedio diario <b>${ui.usd(avgDay)}</b></span>
            <span class="rhythm-key"><i></i> Hoy</span>
          </div>
        </section>

        <section class="panel panel-payables">
          <div class="panel-head">
            <div><h3>Por pagar</h3><p>Facturas y liquidaciones pendientes</p></div>
            <a class="link" href="#/payables">Ver CxP ${ui.icon('arrowRight', 13)}</a>
          </div>
          ${overdueCount ? `<div class="panel-alert">${ui.icon('alert', 13)} ${overdueCount} ${overdueCount === 1 ? 'factura vencida' : 'facturas vencidas'}</div>` : ''}
          <div class="payable-list">
            ${payableRows || ui.empty('check', 'Sin facturas pendientes', 'Todas las cuentas por pagar están al día.')}
          </div>
          <div class="payable-foot">
            <span>Facturas pendientes <b>${ui.usd(m.pending)}</b></span>
            <span>Liquidaciones a conductores <b>${ui.usd(m.driversPending)}</b></span>
          </div>
        </section>
      </div>

      <section class="panel">
        <div class="panel-head">
          <div><h3>De dónde viene y cómo se cobra</h3><p>Composición del ingreso y métodos de cobro del período</p></div>
        </div>
        <div class="money-split">
          <div class="money-block">
            ${ui.donut([
              { label: 'Carreras / Traslados', value: sumBy(pRides, 'base_usd'), color: '#005FFF' },
              { label: 'Encomiendas / Delivery', value: sumBy(pDeliveries, 'base_usd'), color: '#F05A24' }
            ], { size: 150, stroke: 20, centerLabel: 'Ingresos' })}
            <div class="mix-foot">
              <span>Comisión retenida <b>${ui.usd(pCommission)}</b></span>
              <span>IVA + IGTF <b>${ui.usd(pTax)}</b></span>
            </div>
          </div>
          <div class="money-block money-collect">
            <div class="money-sub">Métodos de cobro</div>
            <div class="pay-list">${methodRowsHtml}</div>
            <div class="pay-foot">
              <span>Total cobrado <b>${ui.usd(methodTotal)}</b></span>
              <span>Ticket promedio <b>${ui.usd(period.length ? methodTotal / period.length : 0)}</b></span>
            </div>
          </div>
        </div>
      </section>

      <section class="panel panel-flush">
        <div class="panel-head panel-head-pad">
          <div><h3>Servicios recientes</h3><p>Vinculados por cédula o RIF al cliente y al conductor</p></div>
          <a class="link" href="#/services">Ver historial ${ui.icon('arrowRight', 14)}</a>
        </div>
        <div class="table-wrap">
          <table class="data-table dash-table">
            <thead><tr>
              <th>Servicio</th><th>Tipo</th><th>Cliente</th><th>Conductor</th><th>Ruta</th><th>Método</th><th class="num">Total</th><th>Estatus</th>
            </tr></thead>
            <tbody>
              ${recent.length ? recent.map((s) => {
                const c = db.clients.find((x) => x.cedula_rif === s.cliente_cedula_rif);
                const d = db.drivers.find((x) => x.cedula_rif === s.conductor_cedula_rif);
                return `<tr>
                  <td><strong class="mono">${ui.esc(s.id)}</strong><small class="block muted">${ui.date(s.fecha)}</small></td>
                  <td>${ui.badge(s.tipo === 'carrera' ? 'Carrera' : 'Encomienda', s.tipo === 'carrera' ? 'info' : 'orange')}</td>
                  <td><button class="cell-link" data-client="${ui.esc(s.cliente_cedula_rif)}"><strong>${ui.esc(c ? c.nombres + ' ' + c.apellidos : s.cliente_cedula_rif)}</strong><small class="block mono">${ui.esc(s.cliente_cedula_rif)}</small></button></td>
                  <td><button class="cell-link" data-driver="${ui.esc(s.conductor_cedula_rif)}"><strong>${ui.esc(d ? d.nombres + ' ' + d.apellidos : s.conductor_cedula_rif)}</strong><small class="block mono">${ui.esc(s.conductor_cedula_rif)}</small></button></td>
                  <td><span class="route-cell">${ui.esc(s.origen)} ${ui.icon('arrowRight', 12)} ${ui.esc(s.destino)}</span><small class="block muted">${ui.num(s.distancia_km)} km · ${s.duracion_min} min</small></td>
                  <td>${ui.esc(s.metodo_pago)}</td>
                  <td class="num"><strong>${ui.usd(s.total_usd)}</strong><small class="block muted">${ui.bs(ui.toBs(s.total_usd))}</small></td>
                  <td>${ui.badge(s.estatus)}</td>
                </tr>`;
              }).join('') : `<tr><td colspan="8">${ui.empty('route', 'Sin servicios', 'Registra el primer servicio para verlo aquí.')}</td></tr>`}
            </tbody>
          </table>
        </div>
      </section>
    `;

    const newService = $('#dash-new-service');
    if (newService) newService.addEventListener('click', () => NS.modules.services.openForm());
    const newClient = $('#dash-new-client');
    if (newClient) newClient.addEventListener('click', () => NS.modules.clients.openForm());
    const newPayable = $('#dash-new-payable');
    if (newPayable) newPayable.addEventListener('click', () => NS.modules.payables.openInvoiceForm());
    view.querySelectorAll('[data-payable]').forEach((b) => b.addEventListener('click', () => NS.modules.payables.openDetail(b.dataset.payable)));
    view.querySelectorAll('[data-client]').forEach((b) => b.addEventListener('click', () => NS.modules.clients.openDetail(b.dataset.client)));
    view.querySelectorAll('[data-driver]').forEach((b) => b.addEventListener('click', () => NS.modules.drivers.openDetail(b.dataset.driver)));
    view.querySelectorAll('[data-alert-driver]').forEach((b) => b.addEventListener('click', () => NS.modules.drivers.openDetail(b.dataset.alertDriver)));
  }

  NS.modules.dashboard = { render };
})();
