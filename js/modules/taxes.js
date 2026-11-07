/* =========================================================================
   ENVIA ERP · modules/taxes.js
   Parámetros tributarios (IVA, IGTF, UT, BCV), tarifas ISLR Decreto 1.808,
   calculadora y comprobantes de retención imprimibles.
   ========================================================================= */
(function () {
  'use strict';
  const NS = (window.ENVIA = window.ENVIA || {});
  NS.modules = NS.modules || {};

  function render(view) {
    const ui = NS.ui;
    const db = NS.store.db;
    const p = db.taxParams;
    const canWrite = NS.app.canAction('taxes', 'editar');
    const vouchers = db.withholdings.slice().sort((a, b) => b.numero_comprobante.localeCompare(a.numero_comprobante));
    const totals = vouchers.reduce((s, v) => ({ iva: s.iva + v.ret_iva_ves, islr: s.islr + v.ret_islr_ves, total: s.total + v.total_retenido_ves }), { iva: 0, islr: 0, total: 0 });
    const salesIva = db.services.reduce((s, x) => s + x.iva_usd, 0);
    const purchaseIva = db.payables.reduce((s, x) => s + x.iva_usd, 0);
    const igtfGenerated = db.services.reduce((s, x) => s + x.igtf_usd, 0);

    view.innerHTML = `
      <div class="page-head">
        <div>
          <span class="eyebrow">Tributos · SENIAT / Decreto 1.808</span>
          <h2 class="page-title">Parámetros fiscales y retenciones</h2>
          <p class="page-sub">Tasa BCV, IVA, IGTF, unidad tributaria y tarifas de ISLR parametrizables. Comprobantes con formato ${new Date().getFullYear()}MM + 8 dígitos.</p>
        </div>
        <div class="page-actions">
          ${NS.reports.button('taxes')}
          ${canWrite ? `<button class="btn btn-ghost" id="taxes-rate-refresh" title="Consultar la tasa oficial en DolarAPI">${ui.icon('refresh', 16)} Sincronizar BCV</button>` : ''}
          <button class="btn btn-ghost" id="taxes-export">${ui.icon('download', 16)} Exportar retenciones</button>
          <span class="chip chip-orange">${ui.icon('percent', 14)} IVA ${p.ivaGeneral}% / ${p.ivaReducido}%</span>
        </div>
      </div>

      <div class="stat-strip">
        <div class="stat-strip-item"><span>Tasa BCV vigente</span><strong>${ui.bs(p.bcvRate)}</strong><small>${ui.date(p.bcvUpdatedAt)} · 1 USD · ${ui.esc((NS.exchangeRate && NS.exchangeRate.getMeta().fuente) || 'local')}</small></div>
        <div class="stat-strip-item"><span>Unidad Tributaria</span><strong>${ui.bs(p.ut)}</strong><small>Base para sustraendo ISLR</small></div>
        <div class="stat-strip-item"><span>IVA ventas del período</span><strong>${ui.usd(salesIva)}</strong><small>IVA crédito compras ${ui.usd(purchaseIva)}</small></div>
        <div class="stat-strip-item"><span>Retenciones emitidas</span><strong>${ui.bs(totals.total)}</strong><small>IVA ${ui.bs(totals.iva)} · ISLR ${ui.bs(totals.islr)}</small></div>
      </div>

      <div class="dash-grid">
        <section class="card">
          <div class="card-head"><div><h3>Parámetros tributarios</h3><p>Se aplican a todos los cálculos del ERP</p></div></div>
          <form id="tax-form" class="form-grid form-grid-tight">
            <label class="field"><span>Tasa BCV (Bs / USD) · solo lectura</span><input name="bcvRate" type="number" min="0.01" step="0.01" value="${p.bcvRate}" readonly disabled></label>
            <label class="field"><span>Unidad Tributaria (Bs) *</span><input name="ut" type="number" min="0.01" step="0.01" value="${p.ut}" ${canWrite ? '' : 'disabled'}></label>
            <label class="field"><span>IVA general (%)</span><input name="ivaGeneral" type="number" min="0" max="100" step="0.5" value="${p.ivaGeneral}" ${canWrite ? '' : 'disabled'}></label>
            <label class="field"><span>IVA reducido (%)</span><input name="ivaReducido" type="number" min="0" max="100" step="0.5" value="${p.ivaReducido}" ${canWrite ? '' : 'disabled'}></label>
            <label class="field"><span>IGTF (%)</span><input name="igtf" type="number" min="0" max="100" step="0.5" value="${p.igtf}" ${canWrite ? '' : 'disabled'}></label>
            <label class="field"><span>Fecha de actualización</span><input value="${ui.date(p.bcvUpdatedAt)}" disabled></label>
            ${canWrite ? `<div class="field-full form-actions"><button type="button" class="btn btn-primary" id="tax-save">${ui.icon('check', 15)} Guardar parámetros</button><span class="hint">Al guardar se recalculan los montos de todo el ERP en tiempo real.</span></div>` : `<p class="form-note field-full">${ui.icon('eye', 14)} Modo auditoría: parámetros de solo lectura.</p>`}
          </form>
        </section>

        <section class="card">
          <div class="card-head"><div><h3>Resumen fiscal</h3><p>Posición de IVA e IGTF</p></div></div>
          <div class="fiscal-summary">
            <div class="fiscal-row"><span>IVA débito fiscal (ventas)</span><strong>${ui.usd(salesIva)}</strong></div>
            <div class="fiscal-row"><span>IVA crédito fiscal (compras)</span><strong>${ui.usd(purchaseIva)}</strong></div>
            <div class="fiscal-row fiscal-total ${salesIva - purchaseIva >= 0 ? '' : 'credit'}"><span>${salesIva - purchaseIva >= 0 ? 'IVA por pagar' : 'Saldo a favor'}</span><strong>${ui.usd(Math.abs(salesIva - purchaseIva))}</strong></div>
            <div class="fiscal-row"><span>IGTF generado en ventas</span><strong>${ui.usd(igtfGenerated)}</strong></div>
            <div class="fiscal-row"><span>IGTF pagado en compras</span><strong>${ui.usd(db.payables.reduce((s, x) => s + x.igtf_usd, 0))}</strong></div>
            <div class="fiscal-row"><span>Retenciones ISLR practicadas</span><strong>${ui.bs(totals.islr)}</strong></div>
            <div class="fiscal-row"><span>Retenciones IVA practicadas</span><strong>${ui.bs(totals.iva)}</strong></div>
          </div>
          <p class="form-note">${ui.icon('info', 14)} El IVA del 16% es general; 8% reducido y exento según la actividad. IGTF 3% sobre pagos en divisas o criptoactivos.</p>
        </section>
      </div>

      <div class="dash-grid">
        <section class="card">
          <div class="card-head"><div><h3>Tarifas ISLR · Decreto 1.808</h3><p>Retención = (Base × tarifa%) − (sustraendo × UT)</p></div></div>
          <div class="table-wrap">
            <table class="data-table islr-table">
              <thead><tr><th>Tipo de persona</th><th class="num">Tarifa</th><th class="num">Sustraendo (UT)</th><th class="num">Sustraendo (Bs)</th><th></th></tr></thead>
              <tbody>${Object.keys(p.islrTariffs).map((k) => {
                const t = p.islrTariffs[k];
                return `<tr>
                  <td><strong>${ui.esc(t.label)}</strong><small class="block mono">${ui.esc(k)}</small></td>
                  <td class="num"><input class="inline-number islr-tarifa" data-key="${k}" type="number" min="0" max="100" step="0.1" value="${t.tarifa}" ${canWrite ? '' : 'disabled'}></td>
                  <td class="num"><input class="inline-number islr-sustraendo" data-key="${k}" type="number" min="0" step="0.1" value="${t.sustraendoUT}" ${canWrite ? '' : 'disabled'}></td>
                  <td class="num">${ui.bs(t.sustraendoUT * p.ut)}</td>
                  <td>${canWrite ? `<button class="icon-btn" data-save-tariff="${k}" title="Guardar tarifa">${ui.icon('check', 15)}</button>` : ''}</td>
                </tr>`;
              }).join('')}</tbody>
            </table>
          </div>
          <p class="form-note">${ui.icon('shield', 14)} El sustraendo se resta del resultado de aplicar la tarifa sobre la base imponible expresada en bolívares. Edita la tarifa y la UT para ajustar la normativa vigente.</p>
        </section>

        <section class="card">
          <div class="card-head"><div><h3>Calculadora de retención ISLR</h3><p>Simulación inmediata para una factura</p></div></div>
          <form id="islr-calc" class="form-grid form-grid-tight">
            <label class="field"><span>Base imponible (USD)</span><input name="base" type="number" min="0" step="0.01" value="1000"></label>
            <label class="field"><span>Tipo de persona</span><select name="tipo">${Object.keys(p.islrTariffs).map((k) => `<option value="${k}">${ui.esc(p.islrTariffs[k].label)}</option>`).join('')}</select></label>
            <div class="calc-result field-full" id="islr-result"></div>
          </form>
        </section>
      </div>

      <section class="card card-flush">
        <div class="card-head card-head-pad">
          <div><h3>Comprobantes de retención</h3><p>Numeración AAAAMM + 8 dígitos · listos para imprimir</p></div>
          <span class="chip chip-navy">${vouchers.length} comprobantes</span>
        </div>
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th>N° Comprobante</th><th>Período</th><th>Proveedor</th><th>Factura</th><th>Tipo</th><th class="num">Base (Bs)</th><th class="num">Ret. IVA</th><th class="num">Ret. ISLR</th><th class="num">Total retenido</th><th>Estado</th><th class="actions-col"></th></tr></thead>
            <tbody>${vouchers.length ? vouchers.map((v) => `<tr>
              <td><strong class="mono">${ui.esc(v.numero_comprobante)}</strong><small class="block muted">${ui.date(v.fecha)}</small></td>
              <td>${ui.monthLabel(v.periodo.slice(0, 4) + '-' + v.periodo.slice(4, 6))}</td>
              <td><strong>${ui.esc(v.proveedor_nombre)}</strong><small class="block mono">${ui.esc(v.proveedor_rif)}</small></td>
              <td class="mono">${ui.esc(v.factura_numero)}</td>
              <td>${ui.badge(v.tipo, 'purple')}</td>
              <td class="num">${ui.bs(v.base_ves)}</td>
              <td class="num">${ui.bs(v.ret_iva_ves)}<small class="block muted">${v.ret_iva_pct}%</small></td>
              <td class="num">${ui.bs(v.ret_islr_ves)}<small class="block muted">${v.ret_islr_tarifa}% − ${v.ret_islr_sustraendo_ut} UT</small></td>
              <td class="num"><strong>${ui.bs(v.total_retenido_ves)}</strong></td>
              <td>${ui.badge(v.estado)}</td>
              <td class="actions-col"><button class="icon-btn" data-voucher="${ui.esc(v.id)}" title="Ver / imprimir">${ui.icon('eye', 16)}</button></td>
            </tr>`).join('') : `<tr><td colspan="11">${ui.empty('receipt', 'Sin comprobantes', 'Registra una factura de compra con retención para generarlos.')}</td></tr>`}</tbody>
            <tfoot><tr><td colspan="5">TOTALES</td><td class="num"></td><td class="num">${ui.bs(totals.iva)}</td><td class="num">${ui.bs(totals.islr)}</td><td class="num">${ui.bs(totals.total)}</td><td colspan="2"></td></tr></tfoot>
          </table>
        </div>
      </section>
    `;

    if (canWrite) {
      const syncBtn = $('#taxes-rate-refresh');
      if (syncBtn) syncBtn.addEventListener('click', async () => {
        ui.setBusy(syncBtn, true, 'Consultando...');
        const res = NS.exchangeRate
          ? await NS.exchangeRate.fetchBcvRate({ force: true })
          : { ok: false };
        ui.setBusy(syncBtn, false);
        if (res.ok) {
          ui.toast(`Tasa BCV actualizada desde ${res.fuente}: ${ui.bs(res.rate)} / USD.`, 'success');
          NS.app.refresh(true);
        } else {
          ui.toast('Error al obtener tasa automática. Por favor, introduzca la tasa BCV del día manualmente.', 'error');
          const input = $('#tax-form').elements.bcvRate;
          if (input) { input.focus(); input.select(); }
        }
      });
      $('#tax-save').addEventListener('click', () => {
        const form = $('#tax-form');
        if (!form.reportValidity()) return;
        try {
          // La tasa BCV es de solo lectura: solo se actualiza desde DolarVZLA o por fecha.
          NS.store.updateTaxParams({
            ut: Number(form.elements.ut.value),
            ivaGeneral: Number(form.elements.ivaGeneral.value),
            ivaReducido: Number(form.elements.ivaReducido.value),
            igtf: Number(form.elements.igtf.value)
          });
          NS.ui.toast('Parámetros tributarios actualizados. Montos recalculados.', 'success');
          NS.app.refresh(true);
        } catch (e) { ui.toast(e.message, 'error'); }
      });
      view.querySelectorAll('[data-save-tariff]').forEach((b) => b.addEventListener('click', () => {
        const key = b.dataset.saveTariff;
        const tarifa = Number(view.querySelector(`.islr-tarifa[data-key="${key}"]`).value);
        const sustraendoUT = Number(view.querySelector(`.islr-sustraendo[data-key="${key}"]`).value);
        const tariffs = JSON.parse(JSON.stringify(db.taxParams.islrTariffs));
        tariffs[key].tarifa = tarifa;
        tariffs[key].sustraendoUT = sustraendoUT;
        NS.store.updateTaxParams({ islrTariffs: tariffs });
        ui.toast('Tarifa ISLR actualizada.', 'success');
        NS.app.refresh(true);
      }));
    }

    const calc = () => {
      const form = $('#islr-calc');
      const base = Number(form.elements.base.value) || 0;
      const tipo = form.elements.tipo.value;
      const t = p.islrTariffs[tipo];
      const liveRate = ui.rate() || p.bcvRate;
      const baseVes = ui.toBs(base);
      const sustraendo = t.sustraendoUT * p.ut;
      const ret = Math.max(0, baseVes * t.tarifa / 100 - sustraendo);
      $('#islr-result').innerHTML = `
        <div class="calc-grid">
          <div><span>Base en Bs</span><strong>${ui.bs(baseVes)}</strong></div>
          <div><span>Tarifa aplicada</span><strong>${t.tarifa}%</strong></div>
          <div><span>Sustraendo (${t.sustraendoUT} UT)</span><strong>${ui.bs(sustraendo)}</strong></div>
          <div class="calc-total"><span>Retención ISLR</span><strong>${ui.bs(ret)}</strong><small>${ui.usd(ret / liveRate)} · equivalente USD</small></div>
        </div>`;
    };
    $('#islr-calc').elements.base.addEventListener('input', calc);
    $('#islr-calc').elements.tipo.addEventListener('change', calc);
    calc();

    view.querySelectorAll('[data-voucher]').forEach((b) => b.addEventListener('click', () => openVoucher(b.dataset.voucher)));
    $('#taxes-export').addEventListener('click', () => {
      const rows = [['N° Comprobante', 'Período', 'Proveedor', 'RIF', 'Factura', 'Tipo', 'Base Bs', 'IVA Bs', 'Ret IVA Bs', 'Ret ISLR Bs', 'Total retenido Bs', 'Estado']];
      vouchers.forEach((v) => rows.push([v.numero_comprobante, v.periodo, v.proveedor_nombre, v.proveedor_rif, v.factura_numero, v.tipo, v.base_ves, v.iva_ves, v.ret_iva_ves, v.ret_islr_ves, v.total_retenido_ves, v.estado]));
      ui.downloadFile('ENVIA_retenciones_' + NS.store.today() + '.csv', ui.csv(rows));
      ui.toast('Comprobantes exportados a CSV.', 'success');
    });
  }

  function voucherBody(v) {
    const ui = NS.ui;
    return `
      <div class="voucher-doc">
        <div class="voucher-top">
          <div><span class="voucher-kicker">COMPROBANTE DE RETENCIÓN</span><h2>${ui.esc(v.tipo)}</h2><p>Decreto 1.808 · Ley de IVA · SENIAT</p></div>
          <div class="voucher-number"><span>N°</span><strong>${ui.esc(v.numero_comprobante)}</strong><small>Período ${ui.monthLabel(v.periodo.slice(0, 4) + '-' + v.periodo.slice(4, 6))}</small></div>
        </div>
        <div class="voucher-grid">
          <div class="field"><span>Agente de retención</span><strong>ENVIA C.A. · RIF J-41000000-0</strong></div>
          <div class="field"><span>Fecha de emisión</span><strong>${ui.dateLong(v.fecha)}</strong></div>
          <div class="field"><span>Proveedor / beneficiario</span><strong>${ui.esc(v.proveedor_nombre)}</strong></div>
          <div class="field"><span>RIF</span><strong>${ui.esc(v.proveedor_rif)}</strong></div>
          <div class="field field-full"><span>Dirección fiscal</span><strong>${ui.esc(v.proveedor_direccion || '—')}</strong></div>
          <div class="field"><span>Factura N°</span><strong>${ui.esc(v.factura_numero)}</strong></div>
          <div class="field"><span>N° Control</span><strong>${ui.esc(v.factura_control || '—')}</strong></div>
          <div class="field field-full"><span>Concepto</span><strong>${ui.esc(v.concepto)}</strong></div>
        </div>
        <table class="mini-table voucher-table">
          <thead><tr><th>Descripción</th><th class="num">Base imponible</th><th class="num">%</th><th class="num">Retención</th></tr></thead>
          <tbody>
            ${v.ret_iva_ves ? `<tr><td>IVA · Retención ${v.ret_iva_pct}% del impuesto</td><td class="num">${ui.bs(v.base_ves)}</td><td class="num">${v.ret_iva_pct}%</td><td class="num">${ui.bs(v.ret_iva_ves)}</td></tr>` : ''}
            ${v.ret_islr_ves ? `<tr><td>ISLR · Tarifa ${v.ret_islr_tarifa}% con sustraendo de ${v.ret_islr_sustraendo_ut} UT</td><td class="num">${ui.bs(v.base_ves)}</td><td class="num">${v.ret_islr_tarifa}%</td><td class="num">${ui.bs(v.ret_islr_ves)}</td></tr>` : ''}
          </tbody>
          <tfoot><tr><td colspan="3">TOTAL RETENIDO</td><td class="num">${ui.bs(v.total_retenido_ves)}</td></tr></tfoot>
        </table>
        <div class="voucher-legal">
          <p>El presente comprobante se emite conforme al Reglamento Parcial de la Ley de ISLR en materia de retenciones (Decreto 1.808) y a la normativa de retención de IVA vigente. El agente de retención declara haber practicado la retención indicada sobre el pago efectuado al beneficiario.</p>
          <div class="voucher-signs"><div>ENVIA C.A.<br><span>Agente de retención</span></div><div>${ui.esc(v.proveedor_nombre)}<br><span>Beneficiario</span></div></div>
        </div>
      </div>`;
  }

  function openVoucher(id) {
    const ui = NS.ui;
    const v = NS.store.db.withholdings.find((x) => x.id === id);
    if (!v) return;
    const overlay = ui.modal({
      title: 'Comprobante de retención',
      eyebrow: v.numero_comprobante,
      size: 'lg',
      body: voucherBody(v),
      footer: `<button class="btn btn-ghost" id="voucher-print">${ui.icon('print', 15)} Imprimir comprobante</button><button class="btn btn-primary" data-close-modal>Cerrar</button>`
    });
    overlay.querySelector('#voucher-print').addEventListener('click', () => printVoucher(v.id));
  }

  function printVoucher(id) {
    const ui = NS.ui;
    const v = NS.store.db.withholdings.find((x) => x.id === id);
    if (!v) return;
    ui.printHTML('Comprobante de Retención', voucherBody(v), { title: 'Comprobante de Retención', subtitle: 'IVA / ISLR · Decreto 1.808', meta: 'N° ' + v.numero_comprobante + '<br>' + ui.date(v.fecha) });
  }

  NS.modules.taxes = { render, openVoucher, printVoucher };
})();
