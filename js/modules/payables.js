/* =========================================================================
   ENVIA ERP · modules/payables.js
   Portal de proveedores, facturas de compra, liquidaciones a conductores,
   retenciones IVA/ISLR y control de pagos.
   ========================================================================= */
(function () {
  'use strict';
  const NS = (window.ENVIA = window.ENVIA || {});
  NS.modules = NS.modules || {};

  let state = { tab: 'invoices', q: '', status: '' };

  function render(view) {
    const ui = NS.ui;
    const db = NS.store.db;
    const canWrite = NS.app.canWrite();
    const totals = db.payables.reduce((s, p) => {
      const pend = Math.max(0, p.neto_pagar_usd - p.pagado_usd);
      const overdue = p.fecha_vencimiento < NS.store.today() && pend > 0.01;
      return {
        total: s.total + p.total_usd,
        neto: s.neto + p.neto_pagar_usd,
        pagado: s.pagado + p.pagado_usd,
        pendiente: s.pendiente + pend,
        vencido: s.vencido + (overdue ? pend : 0),
        retenido: s.retenido + p.ret_iva_usd + p.ret_islr_usd
      };
    }, { total: 0, neto: 0, pagado: 0, pendiente: 0, vencido: 0, retenido: 0 });

    view.innerHTML = `
      <div class="page-head">
        <div>
          <span class="eyebrow">Finanzas · cuentas por pagar</span>
          <h2 class="page-title">Proveedores, facturas y liquidaciones</h2>
          <p class="page-sub">${db.payables.length} facturas registradas · ${db.suppliers.length} proveedores · ${db.drivers.filter((d) => d.saldo_por_liquidar_usd > 0).length} conductores con saldo por liquidar.</p>
        </div>
        <div class="page-actions">
          <button class="btn btn-ghost" id="cxp-export">${ui.icon('download', 16)} Exportar</button>
          ${canWrite ? `<button class="btn btn-ghost" id="cxp-new-supplier">${ui.icon('building', 16)} Proveedor</button>` : ''}
          ${canWrite ? `<button class="btn btn-primary" id="cxp-new-invoice">${ui.icon('plus', 16)} Nueva factura</button>` : ''}
        </div>
      </div>

      <div class="stat-strip">
        <div class="stat-strip-item"><span>Total por pagar</span><strong>${ui.usd(totals.pendiente)}</strong><small>${ui.bs(ui.toBs(totals.pendiente))}</small></div>
        <div class="stat-strip-item"><span>Vencido</span><strong class="${totals.vencido > 0 ? 'text-danger' : ''}">${ui.usd(totals.vencido)}</strong><small>${ui.bs(ui.toBs(totals.vencido))} · requiere atención</small></div>
        <div class="stat-strip-item"><span>Pagado acumulado</span><strong>${ui.usd(totals.pagado)}</strong><small>${ui.bs(ui.toBs(totals.pagado))}</small></div>
        <div class="stat-strip-item"><span>Retenciones practicadas</span><strong>${ui.usd(totals.retenido)}</strong><small>${db.withholdings.length} comprobantes emitidos</small></div>
      </div>

      <div class="tabs">
        <button class="tab ${state.tab === 'invoices' ? 'active' : ''}" data-cxp-tab="invoices">${ui.icon('receipt', 15)} Facturas de compra</button>
        <button class="tab ${state.tab === 'suppliers' ? 'active' : ''}" data-cxp-tab="suppliers">${ui.icon('building', 15)} Maestro de proveedores</button>
        <button class="tab ${state.tab === 'settlements' ? 'active' : ''}" data-cxp-tab="settlements">${ui.icon('moto', 15)} Liquidaciones a conductores</button>
      </div>
      <div id="cxp-content"></div>`;

    view.querySelectorAll('[data-cxp-tab]').forEach((b) => b.addEventListener('click', () => {
      state.tab = b.dataset.cxpTab;
      render(view);
    }));
    const content = view.querySelector('#cxp-content');
    if (state.tab === 'invoices') renderInvoices(content, view);
    else if (state.tab === 'suppliers') renderSuppliers(content, view);
    else renderSettlements(content, view);

    if (canWrite) {
      $('#cxp-new-invoice').addEventListener('click', () => openInvoiceForm());
      $('#cxp-new-supplier').addEventListener('click', () => openSupplierForm());
    }
    $('#cxp-export').addEventListener('click', exportAll);
  }

  function pendingOf(p) { return Math.max(0, Math.round((p.neto_pagar_usd - p.pagado_usd) * 100) / 100); }

  function renderInvoices(el, view) {
    const ui = NS.ui;
    const db = NS.store.db;
    const canWrite = NS.app.canWrite();
    const q = state.q.toLowerCase();
    const list = db.payables.filter((p) => {
      const sup = db.suppliers.find((s) => s.rif === p.proveedor_rif);
      const hay = [p.id, p.numero_factura, p.numero_control, p.proveedor_rif, p.concepto, p.comprobante_numero, sup ? sup.razon_social : ''].join(' ').toLowerCase();
      return (!q || hay.includes(q)) && (!state.status || p.estatus === state.status);
    }).slice().sort((a, b) => b.fecha_emision.localeCompare(a.fecha_emision));

    el.innerHTML = `<section class="card card-flush">
      <div class="toolbar">
        <div class="search-box">${ui.icon('search', 17)}<input id="cxp-search" type="search" placeholder="Buscar por factura, proveedor, RIF, comprobante..." value="${ui.esc(state.q)}"></div>
        <div class="toolbar-right">
          <select id="cxp-status" class="select-inline">
            <option value="">Todos los estatus</option>
            ${['Pendiente', 'Pagado Parcial', 'Pagado'].map((s) => `<option ${state.status === s ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
          <span class="count-chip">${list.length} facturas</span>
        </div>
      </div>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Factura</th><th>Proveedor</th><th>Emisión</th><th>Vencimiento</th><th class="num">Base</th><th class="num">IVA</th><th class="num">IGTF</th><th class="num">Retenciones</th><th class="num">Neto a pagar</th><th class="num">Pagado</th><th>Estatus</th><th class="actions-col"></th></tr></thead>
          <tbody>${list.length ? list.map((p) => {
            const sup = db.suppliers.find((s) => s.rif === p.proveedor_rif);
            const overdue = p.fecha_vencimiento < NS.store.today() && pendingOf(p) > 0.01;
            return `<tr>
              <td><strong class="mono">${ui.esc(p.numero_factura)}</strong><small class="block muted">${ui.esc(p.id)} · Ctrl ${ui.esc(p.numero_control || '—')}</small></td>
              <td><button class="cell-link" data-supplier="${ui.esc(p.proveedor_rif)}"><strong>${ui.esc(sup ? sup.razon_social : p.proveedor_rif)}</strong><small class="block mono">${ui.esc(p.proveedor_rif)}</small></button></td>
              <td>${ui.date(p.fecha_emision)}</td>
              <td><span class="${overdue ? 'text-danger strong' : ''}">${ui.date(p.fecha_vencimiento)}</span>${overdue ? `<small class="block text-danger">Vencida</small>` : ''}</td>
              <td class="num">${ui.usd(p.base_usd)}</td>
              <td class="num">${ui.usd(p.iva_usd)}<small class="block muted">${p.iva_pct}%</small></td>
              <td class="num">${p.igtf_usd ? ui.usd(p.igtf_usd) : '<span class="muted">—</span>'}</td>
              <td class="num">${ui.usd(p.ret_iva_usd + p.ret_islr_usd)}<small class="block muted">IVA ${p.ret_iva_pct}% · ISLR ${p.ret_islr_tarifa}%</small></td>
              <td class="num"><strong>${ui.usd(p.neto_pagar_usd)}</strong></td>
              <td class="num">${ui.usd(p.pagado_usd)}</td>
              <td>${ui.badge(p.estatus)}</td>
              <td class="actions-col">
                <button class="icon-btn" data-payable="${ui.esc(p.id)}" title="Ver factura">${ui.icon('eye', 16)}</button>
                ${canWrite && pendingOf(p) > 0.01 ? `<button class="icon-btn success" data-pay="${ui.esc(p.id)}" title="Registrar pago">${ui.icon('bank', 16)}</button>` : ''}
                ${canWrite ? `<button class="icon-btn danger" data-del-payable="${ui.esc(p.id)}" title="Eliminar">${ui.icon('trash', 16)}</button>` : ''}
              </td>
            </tr>`;
          }).join('') : `<tr><td colspan="12">${ui.empty('receipt', 'Sin facturas', 'No hay facturas que coincidan con los filtros.')}</td></tr>`}</tbody>
        </table>
      </div>
    </section>`;

    let t;
    el.querySelector('#cxp-search').addEventListener('input', (e) => {
      state.q = e.target.value;
      clearTimeout(t);
      t = setTimeout(() => { renderInvoices(el, view); const i = el.querySelector('#cxp-search'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 170);
    });
    el.querySelector('#cxp-status').addEventListener('change', (e) => { state.status = e.target.value; render(view); });
    el.querySelectorAll('[data-payable]').forEach((b) => b.addEventListener('click', () => openDetail(b.dataset.payable)));
    el.querySelectorAll('[data-pay]').forEach((b) => b.addEventListener('click', () => openPayment(b.dataset.pay)));
    el.querySelectorAll('[data-del-payable]').forEach((b) => b.addEventListener('click', () => askDelete(b.dataset.delPayable)));
    el.querySelectorAll('[data-supplier]').forEach((b) => b.addEventListener('click', () => { state.tab = 'suppliers'; render(view); }));
  }

  function renderSuppliers(el, view) {
    const ui = NS.ui;
    const db = NS.store.db;
    const canWrite = NS.app.canWrite();
    el.innerHTML = `<section class="card card-flush">
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>RIF</th><th>Razón social</th><th>Actividad</th><th>Contacto</th><th>Tipo ISLR</th><th class="num">Ret. IVA</th><th class="num">Facturas</th><th>Estatus</th><th class="actions-col"></th></tr></thead>
          <tbody>${db.suppliers.map((s) => {
            const invs = db.payables.filter((p) => p.proveedor_rif === s.rif);
            const tariff = db.taxParams.islrTariffs[s.tipo_persona];
            return `<tr>
              <td><strong class="mono">${ui.esc(s.rif)}</strong></td>
              <td><strong>${ui.esc(s.razon_social)}</strong><small class="block muted">${ui.esc(s.direccion)}</small></td>
              <td>${ui.esc(s.actividad || '—')}</td>
              <td><span>${ui.esc(s.telefono)}</span><small class="block muted">${ui.esc(s.correo)}</small></td>
              <td><span class="small">${ui.esc(tariff ? tariff.label : s.tipo_persona)}</span><small class="block muted">Tarifa ${tariff ? tariff.tarifa : '—'}% · ${tariff ? tariff.sustraendoUT : 0} UT</small></td>
              <td class="num"><strong>${s.retencion_iva_pct}%</strong></td>
              <td class="num">${invs.length}<small class="block muted">${ui.usd(invs.reduce((x, p) => x + p.total_usd, 0))}</small></td>
              <td>${ui.badge(s.estatus)}</td>
              <td class="actions-col">
                ${canWrite ? `<button class="icon-btn" data-edit-supplier="${ui.esc(s.rif)}" title="Editar">${ui.icon('edit', 16)}</button>` : ''}
                ${canWrite ? `<button class="icon-btn danger" data-del-supplier="${ui.esc(s.rif)}" title="Eliminar">${ui.icon('trash', 16)}</button>` : ''}
              </td>
            </tr>`;
          }).join('')}</tbody>
        </table>
      </div>
      <div class="card-foot-note">${ui.icon('info', 14)} El RIF es la clave primaria del maestro. La retención de IVA puede ser 75% o 100% según la condición del proveedor. El tipo de persona alimenta el cálculo de ISLR.</div>
    </section>`;
    el.querySelectorAll('[data-edit-supplier]').forEach((b) => b.addEventListener('click', () => openSupplierForm(b.dataset.editSupplier)));
    el.querySelectorAll('[data-del-supplier]').forEach((b) => b.addEventListener('click', () => askDeleteSupplier(b.dataset.delSupplier)));
  }

  function renderSettlements(el, view) {
    const ui = NS.ui;
    const db = NS.store.db;
    const canWrite = NS.app.canWrite();
    const list = db.drivers.slice().sort((a, b) => b.saldo_por_liquidar_usd - a.saldo_por_liquidar_usd);
    const total = list.reduce((s, d) => s + d.saldo_por_liquidar_usd, 0);
    el.innerHTML = `<section class="card card-flush">
      <div class="card-head card-head-pad"><div><h3>Liquidaciones pendientes a conductores</h3><p>Saldo acumulado por comisiones de servicios · pago contra banco</p></div><span class="chip chip-orange">${ui.usd(total)} por liquidar</span></div>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Conductor</th><th>Cédula / RIF</th><th>Vehículo</th><th>Banco / Pago móvil</th><th class="num">Comisión ENVIA</th><th class="num">Saldo por liquidar</th><th>Acción</th></tr></thead>
          <tbody>${list.map((d) => `<tr>
            <td><button class="cell-link cell-user" data-driver-open="${ui.esc(d.cedula_rif)}">${ui.avatar(d.nombres + ' ' + d.apellidos, 32)}<span><strong>${ui.esc(d.nombres + ' ' + d.apellidos)}</strong><small class="block muted">${ui.esc(d.estatus_conductor)}</small></span></button></td>
            <td class="mono">${ui.esc(d.cedula_rif)}</td>
            <td><strong>${ui.esc(d.placa)}</strong><small class="block muted">${ui.esc(d.tipo_servicio)}</small></td>
            <td>${ui.esc(d.banco)}<small class="block muted">${ui.esc(d.telefono_pago_movil)}</small></td>
            <td class="num">${d.porcentaje_comision}%</td>
            <td class="num"><strong class="${d.saldo_por_liquidar_usd > 0 ? 'text-orange' : ''}">${ui.usd(d.saldo_por_liquidar_usd)}</strong><small class="block muted">${ui.bs(ui.toBs(d.saldo_por_liquidar_usd))}</small></td>
            <td>${canWrite && d.saldo_por_liquidar_usd > 0 ? `<button class="btn btn-xs btn-primary" data-settle="${ui.esc(d.cedula_rif)}">${ui.icon('bank', 12)} Liquidar</button>` : '<span class="muted small">Sin saldo</span>'}</td>
          </tr>`).join('')}</tbody>
          <tfoot><tr><td colspan="5">TOTAL POR LIQUIDAR</td><td class="num">${ui.usd(total)}</td><td></td></tr></tfoot>
        </table>
      </div>
    </section>`;
    el.querySelectorAll('[data-settle]').forEach((b) => b.addEventListener('click', () => NS.modules.drivers.openSettle(b.dataset.settle)));
    el.querySelectorAll('[data-driver-open]').forEach((b) => b.addEventListener('click', () => NS.modules.drivers.openDetail(b.dataset.driverOpen)));
  }

  function invoicePreviewHtml(comp, tasa) {
    const ui = NS.ui;
    return `<div class="calc-grid invoice-calc">
      <div><span>IVA</span><strong>${ui.usd(comp.iva_usd)}</strong></div>
      <div><span>IGTF</span><strong>${ui.usd(comp.igtf_usd)}</strong></div>
      <div><span>Retención IVA</span><strong>− ${ui.usd(comp.ret_iva_usd)}</strong></div>
      <div><span>Retención ISLR</span><strong>− ${ui.usd(comp.ret_islr_usd)}</strong></div>
      <div><span>Total factura</span><strong>${ui.usd(comp.total_usd)}</strong></div>
      <div class="calc-total"><span>Neto a pagar</span><strong>${ui.usd(comp.neto_pagar_usd)}</strong><small>${ui.bs(comp.neto_pagar_ves)} · tasa ${ui.num(tasa)}</small></div>
    </div>`;
  }

  function openInvoiceForm() {
    const ui = NS.ui;
    if (!NS.app.canWrite()) return ui.toast('Tu rol es de solo lectura.', 'warning');
    const db = NS.store.db;
    if (!db.suppliers.length) return ui.toast('Primero registra un proveedor.', 'warning');
    const tariffs = db.taxParams.islrTariffs;
    const overlay = ui.modal({
      title: 'Registrar factura de compra',
      eyebrow: 'Cuentas por pagar',
      subtitle: 'Calcula IVA, IGTF, retención de IVA e ISLR automáticamente.',
      size: 'lg',
      body: `<form id="invoice-form" class="form-grid">
        <div class="form-section-title"><span>01</span><div><strong>Proveedor y documento</strong><small>Selecciona el RIF del proveedor para heredar su condición fiscal.</small></div></div>
        <label class="field field-full"><span>Proveedor *</span><select name="proveedor_rif" id="inv-supplier" required>
          <option value="">Selecciona un proveedor...</option>
          ${db.suppliers.map((s) => `<option value="${ui.esc(s.rif)}" data-ret="${s.retencion_iva_pct}" data-tipo="${s.tipo_persona}">${ui.esc(s.rif)} · ${ui.esc(s.razon_social)}</option>`).join('')}
        </select></label>
        <label class="field"><span>N° Factura *</span><input name="numero_factura" placeholder="00012458" required></label>
        <label class="field"><span>N° Control</span><input name="numero_control" placeholder="00-8871"></label>
        <label class="field"><span>Fecha emisión *</span><input name="fecha_emision" type="date" value="${NS.store.today()}" required></label>
        <label class="field"><span>Fecha vencimiento *</span><input name="fecha_vencimiento" type="date" value="${NS.store.iso(-15)}" required></label>
        <label class="field field-full"><span>Concepto *</span><input name="concepto" placeholder="Descripción de la compra o servicio" required></label>

        <div class="form-section-title"><span>02</span><div><strong>Montos y tributos</strong><small>IVA general 16%, IGTF 3% para pagos en divisas. Retención IVA 75% o 100%.</small></div></div>
        <label class="field"><span>Base imponible USD *</span><input name="base_usd" id="inv-base" type="number" min="0" step="0.01" value="0" required></label>
        <label class="field"><span>Monto exento USD</span><input name="exento_usd" id="inv-exento" type="number" min="0" step="0.01" value="0"></label>
        <label class="field"><span>IVA %</span><select name="iva_pct" id="inv-iva"><option value="16">16% general</option><option value="8">8% reducido</option><option value="0">Exento / 0%</option></select></label>
        <label class="field"><span>IGTF %</span><input name="igtf_pct" id="inv-igtf" type="number" min="0" max="3" step="0.01" value="0"></label>
        <label class="field"><span>Retención IVA %</span><select name="ret_iva_pct" id="inv-retiva"><option value="75">75%</option><option value="100">100%</option><option value="0">Sin retención</option></select></label>
        <label class="field"><span>Tipo de persona ISLR</span><select name="tipo_persona" id="inv-tipo">${Object.keys(tariffs).map((k) => `<option value="${k}">${ui.esc(tariffs[k].label)} · ${tariffs[k].tarifa}%</option>`).join('')}</select></label>
        <label class="field"><span>Tasa BCV aplicada</span><input name="tasa_bcv" id="inv-rate" type="number" min="0.01" step="0.01" value="${db.taxParams.bcvRate}"></label>
        <div class="field-full" id="inv-preview"></div>
        <p class="form-note field-full">${ui.icon('shield', 14)} Al guardar se genera la cuenta por pagar, el asiento de compra con IVA crédito fiscal e IGTF, y el comprobante de retención con numeración ${new Date().getFullYear()}MM + 8 dígitos.</p>
      </form>`,
      footer: `<button class="btn btn-ghost" data-cancel>Cancelar</button><button class="btn btn-primary" id="invoice-save">${ui.icon('check', 16)} Registrar factura</button>`
    });

    const form = overlay.querySelector('#invoice-form');
    const preview = () => {
      const comp = NS.store.computePayable({
        base_usd: Number(form.elements.base_usd.value) || 0,
        exento_usd: Number(form.elements.exento_usd.value) || 0,
        iva_pct: Number(form.elements.iva_pct.value),
        igtf_pct: Number(form.elements.igtf_pct.value),
        ret_iva_pct: Number(form.elements.ret_iva_pct.value),
        tipo_persona: form.elements.tipo_persona.value,
        tasa_bcv: Number(form.elements.tasa_bcv.value) || db.taxParams.bcvRate
      });
      overlay.querySelector('#inv-preview').innerHTML = invoicePreviewHtml(comp, Number(form.elements.tasa_bcv.value) || db.taxParams.bcvRate);
    };
    ['base_usd', 'exento_usd', 'iva_pct', 'igtf_pct', 'ret_iva_pct', 'tipo_persona', 'tasa_bcv'].forEach((n) => {
      form.elements[n].addEventListener('input', preview);
      form.elements[n].addEventListener('change', preview);
    });
    form.elements.proveedor_rif.addEventListener('change', () => {
      const opt = form.elements.proveedor_rif.selectedOptions[0];
      if (opt && opt.dataset.ret) form.elements.ret_iva_pct.value = opt.dataset.ret;
      if (opt && opt.dataset.tipo) form.elements.tipo_persona.value = opt.dataset.tipo;
      preview();
    });
    preview();

    overlay.querySelector('[data-cancel]').addEventListener('click', () => ui.closeModal(overlay));
    overlay.querySelector('#invoice-save').addEventListener('click', () => {
      if (!form.reportValidity()) return;
      const data = {};
      Array.from(form.elements).forEach((elm) => { if (elm.name) data[elm.name] = elm.value; });
      data.base_usd = Number(data.base_usd);
      data.exento_usd = Number(data.exento_usd);
      data.iva_pct = Number(data.iva_pct);
      data.igtf_pct = Number(data.igtf_pct);
      data.ret_iva_pct = Number(data.ret_iva_pct);
      data.tasa_bcv = Number(data.tasa_bcv);
      try {
        const res = NS.store.addPayable(data);
        ui.closeModal(overlay);
        ui.toast('Factura registrada. Comprobante de retención ' + (res.voucher ? res.voucher.numero_comprobante : 'sin retención') + '.', 'success');
        NS.app.refresh(true);
        openDetail(res.payable.id);
      } catch (e) { ui.toast(e.message, 'error'); }
    });
  }

  function openSupplierForm(rif) {
    const ui = NS.ui;
    if (!NS.app.canWrite()) return ui.toast('Tu rol es de solo lectura.', 'warning');
    const s = rif ? NS.store.db.suppliers.find((x) => x.rif === rif) : null;
    const d = s || {};
    const tariffs = NS.store.db.taxParams.islrTariffs;
    const overlay = ui.modal({
      title: s ? 'Editar proveedor' : 'Nuevo proveedor',
      eyebrow: 'Maestro de proveedores · PK RIF',
      size: 'md',
      body: `<form id="supplier-form" class="form-grid">
        <label class="field"><span>RIF *</span><input name="rif" value="${ui.esc(d.rif || '')}" placeholder="J-301234567" ${s ? 'disabled' : ''} required></label>
        <label class="field"><span>Estatus</span><select name="estatus"><option ${d.estatus === 'Activo' ? 'selected' : ''}>Activo</option><option ${d.estatus === 'Inactivo' ? 'selected' : ''}>Inactivo</option></select></label>
        <label class="field field-full"><span>Razón social *</span><input name="razon_social" value="${ui.esc(d.razon_social || '')}" placeholder="Repuestos El Rápido C.A." required></label>
        <label class="field"><span>Teléfono *</span><input name="telefono" value="${ui.esc(d.telefono || '')}" placeholder="0212-555-4400" required></label>
        <label class="field"><span>Correo</span><input name="correo" type="email" value="${ui.esc(d.correo || '')}" placeholder="ventas@proveedor.com"></label>
        <label class="field field-full"><span>Dirección fiscal *</span><textarea name="direccion" rows="2" required>${ui.esc(d.direccion || '')}</textarea></label>
        <label class="field"><span>Actividad económica</span><input name="actividad" value="${ui.esc(d.actividad || '')}" placeholder="Repuestos, servicios, publicidad..."></label>
        <label class="field"><span>Retención IVA *</span><select name="retencion_iva_pct"><option value="75" ${d.retencion_iva_pct === 75 ? 'selected' : ''}>75%</option><option value="100" ${d.retencion_iva_pct === 100 ? 'selected' : ''}>100%</option><option value="0" ${d.retencion_iva_pct === 0 ? 'selected' : ''}>Sin retención</option></select></label>
        <label class="field"><span>Tipo de persona ISLR *</span><select name="tipo_persona">${Object.keys(tariffs).map((k) => `<option value="${k}" ${d.tipo_persona === k ? 'selected' : ''}>${ui.esc(tariffs[k].label)} · ${tariffs[k].tarifa}%</option>`).join('')}</select></label>
        <p class="form-note field-full">${ui.icon('info', 14)} El RIF es clave primaria y no puede repetirse. La retención de IVA y la tarifa ISLR se heredan al registrar facturas.</p>
      </form>`,
      footer: `<button class="btn btn-ghost" data-cancel>Cancelar</button><button class="btn btn-primary" id="supplier-save">${ui.icon('check', 15)} Guardar proveedor</button>`
    });
    overlay.querySelector('[data-cancel]').addEventListener('click', () => ui.closeModal(overlay));
    overlay.querySelector('#supplier-save').addEventListener('click', () => {
      const form = overlay.querySelector('#supplier-form');
      if (!form.reportValidity()) return;
      const data = {};
      Array.from(form.elements).forEach((elm) => { if (elm.name) data[elm.name] = elm.value; });
      if (s) data.rif = s.rif;
      const rid = ui.normalizeId(data.rif);
      if (!/^[VEJG]-[0-9]{7,9}$/.test(rid)) return ui.toast('RIF inválido. Usa J-123456789 o V-12345678.', 'error');
      data.rif = rid;
      if (!ui.validEmail(data.correo)) return ui.toast('El correo no es válido.', 'error');
      if (!s && NS.store.db.suppliers.some((x) => x.rif === rid)) return ui.toast('Ya existe un proveedor con ese RIF.', 'error');

      try {
        NS.store.upsertSupplier(data);
        ui.closeModal(overlay);
        ui.toast(s ? 'Proveedor actualizado.' : 'Proveedor registrado.', 'success');
        NS.app.refresh(true);
      } catch (e) { ui.toast(e.message, 'error'); }
    });
  }

  function invoiceBody(p) {
    const ui = NS.ui;
    const sup = NS.store.db.suppliers.find((s) => s.rif === p.proveedor_rif);
    return `<h2>Registro de Factura de Compra</h2>
      <div class="doc-box">
        <div class="grid2">
          <div class="field"><span>Proveedor</span><strong>${ui.esc(sup ? sup.razon_social : p.proveedor_rif)}</strong></div>
          <div class="field"><span>RIF</span><strong>${ui.esc(p.proveedor_rif)}</strong></div>
          <div class="field"><span>Factura N°</span><strong>${ui.esc(p.numero_factura)}</strong></div>
          <div class="field"><span>N° Control</span><strong>${ui.esc(p.numero_control || '—')}</strong></div>
          <div class="field"><span>Fecha emisión</span><strong>${ui.date(p.fecha_emision)}</strong></div>
          <div class="field"><span>Fecha vencimiento</span><strong>${ui.date(p.fecha_vencimiento)}</strong></div>
          <div class="field"><span>Concepto</span><strong>${ui.esc(p.concepto)}</strong></div>
          <div class="field"><span>Comprobante retención</span><strong>${ui.esc(p.comprobante_numero || '—')}</strong></div>
        </div>
      </div>
      <table><thead><tr><th>Concepto</th><th class="num">Base USD</th><th class="num">Base Bs</th></tr></thead>
        <tbody>
          <tr><td>Base imponible</td><td class="num">${ui.usd(p.base_usd)}</td><td class="num">${ui.bs(p.base_ves)}</td></tr>
          ${p.exento_usd ? `<tr><td>Monto exento</td><td class="num">${ui.usd(p.exento_usd)}</td><td class="num">${ui.bs(p.exento_usd * p.tasa_bcv)}</td></tr>` : ''}
          <tr><td>IVA ${p.iva_pct}%</td><td class="num">${ui.usd(p.iva_usd)}</td><td class="num">${ui.bs(p.iva_ves)}</td></tr>
          <tr><td>IGTF ${p.igtf_pct}%</td><td class="num">${ui.usd(p.igtf_usd)}</td><td class="num">${ui.bs(p.igtf_ves)}</td></tr>
          <tr><td>Retención IVA ${p.ret_iva_pct}%</td><td class="num">− ${ui.usd(p.ret_iva_usd)}</td><td class="num">− ${ui.bs(p.ret_iva_ves)}</td></tr>
          <tr><td>Retención ISLR ${p.ret_islr_tarifa}% (sustraendo ${p.ret_islr_sustraendo_ut} UT)</td><td class="num">− ${ui.usd(p.ret_islr_usd)}</td><td class="num">− ${ui.bs(p.ret_islr_ves)}</td></tr>
        </tbody>
        <tfoot>
          <tr><td>Total factura</td><td class="num">${ui.usd(p.total_usd)}</td><td class="num">${ui.bs(p.total_ves)}</td></tr>
          <tr><td>Neto a pagar</td><td class="num">${ui.usd(p.neto_pagar_usd)}</td><td class="num">${ui.bs(p.neto_pagar_ves)}</td></tr>
        </tfoot>
      </table>
      <p style="font-size:9px;color:#5B6B82">Tasa BCV aplicada: ${ui.bs(p.tasa_bcv)} por USD · Estado: ${ui.esc(p.estatus)} · Pagado: ${ui.usd(p.pagado_usd)} · Saldo: ${ui.usd(pendingOf(p))}</p>`;
  }

  function openDetail(id) {
    const ui = NS.ui;
    const db = NS.store.db;
    const p = db.payables.find((x) => x.id === id);
    if (!p) return;
    const sup = db.suppliers.find((s) => s.rif === p.proveedor_rif);
    const voucher = db.withholdings.find((v) => v.factura_id === p.id);
    const overdue = p.fecha_vencimiento < NS.store.today() && pendingOf(p) > 0.01;
    const canWrite = NS.app.canWrite();
    const body = `
      <div class="invoice-hero">
        <div><span class="eyebrow">${ui.esc(p.id)}</span><h3>${ui.esc(sup ? sup.razon_social : p.proveedor_rif)}</h3><p>${ui.esc(p.concepto)}</p>
          <div class="profile-meta"><span class="mono">${ui.esc(p.proveedor_rif)}</span><span>Factura ${ui.esc(p.numero_factura)}</span><span>Control ${ui.esc(p.numero_control || '—')}</span></div>
        </div>
        <div class="invoice-hero-status">${ui.badge(p.estatus)}${overdue ? ui.badge('Vencida', 'danger') : ''}<span class="invoice-amount">${ui.usd(pendingOf(p))}<small>saldo pendiente</small></span></div>
      </div>
      <div class="detail-grid">
        <div class="detail-main">
          <div class="detail-block">
            <h4>Datos del documento</h4>
            <div class="info-grid info-grid-3">
              <div class="info-item"><span>Emisión</span><strong>${ui.dateLong(p.fecha_emision)}</strong></div>
              <div class="info-item"><span>Vencimiento</span><strong class="${overdue ? 'text-danger' : ''}">${ui.dateLong(p.fecha_vencimiento)}</strong></div>
              <div class="info-item"><span>Tasa BCV</span><strong>${ui.bs(p.tasa_bcv)} / USD</strong></div>
              <div class="info-item"><span>Comprobante retención</span><strong class="mono">${ui.esc(p.comprobante_numero || '—')}</strong></div>
              <div class="info-item"><span>Proveedor</span><strong>${ui.esc(sup ? sup.razon_social : '—')}</strong></div>
              <div class="info-item"><span>Dirección fiscal</span><strong>${ui.esc(sup ? sup.direccion : '—')}</strong></div>
            </div>
          </div>
          <div class="detail-block">
            <h4>Desglose fiscal</h4>
            <table class="mini-table">
              <tbody>
                <tr><td>Base imponible</td><td class="num">${ui.usd(p.base_usd)}</td><td class="num muted">${ui.bs(p.base_ves)}</td></tr>
                ${p.exento_usd ? `<tr><td>Exento</td><td class="num">${ui.usd(p.exento_usd)}</td><td class="num muted">${ui.bs(p.exento_usd * p.tasa_bcv)}</td></tr>` : ''}
                <tr><td>IVA ${p.iva_pct}%</td><td class="num">${ui.usd(p.iva_usd)}</td><td class="num muted">${ui.bs(p.iva_ves)}</td></tr>
                <tr><td>IGTF ${p.igtf_pct}%</td><td class="num">${ui.usd(p.igtf_usd)}</td><td class="num muted">${ui.bs(p.igtf_ves)}</td></tr>
                <tr class="total-row"><td>Total factura</td><td class="num">${ui.usd(p.total_usd)}</td><td class="num muted">${ui.bs(p.total_ves)}</td></tr>
                <tr><td>Retención IVA ${p.ret_iva_pct}%</td><td class="num text-danger">− ${ui.usd(p.ret_iva_usd)}</td><td class="num muted">− ${ui.bs(p.ret_iva_ves)}</td></tr>
                <tr><td>Retención ISLR ${p.ret_islr_tarifa}% · sustraendo ${p.ret_islr_sustraendo_ut} UT</td><td class="num text-danger">− ${ui.usd(p.ret_islr_usd)}</td><td class="num muted">− ${ui.bs(p.ret_islr_ves)}</td></tr>
                <tr class="total-row"><td>Neto a pagar</td><td class="num">${ui.usd(p.neto_pagar_usd)}</td><td class="num muted">${ui.bs(p.neto_pagar_ves)}</td></tr>
                <tr><td>Pagado</td><td class="num text-success">${ui.usd(p.pagado_usd)}</td><td class="num muted">${ui.bs(ui.toBs(p.pagado_usd))}</td></tr>
                <tr class="total-row"><td>Saldo pendiente</td><td class="num">${ui.usd(pendingOf(p))}</td><td class="num muted">${ui.bs(ui.toBs(pendingOf(p)))}</td></tr>
              </tbody>
            </table>
          </div>
          <div class="detail-block">
            <h4>Historial de pagos <span class="h4-note">${(p.pagos || []).length} movimientos</span></h4>
            ${(p.pagos || []).length ? `<table class="mini-table"><thead><tr><th>Fecha</th><th>Método</th><th>Referencia</th><th class="num">Monto</th></tr></thead><tbody>${p.pagos.map((x) => `<tr><td>${ui.date(x.fecha)}</td><td>${ui.esc(x.metodo)}</td><td class="mono">${ui.esc(x.referencia || '—')}</td><td class="num">${ui.usd(x.monto_usd)}</td></tr>`).join('')}</tbody></table>` : '<p class="muted small">Sin pagos registrados.</p>'}
          </div>
        </div>
        <aside class="detail-side">
          <div class="settlement-card">
            <span>Saldo pendiente</span>
            <strong>${ui.usd(pendingOf(p))}</strong>
            <small>${ui.bs(ui.toBs(pendingOf(p)))} · ${ui.esc(p.estatus)}</small>
            ${canWrite && pendingOf(p) > 0.01 ? `<button class="btn btn-primary btn-block btn-sm" id="invoice-pay">${ui.icon('bank', 15)} Registrar pago</button>` : ''}
          </div>
          <div class="detail-block">
            <h4>Documentos</h4>
            <div class="stack-actions">
              ${voucher ? `<button class="btn btn-ghost btn-block" id="invoice-voucher">${ui.icon('receipt', 15)} Comprobante de retención</button>` : ''}
              <button class="btn btn-ghost btn-block" id="invoice-print">${ui.icon('print', 15)} Imprimir registro</button>
            </div>
          </div>
          <div class="audit-note">${ui.icon('shield', 14)} Asiento generado automáticamente en el Libro de Compras. Retenciones declaradas con comprobante ${ui.esc(p.comprobante_numero || 'N/A')}.</div>
        </aside>
      </div>`;
    const overlay = ui.modal({ title: 'Factura de compra', eyebrow: p.id, size: 'xl', body, footer: `<button class="btn btn-primary" data-close-modal>Cerrar</button>` });
    overlay.querySelectorAll('[data-close-modal]').forEach((b) => b.addEventListener('click', () => ui.closeModal(overlay)));
    const pay = overlay.querySelector('#invoice-pay');
    if (pay) pay.addEventListener('click', () => { ui.closeModal(overlay); openPayment(p.id); });
    const voucherBtn = overlay.querySelector('#invoice-voucher');
    if (voucherBtn) voucherBtn.addEventListener('click', () => NS.modules.taxes.openVoucher(voucher.id));
    overlay.querySelector('#invoice-print').addEventListener('click', () => {
      ui.printHTML('Factura de Compra', invoiceBody(p), { title: 'Registro de Factura de Compra', subtitle: 'Cuentas por pagar · retenciones', meta: 'Factura ' + p.numero_factura });
    });
  }

  function openPayment(id) {
    const ui = NS.ui;
    if (!NS.app.canWrite()) return ui.toast('Tu rol es de solo lectura.', 'warning');
    const p = NS.store.db.payables.find((x) => x.id === id);
    if (!p) return;
    const pend = pendingOf(p);
    const overlay = ui.modal({
      title: 'Registrar pago',
      eyebrow: 'Factura ' + p.numero_factura,
      subtitle: 'Saldo pendiente ' + ui.usd(pend) + ' · ' + ui.bs(ui.toBs(pend)),
      size: 'sm',
      body: `<form id="payment-form" class="form-grid">
        <label class="field"><span>Monto a pagar (USD) *</span><input name="monto_usd" type="number" min="0.01" max="${pend}" step="0.01" value="${pend}" required></label>
        <label class="field"><span>Fecha</span><input name="fecha" type="date" value="${NS.store.today()}"></label>
        <label class="field field-full"><span>Método</span><select name="metodo"><option>Transferencia</option><option>Pago Móvil</option><option>Zelle</option><option>Efectivo USD</option><option>Cheque</option></select></label>
        <label class="field field-full"><span>Referencia</span><input name="referencia" placeholder="N° de operación / comprobante"></label>
        <p class="form-note">${ui.icon('info', 14)} Genera asiento: <strong>DEBE</strong> cuentas por pagar proveedores · <strong>HABER</strong> banco. Actualiza el estatus a Pagado Parcial o Pagado.</p>
      </form>`,
      footer: `<button class="btn btn-ghost" data-cancel>Cancelar</button><button class="btn btn-primary" id="payment-save">${ui.icon('check', 15)} Registrar pago</button>`
    });
    overlay.querySelector('[data-cancel]').addEventListener('click', () => ui.closeModal(overlay));
    overlay.querySelector('#payment-save').addEventListener('click', () => {
      const form = overlay.querySelector('#payment-form');
      if (!form.reportValidity()) return;
      try {
        NS.store.addPayment(id, {
          monto_usd: Number(form.elements.monto_usd.value),
          fecha: form.elements.fecha.value,
          metodo: form.elements.metodo.value,
          referencia: form.elements.referencia.value
        });
        ui.closeModal(overlay);
        ui.toast('Pago registrado y asiento contable generado.', 'success');
        NS.app.refresh(true);
        openDetail(id);
      } catch (e) { ui.toast(e.message, 'error'); }
    });
  }

  function askDelete(id) {
    const ui = NS.ui;
    const p = NS.store.db.payables.find((x) => x.id === id);
    ui.confirm({
      title: 'Eliminar factura',
      message: `Se eliminará la factura ${p ? p.numero_factura : ''}, su comprobante de retención y los asientos asociados. Solo es posible si no tiene pagos.`,
      confirmText: 'Eliminar', danger: true
    }).then((ok) => {
      if (!ok) return;
      try { NS.store.deletePayable(id); ui.toast('Factura eliminada junto con sus asientos.', 'success'); NS.app.refresh(true); }
      catch (e) { ui.toast(e.message, 'error'); }
    });
  }

  function askDeleteSupplier(rif) {
    const ui = NS.ui;
    ui.confirm({ title: 'Eliminar proveedor', message: 'Solo se pueden eliminar proveedores sin facturas registradas.', confirmText: 'Eliminar', danger: true }).then((ok) => {
      if (!ok) return;
      try { NS.store.deleteSupplier(rif); ui.toast('Proveedor eliminado.', 'success'); NS.app.refresh(true); }
      catch (e) { ui.toast(e.message, 'error'); }
    });
  }

  function exportAll() {
    const ui = NS.ui;
    const db = NS.store.db;
    const rows = [['ID', 'Factura', 'Control', 'Proveedor', 'RIF', 'Emisión', 'Vencimiento', 'Concepto', 'Base USD', 'Exento USD', 'IVA USD', 'IGTF USD', 'Ret IVA USD', 'Ret ISLR USD', 'Total USD', 'Neto USD', 'Pagado USD', 'Saldo USD', 'Comprobante', 'Estatus']];
    db.payables.forEach((p) => {
      const sup = db.suppliers.find((s) => s.rif === p.proveedor_rif);
      rows.push([p.id, p.numero_factura, p.numero_control, sup ? sup.razon_social : '', p.proveedor_rif, p.fecha_emision, p.fecha_vencimiento, p.concepto, p.base_usd, p.exento_usd, p.iva_usd, p.igtf_usd, p.ret_iva_usd, p.ret_islr_usd, p.total_usd, p.neto_pagar_usd, p.pagado_usd, pendingOf(p), p.comprobante_numero, p.estatus]);
    });
    ui.downloadFile('ENVIA_cuentas_por_pagar_' + NS.store.today() + '.csv', ui.csv(rows));
    ui.toast('Cuentas por pagar exportadas a CSV.', 'success');
  }

  NS.modules.payables = { render, openInvoiceForm, openDetail, openSupplierForm, openPayment };
})();
