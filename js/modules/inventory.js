/* =========================================================================
   ENVIA ERP · modules/inventory.js
   Tienda del conductor: catálogo de uniformes y equipamiento, control de
   inventario y financiamiento de compras contra la cartera del conductor.
   Genera cuenta por cobrar (1.1.2.02) e ingreso/costo por la venta.
   ========================================================================= */
(function () {
  'use strict';
  const NS = (window.ENVIA = window.ENVIA || {});
  NS.modules = NS.modules || {};

  const $ = (s, r) => NS.ui.$(s, r);
  let filters = { q: '', low: false };

  function productRow(p, canEdit, canDelete, canAssign) {
    const ui = NS.ui;
    const low = p.stock <= p.stock_min;
    const margin = p.precio_usd > 0 ? ((p.precio_usd - p.costo_usd) / p.precio_usd) * 100 : 0;
    return `<tr>
      <td><div class="cell-user">${ui.avatar(p.nombre, 30)}
        <span><strong>${ui.esc(p.nombre)}</strong><small class="block muted">${ui.esc(p.descripcion || p.categoria)}</small></span></div></td>
      <td><span class="mono strong">${ui.esc(p.sku)}</span></td>
      <td>${ui.badge(p.categoria, 'info')}</td>
      <td class="num"><strong>${ui.usd(p.precio_usd)}</strong><small class="block muted">costo ${ui.usd(p.costo_usd)}</small></td>
      <td class="num">${ui.pct(margin)}</td>
      <td class="num"><strong class="${low ? 'text-orange' : ''}">${ui.num(p.stock, 0)}</strong><small class="block muted">mín. ${ui.num(p.stock_min, 0)}</small></td>
      <td>${low ? ui.badge('Stock bajo', 'warning') : ui.badge('Disponible', 'success')}</td>
      <td>${p.activo ? ui.badge('Activo') : ui.badge('Inactivo')}</td>
      <td class="actions-col">
        ${canAssign ? `<button class="icon-btn" data-assign="${ui.esc(p.sku)}" title="Asignar a conductor">${ui.icon('user', 16)}</button>` : ''}
        ${canEdit ? `<button class="icon-btn" data-stock="${ui.esc(p.sku)}" title="Ajustar stock">${ui.icon('refresh', 16)}</button>` : ''}
        ${canEdit ? `<button class="icon-btn" data-edit-product="${ui.esc(p.sku)}" title="Editar producto">${ui.icon('edit', 16)}</button>` : ''}
        ${canDelete ? `<button class="icon-btn danger" data-del-product="${ui.esc(p.sku)}" title="Eliminar producto">${ui.icon('trash', 16)}</button>` : ''}
      </td>
    </tr>`;
  }

  function render(view) {
    const ui = NS.ui;
    const db = NS.store.db;
    const canCreate = NS.app.canAction('inventory', 'crear');
    const canEdit = NS.app.canAction('inventory', 'editar');
    const canDelete = NS.app.canAction('inventory', 'eliminar');
    const canAssign = NS.app.canAction('inventory', 'asignar');
    const canPay = NS.app.canAction('inventory', 'cobrar');
    const canExport = NS.app.canAction('inventory', 'exportar');
    const q = filters.q.toLowerCase();
    const products = db.products.filter((p) => {
      const hay = [p.sku, p.nombre, p.categoria, p.descripcion].join(' ').toLowerCase();
      return (!q || hay.includes(q)) && (!filters.low || p.stock <= p.stock_min);
    });
    const charges = db.driverCharges.slice().sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
    const stockTotal = db.products.reduce((s, p) => s + Number(p.stock || 0), 0);
    const valor = db.products.reduce((s, p) => s + Number(p.stock || 0) * Number(p.costo_usd || 0), 0);
    const financiado = db.driverCharges.filter((c) => c.saldo_usd > 0).reduce((s, c) => s + Number(c.saldo_usd || 0), 0);
    const lowCount = db.products.filter((p) => p.activo && p.stock <= p.stock_min).length;

    view.innerHTML = `
      <div class="page-head">
        <div>
          <span class="eyebrow">Tienda del conductor · uniformes y equipamiento</span>
          <h2 class="page-title">Tienda &amp; Inventario</h2>
          <p class="page-sub">Catálogo con ${db.products.length} productos · ${stockTotal} unidades en stock · ${ui.usd(financiado)} financiados a conductores.</p>
        </div>
        <div class="page-actions">
          ${NS.reports.button('inventory')}
          ${canExport ? `<button class="btn btn-ghost" id="inventory-export">${ui.icon('download', 16)} Exportar CSV</button>` : ''}
          ${canAssign ? `<button class="btn btn-ghost" id="inventory-assign">${ui.icon('user', 16)} Asignar producto</button>` : ''}
          ${canCreate ? `<button class="btn btn-primary" id="inventory-new">${ui.icon('plus', 16)} Nuevo producto</button>` : ''}
        </div>
      </div>

      <div class="stat-strip">
        <div class="stat-strip-item"><span>Valor del inventario</span><strong>${ui.usd(valor)}</strong><small>${ui.bs(ui.toBs(valor))} al costo</small></div>
        <div class="stat-strip-item"><span>Unidades disponibles</span><strong>${ui.num(stockTotal, 0)}</strong><small>${db.products.filter((p) => p.activo).length} SKU activos</small></div>
        <div class="stat-strip-item"><span>Saldo financiado</span><strong>${ui.usd(financiado)}</strong><small>${db.driverCharges.filter((c) => c.saldo_usd > 0).length} financiamientos vigentes</small></div>
        <div class="stat-strip-item"><span>Alertas de stock</span><strong>${ui.num(lowCount, 0)}</strong><small>${lowCount ? 'productos en o bajo el mínimo' : 'inventario saludable'}</small></div>
      </div>

      <section class="card card-flush">
        <div class="toolbar">
          <div class="search-box">${ui.icon('search', 17)}<input id="inventory-search" type="search" placeholder="Buscar por SKU, producto o categoría..." value="${ui.esc(filters.q)}"></div>
          <div class="toolbar-right">
            <label class="check-inline"><input type="checkbox" id="inventory-low" ${filters.low ? 'checked' : ''}> Solo stock bajo</label>
            <span class="count-chip">${products.length} producto${products.length === 1 ? '' : 's'}</span>
          </div>
        </div>
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th>Producto</th><th>SKU</th><th>Categoría</th><th class="num">Precio</th><th class="num">Margen</th><th class="num">Stock</th><th>Estado</th><th>Activo</th><th class="actions-col">Acciones</th></tr></thead>
            <tbody>
              ${products.length ? products.map((p) => productRow(p, canEdit, canDelete, canAssign)).join('') : `<tr><td colspan="9">${ui.empty('package', 'Sin productos', 'Crea el primer producto del catálogo del conductor.', canCreate ? '<button class="btn btn-primary" id="inventory-empty-new">Nuevo producto</button>' : '')}</td></tr>`}
            </tbody>
          </table>
        </div>
      </section>

      <section class="card card-flush" style="margin-top:18px">
        <div class="card-head">
          <div>
            <h3>Financiamientos a conductores</h3>
            <p class="muted small">Compras de la tienda descontadas contra la cartera del conductor según el número de cuotas elegido.</p>
          </div>
          <span class="count-chip">${charges.length} registros</span>
        </div>
        <div class="table-wrap">
          <table class="data-table data-table-compact">
            <thead><tr><th>Conductor</th><th>Producto</th><th class="num">Total</th><th class="num">Pagado</th><th class="num">Saldo</th><th class="num">Cuotas</th><th>Fecha</th><th>Estatus</th><th class="actions-col">Acciones</th></tr></thead>
            <tbody>
              ${charges.length ? charges.map((c) => {
                const d = db.drivers.find((x) => x.cedula_rif === c.conductor_cedula_rif);
                return `<tr>
                  <td><strong>${ui.esc(d ? d.nombres + ' ' + d.apellidos : c.conductor_cedula_rif)}</strong><small class="block muted mono">${ui.esc(c.conductor_cedula_rif)}</small></td>
                  <td>${ui.esc(c.producto_nombre)}<small class="block muted">x${c.cantidad} · ${ui.usd(c.precio_unit_usd)} c/u</small></td>
                  <td class="num"><strong>${ui.usd(c.total_usd)}</strong></td>
                  <td class="num">${ui.usd(c.pagado_usd)}</td>
                  <td class="num"><strong class="${c.saldo_usd > 0 ? 'text-orange' : ''}">${ui.usd(c.saldo_usd)}</strong></td>
                  <td class="num">${ui.num(c.cuotas, 0)}<small class="block muted">${ui.usd(c.cuota_usd)} / cuota</small></td>
                  <td>${ui.date(c.fecha)}</td>
                  <td>${ui.badge(c.estatus, c.estatus === 'Pagado' ? 'success' : 'warning')}</td>
                  <td class="actions-col">${canPay && c.saldo_usd > 0 ? `<button class="btn btn-ghost btn-xs" data-pay-charge="${ui.esc(c.id)}">Abonar</button>` : ''}</td>
                </tr>`;
              }).join('') : `<tr><td colspan="9">${ui.empty('wallet', 'Sin financiamientos', 'Asigna un producto a un conductor para generar su plan de cuotas.')}</td></tr>`}
            </tbody>
          </table>
        </div>
      </section>
      <p class="form-note" style="margin-top:14px">${ui.icon('info', 14)} Cada asignación descuenta stock, crea una cuenta por cobrar al conductor (1.1.2.02) y registra el ingreso por tienda (4.2.1.03) y su costo (5.2.2.01).</p>
    `;

    const rerender = () => {
      filters.q = $('#inventory-search').value;
      filters.low = $('#inventory-low').checked;
      render(view);
      const input = $('#inventory-search');
      if (input) { input.focus(); input.setSelectionRange(input.value.length, input.value.length); }
    };
    let t;
    $('#inventory-search').addEventListener('input', () => { clearTimeout(t); t = setTimeout(rerender, 180); });
    $('#inventory-low').addEventListener('change', rerender);
    const newBtn = $('#inventory-new');
    if (newBtn) newBtn.addEventListener('click', () => openProductForm());
    const emptyNew = $('#inventory-empty-new');
    if (emptyNew) emptyNew.addEventListener('click', () => openProductForm());
    const assignBtn = $('#inventory-assign');
    if (assignBtn) assignBtn.addEventListener('click', () => openAssign());
    const exportBtn = $('#inventory-export');
    if (exportBtn) exportBtn.addEventListener('click', exportCsv);
    view.querySelectorAll('[data-edit-product]').forEach((b) => b.addEventListener('click', () => openProductForm(b.dataset.editProduct)));
    view.querySelectorAll('[data-del-product]').forEach((b) => b.addEventListener('click', () => askDelete(b.dataset.delProduct)));
    view.querySelectorAll('[data-stock]').forEach((b) => b.addEventListener('click', () => openStock(b.dataset.stock)));
    view.querySelectorAll('[data-assign]').forEach((b) => b.addEventListener('click', () => openAssign(b.dataset.assign)));
    view.querySelectorAll('[data-pay-charge]').forEach((b) => b.addEventListener('click', () => openChargePayment(b.dataset.payCharge)));
  }

  function openProductForm(sku) {
    const ui = NS.ui;
    if (!NS.app.canAction('inventory', sku ? 'editar' : 'crear')) return ui.toast('No tienes permiso para gestionar productos.', 'warning');
    const p = sku ? NS.store.db.products.find((x) => x.sku === sku) : null;
    const data = p || {};
    const overlay = ui.modal({
      title: p ? 'Editar producto' : 'Nuevo producto',
      eyebrow: 'Tienda del conductor',
      subtitle: p ? data.nombre : 'Define precio, costo y stock inicial del artículo.',
      size: 'lg',
      body: `<form id="product-form" class="form-grid" autocomplete="off">
        <label class="field"><span>SKU *</span><input name="sku" value="${ui.esc(data.sku || '')}" placeholder="BOL-DEL-001" ${p ? 'disabled' : ''} required></label>
        <label class="field"><span>Categoría *</span><select name="categoria">${NS.store.PRODUCT_CATEGORIES.map((c) => `<option ${data.categoria === c ? 'selected' : ''}>${c}</option>`).join('')}</select></label>
        <label class="field field-full"><span>Nombre del producto *</span><input name="nombre" value="${ui.esc(data.nombre || '')}" placeholder="Bolso Delivery" required></label>
        <label class="field"><span>Precio de venta (USD) *</span><input name="precio_usd" type="number" min="0.01" step="0.01" value="${data.precio_usd ?? ''}" required></label>
        <label class="field"><span>Costo (USD) *</span><input name="costo_usd" type="number" min="0" step="0.01" value="${data.costo_usd ?? ''}" required></label>
        <label class="field"><span>Stock actual *</span><input name="stock" type="number" min="0" step="1" value="${data.stock ?? 0}" required></label>
        <label class="field"><span>Stock mínimo *</span><input name="stock_min" type="number" min="0" step="1" value="${data.stock_min ?? 0}" required></label>
        <label class="field field-full"><span>Descripción</span><textarea name="descripcion" rows="2" placeholder="Características del artículo...">${ui.esc(data.descripcion || '')}</textarea></label>
        <label class="check-inline field-full"><input type="checkbox" name="activo" ${data.activo !== false ? 'checked' : ''}> Producto activo para asignación</label>
      </form>`,
      footer: `<button class="btn btn-ghost" data-cancel>Cancelar</button><button class="btn btn-primary" id="product-save">${ui.icon('check', 16)} ${p ? 'Guardar cambios' : 'Crear producto'}</button>`
    });
    overlay.querySelector('[data-cancel]').addEventListener('click', () => ui.closeModal(overlay));
    overlay.querySelector('#product-save').addEventListener('click', () => {
      const form = overlay.querySelector('#product-form');
      if (!form.reportValidity()) return;
      const payload = {};
      Array.from(form.elements).forEach((el) => { if (el.name) payload[el.name] = el.type === 'checkbox' ? el.checked : el.value; });
      if (p) payload.sku = p.sku;
      try {
        NS.store.upsertProduct(payload);
        ui.closeModal(overlay);
        ui.toast(p ? 'Producto actualizado.' : 'Producto creado.', 'success');
        NS.app.refresh(true);
      } catch (e) { ui.toast(e.message, 'error'); }
    });
  }

  function openStock(sku) {
    const ui = NS.ui;
    if (!NS.app.canAction('inventory', 'editar')) return ui.toast('No tienes permiso para ajustar stock.', 'warning');
    const p = NS.store.db.products.find((x) => x.sku === sku);
    if (!p) return;
    const overlay = ui.modal({
      title: 'Ajustar stock',
      eyebrow: p.nombre + ' · ' + p.sku,
      subtitle: 'Stock actual: ' + p.stock + ' unidades.',
      size: 'sm',
      body: `<form id="stock-form" class="form-grid">
        <label class="field"><span>Unidades a sumar o restar *</span><input name="delta" type="number" step="1" placeholder="Ej. 10 o -3" required></label>
        <label class="field field-full"><span>Motivo</span><input name="motivo" placeholder="Compra, devolución, merma..."></label>
        <p class="form-note field-full">${ui.icon('info', 14)} Usa números negativos para descontar unidades. El stock nunca puede quedar por debajo de cero.</p>
      </form>`,
      footer: `<button class="btn btn-ghost" data-cancel>Cancelar</button><button class="btn btn-primary" id="stock-save">${ui.icon('check', 15)} Aplicar ajuste</button>`
    });
    overlay.querySelector('[data-cancel]').addEventListener('click', () => ui.closeModal(overlay));
    overlay.querySelector('#stock-save').addEventListener('click', () => {
      const form = overlay.querySelector('#stock-form');
      if (!form.reportValidity()) return;
      try {
        NS.store.adjustStock(sku, form.elements.delta.value, form.elements.motivo.value);
        ui.closeModal(overlay);
        ui.toast('Stock actualizado.', 'success');
        NS.app.refresh(true);
      } catch (e) { ui.toast(e.message, 'error'); }
    });
  }

  function openAssign(preselectSku, presetDriver) {
    const ui = NS.ui;
    if (!NS.app.canAction('inventory', 'asignar')) return ui.toast('No tienes permiso para asignar productos.', 'warning');
    const db = NS.store.db;
    const available = db.products.filter((p) => p.activo && p.stock > 0);
    if (!available.length) return ui.toast('No hay productos activos con stock disponible.', 'warning');
    const drivers = db.drivers.slice().sort((a, b) => (a.nombres || '').localeCompare(b.nombres || ''));
    const firstSku = preselectSku && available.some((p) => p.sku === preselectSku) ? preselectSku : available[0].sku;
    const overlay = ui.modal({
      title: 'Asignar producto a conductor',
      eyebrow: 'Tienda del conductor',
      subtitle: 'La compra se financia contra la cartera del conductor y descuenta stock.',
      size: 'lg',
      body: `<form id="assign-form" class="form-grid">
        <label class="field field-full"><span>Conductor *</span><select name="cedula" required>
          <option value="">Selecciona un conductor...</option>
          ${drivers.map((d) => `<option value="${ui.esc(d.cedula_rif)}" ${presetDriver === d.cedula_rif ? 'selected' : ''}>${ui.esc(d.nombres + ' ' + d.apellidos)} · ${ui.esc(d.cedula_rif)} · ${ui.esc(d.estatus_conductor || '')}</option>`).join('')}
        </select></label>
        <label class="field field-full"><span>Producto *</span><select name="sku" id="assign-sku" required>
          ${available.map((p) => `<option value="${ui.esc(p.sku)}" data-price="${p.precio_usd}" data-stock="${p.stock}" ${p.sku === firstSku ? 'selected' : ''}>${ui.esc(p.nombre)} · ${ui.usd(p.precio_usd)} · ${p.stock} disp.</option>`).join('')}
        </select></label>
        <label class="field"><span>Cantidad *</span><input name="cantidad" id="assign-qty" type="number" min="1" step="1" value="1" required></label>
        <label class="field"><span>Cuotas *</span><select name="cuotas" id="assign-cuotas">
          <option value="1">1 cuota (contado)</option>
          <option value="2">2 cuotas</option>
          <option value="4" selected>4 cuotas</option>
          <option value="8">8 cuotas</option>
          <option value="12">12 cuotas</option>
          <option value="24">24 cuotas</option>
        </select></label>
        <div class="field field-full"><div class="calc-box" id="assign-calc"></div></div>
        <div class="field field-full"><p class="form-note">${ui.icon('info', 14)} Se registrará una cuenta por cobrar al conductor y el asiento de venta/costo. La deuda aparece en su wallet y puede abonarse desde esta pantalla.</p></div>
      </form>`,
      footer: `<button class="btn btn-ghost" data-cancel>Cancelar</button><button class="btn btn-primary" id="assign-save">${ui.icon('check', 15)} Asignar y financiar</button>`
    });
    const skuSel = overlay.querySelector('#assign-sku');
    const qty = overlay.querySelector('#assign-qty');
    const cuotas = overlay.querySelector('#assign-cuotas');
    const calc = overlay.querySelector('#assign-calc');
    const updateCalc = () => {
      const opt = skuSel.options[skuSel.selectedIndex];
      const price = Number(opt && opt.dataset.price) || 0;
      const stock = Number(opt && opt.dataset.stock) || 0;
      const q = Math.max(1, Number(qty.value) || 1);
      const c = Math.max(1, Number(cuotas.value) || 1);
      const total = price * q;
      calc.innerHTML = `<div class="calc-line"><span>Precio unitario</span><strong>${ui.usd(price)}</strong></div>
        <div class="calc-line"><span>Cantidad</span><strong>${q} (stock ${stock})</strong></div>
        <div class="calc-line calc-total"><span>Total a financiar</span><strong>${ui.usd(total)}</strong></div>
        <div class="calc-line"><span>Cuota estimada (${c})</span><strong>${ui.usd(total / c)}</strong></div>`;
    };
    skuSel.addEventListener('change', updateCalc);
    qty.addEventListener('input', updateCalc);
    cuotas.addEventListener('change', updateCalc);
    updateCalc();
    overlay.querySelector('[data-cancel]').addEventListener('click', () => ui.closeModal(overlay));
    overlay.querySelector('#assign-save').addEventListener('click', () => {
      const form = overlay.querySelector('#assign-form');
      if (!form.reportValidity()) return;
      try {
        NS.store.assignProduct(form.elements.cedula.value, {
          sku: form.elements.sku.value,
          cantidad: form.elements.cantidad.value,
          cuotas: form.elements.cuotas.value
        });
        ui.closeModal(overlay);
        ui.toast('Producto asignado, stock descontado y financiamiento generado.', 'success');
        NS.app.refresh(true);
      } catch (e) { ui.toast(e.message, 'error'); }
    });
  }

  function openChargePayment(chargeId) {
    const ui = NS.ui;
    if (!NS.app.canAction('inventory', 'cobrar')) return ui.toast('No tienes permiso para registrar cobros.', 'warning');
    const c = NS.store.db.driverCharges.find((x) => x.id === chargeId);
    if (!c) return;
    const d = NS.store.db.drivers.find((x) => x.cedula_rif === c.conductor_cedula_rif);
    const overlay = ui.modal({
      title: 'Abonar a financiamiento',
      eyebrow: c.producto_nombre + ' · ' + (d ? d.nombres + ' ' + d.apellidos : c.conductor_cedula_rif),
      subtitle: 'Saldo pendiente: ' + ui.usd(c.saldo_usd) + ' de ' + ui.usd(c.total_usd) + '.',
      size: 'sm',
      body: `<form id="charge-pay-form" class="form-grid">
        <label class="field"><span>Monto del abono (USD) *</span><input name="monto" type="number" min="0.01" step="0.01" value="${Math.min(c.cuota_usd, c.saldo_usd)}" required></label>
        <label class="field"><span>Fecha</span><input name="fecha" type="date" value="${NS.store.today()}"></label>
        <p class="form-note field-full">${ui.icon('info', 14)} Se registra el ingreso de caja contra la cuenta por cobrar al conductor (1.1.2.02).</p>
      </form>`,
      footer: `<button class="btn btn-ghost" data-cancel>Cancelar</button><button class="btn btn-primary" id="charge-pay-save">${ui.icon('check', 15)} Registrar abono</button>`
    });
    overlay.querySelector('[data-cancel]').addEventListener('click', () => ui.closeModal(overlay));
    overlay.querySelector('#charge-pay-save').addEventListener('click', () => {
      const form = overlay.querySelector('#charge-pay-form');
      if (!form.reportValidity()) return;
      try {
        NS.store.payDriverCharge(chargeId, form.elements.monto.value, { fecha: form.elements.fecha.value });
        ui.closeModal(overlay);
        ui.toast('Abono registrado y asiento contable generado.', 'success');
        NS.app.refresh(true);
      } catch (e) { ui.toast(e.message, 'error'); }
    });
  }

  function askDelete(sku) {
    const ui = NS.ui;
    const p = NS.store.db.products.find((x) => x.sku === sku);
    ui.confirm({
      title: 'Eliminar producto',
      message: `¿Eliminar ${p ? p.nombre : sku} del catálogo? Solo es posible si no tiene financiamientos vigentes.`,
      confirmText: 'Eliminar', danger: true
    }).then((ok) => {
      if (!ok) return;
      try {
        NS.store.deleteProduct(sku);
        ui.toast('Producto eliminado.', 'success');
        NS.app.refresh(true);
      } catch (e) { ui.toast(e.message, 'error'); }
    });
  }

  function exportCsv() {
    const rows = [['SKU', 'Producto', 'Categoría', 'Precio USD', 'Costo USD', 'Stock', 'Stock mínimo', 'Activo', 'Valor inventario USD']];
    NS.store.db.products.forEach((p) => rows.push([p.sku, p.nombre, p.categoria, p.precio_usd, p.costo_usd, p.stock, p.stock_min, p.activo ? 'Sí' : 'No', (p.stock * p.costo_usd).toFixed(2)]));
    NS.ui.downloadFile('ENVIA_inventario_' + NS.store.today() + '.csv', NS.ui.csv(rows));
    NS.ui.toast('Inventario exportado a CSV.', 'success');
  }

  NS.modules.inventory = { render, openProductForm, openAssign, openChargePayment };
})();
