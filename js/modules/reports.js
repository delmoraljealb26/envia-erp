/* =========================================================================
   ENVIA ERP · modules/reports.js
   Centro de reportes transversal. Cada módulo expone sus reportes y todos
   pueden imprimirse (diálogo de impresoras del navegador) o exportarse a Excel.
   ========================================================================= */
(function () {
  'use strict';
  const NS = (window.ENVIA = window.ENVIA || {});
  NS.modules = NS.modules || {};

  const MONEY = (n) => Number(n || 0);

  function db() { return NS.store.db; }
  function date(v) { return v ? NS.ui.date(v) : '—'; }
  function usd(v) { return NS.ui.usd(MONEY(v)); }
  function bs(v) { return NS.ui.bs(MONEY(v)); }
  function num(v) { return NS.ui.num(MONEY(v), 2); }
  function pct(v) { return NS.ui.num(MONEY(v), 2) + '%'; }

  function reportMeta() {
    const session = NS.app && NS.app.session;
    return [
      'Generado: ' + new Date().toLocaleString('es-VE'),
      session ? 'Usuario: ' + NS.ui.esc(session.usuario) + ' · ' + NS.ui.esc(session.rol) : '',
      'Tasa BCV: ' + NS.ui.bs(NS.ui.rate()) + ' / USD'
    ].filter(Boolean).join('<br>');
  }

  function valueOf(value, type) {
    if (value == null || value === '') return '—';
    if (type === 'usd') return usd(value);
    if (type === 'ves') return bs(value);
    if (type === 'num') return num(value);
    if (type === 'int') return NS.ui.num(value, 0);
    if (type === 'pct') return pct(value);
    if (type === 'date') return date(value);
    return String(value);
  }

  function rawValue(value, type) {
    if (value == null) return '';
    if (type === 'usd' || type === 'ves' || type === 'num' || type === 'int' || type === 'pct') return MONEY(value);
    if (type === 'date') return date(value);
    return String(value);
  }

  function tableHtml(report) {
    const head = `<tr>${report.columns.map((c) => `<th class="${c.type && c.type !== 'text' ? 'num' : ''}">${NS.ui.esc(c.label)}</th>`).join('')}</tr>`;
    const body = report.rows.map((row) => `<tr>${report.columns.map((c) => `<td class="${c.type && c.type !== 'text' ? 'num' : ''}">${NS.ui.esc(valueOf(row[c.key], c.type))}</td>`).join('')}</tr>`).join('');
    const totals = report.totals
      ? `<tfoot><tr>${report.columns.map((c, i) => `<td class="${c.type && c.type !== 'text' ? 'num' : ''}">${i === 0 ? 'TOTALES' : NS.ui.esc(valueOf(report.totals[c.key], c.type))}</td>`).join('')}</tr></tfoot>`
      : '';
    return `<table><thead>${head}</thead><tbody>${body || `<tr><td colspan="${report.columns.length}">Sin datos para este reporte.</td></tr>`}</tbody>${totals}</table>`;
  }

  function excelHtml(report) {
    const head = `<tr>${report.columns.map((c) => `<th>${NS.ui.esc(c.label)}</th>`).join('')}</tr>`;
    const body = report.rows.map((row) => `<tr>${report.columns.map((c) => `<td>${NS.ui.esc(rawValue(row[c.key], c.type))}</td>`).join('')}</tr>`).join('');
    const totals = report.totals
      ? `<tr>${report.columns.map((c, i) => `<td><strong>${NS.ui.esc(i === 0 ? 'TOTALES' : rawValue(report.totals[c.key], c.type))}</strong></td>`).join('')}</tr>`
      : '';
    return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
      <head><meta charset="utf-8"><style>
        body { font-family: Arial, sans-serif; font-size: 11px; }
        h1 { font-size: 16px; color: #0F1E36; }
        h2 { font-size: 11px; color: #5B6B82; font-weight: normal; }
        table { border-collapse: collapse; width: 100%; }
        th { background: #0F1E36; color: #fff; padding: 7px; border: 1px solid #0F1E36; text-align: left; }
        td { padding: 6px; border: 1px solid #D7E1EF; }
        tr:nth-child(even) td { background: #F7F9FC; }
      </style></head><body>
      <h1>ENVIA ERP · ${NS.ui.esc(report.title)}</h1>
      <h2>${NS.ui.esc(report.subtitle || '')} · ${new Date().toLocaleString('es-VE')} · Tasa BCV ${NS.ui.bs(NS.ui.rate())} / USD</h2>
      <table>${head}${body}${totals}</table>
      </body></html>`;
  }

  function printReport(report) {
    NS.ui.printHTML(report.title, tableHtml(report), {
      title: report.title,
      subtitle: report.subtitle || 'Reporte operativo ENVIA ERP',
      meta: reportMeta()
    });
  }

  function excelReport(report) {
    const clean = String(report.title).replace(/[^\wáéíóúñ]+/gi, '_').replace(/^_+|_+$/g, '');
    NS.ui.downloadFile('ENVIA_' + clean + '_' + NS.store.today() + '.xls', excelHtml(report), 'application/vnd.ms-excel;charset=utf-8');
  }

  function groupBy(rows, keyFn) {
    const map = new Map();
    rows.forEach((row) => {
      const key = keyFn(row);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(row);
    });
    return map;
  }

  /* --------------------- Reportes personalizados ---------------------- */
  // Catálogo de tablas y columnas disponibles para que el administrador arme
  // sus propios listados con la información ya almacenada.
  const CUSTOM_TABLES = {
    clients: { label: 'Clientes', fields: [
      ['cedula_rif', 'Cédula / RIF', 'text'], ['nombres', 'Nombres', 'text'], ['apellidos', 'Apellidos', 'text'],
      ['telefono', 'Teléfono', 'text'], ['correo', 'Correo', 'text'], ['direccion', 'Dirección', 'text'],
      ['estatus', 'Estatus', 'text'], ['saldo_wallet_usd', 'Saldo wallet USD', 'usd'], ['saldo_wallet_ves', 'Saldo wallet VES', 'ves'],
      ['total_carreras', 'Carreras', 'int'], ['total_encomiendas', 'Encomiendas', 'int'], ['fecha_registro', 'Fecha de registro', 'date']
    ] },
    drivers: { label: 'Conductores', fields: [
      ['cedula_rif', 'Cédula / RIF', 'text'], ['nombres', 'Nombres', 'text'], ['apellidos', 'Apellidos', 'text'],
      ['nivel', 'Nivel', 'text'], ['tipo_tarifa', 'Tarifa', 'text'], ['telefono', 'Teléfono', 'text'], ['correo', 'Correo', 'text'],
      ['direccion', 'Dirección', 'text'], ['tipo_servicio', 'Tipo de servicio', 'text'], ['placa', 'Placa', 'text'],
      ['marca', 'Marca', 'text'], ['modelo', 'Modelo', 'text'], ['anio', 'Año', 'int'], ['color', 'Color', 'text'],
      ['banco', 'Banco', 'text'], ['porcentaje_comision', 'Comisión %', 'pct'],
      ['saldo_por_liquidar_usd', 'Saldo por liquidar USD', 'usd'], ['estatus_conductor', 'Estatus', 'text'],
      ['fecha_registro', 'Fecha de registro', 'date']
    ] },
    users: { label: 'Usuarios', fields: [
      ['usuario', 'Usuario', 'text'], ['nombre', 'Nombre', 'text'], ['rol', 'Rol', 'text'],
      ['correo', 'Correo', 'text'], ['activo', 'Activo', 'text'], ['created_at', 'Fecha de creación', 'date']
    ] },
    services: { label: 'Servicios', fields: [
      ['id', 'ID', 'text'], ['fecha', 'Fecha', 'date'], ['tipo', 'Tipo', 'text'],
      ['cliente_cedula_rif', 'Cliente', 'text'], ['conductor_cedula_rif', 'Conductor', 'text'],
      ['origen', 'Origen', 'text'], ['destino', 'Destino', 'text'], ['base_usd', 'Base USD', 'usd'],
      ['iva_usd', 'IVA USD', 'usd'], ['igtf_usd', 'IGTF USD', 'usd'], ['total_usd', 'Total USD', 'usd'],
      ['comision_usd', 'Comisión USD', 'usd'], ['pago_conductor_usd', 'Pago conductor USD', 'usd'],
      ['metodo_pago', 'Método de pago', 'text'], ['estatus', 'Estatus', 'text']
    ] },
    suppliers: { label: 'Proveedores', fields: [
      ['rif', 'RIF', 'text'], ['razon_social', 'Razón social', 'text'], ['telefono', 'Teléfono', 'text'],
      ['correo', 'Correo', 'text'], ['direccion', 'Dirección', 'text'], ['actividad', 'Actividad', 'text'],
      ['tipo_persona', 'Tipo de persona', 'text'], ['retencion_iva_pct', 'Retención IVA %', 'pct'], ['estatus', 'Estatus', 'text']
    ] },
    partners: { label: 'Negocios asociados', fields: [
      ['rif', 'RIF', 'text'], ['razon_social', 'Razón social', 'text'], ['tipo', 'Tipo', 'text'],
      ['contacto', 'Contacto', 'text'], ['telefono', 'Teléfono', 'text'], ['correo', 'Correo', 'text'],
      ['direccion', 'Dirección', 'text'], ['comision_pct', 'Comisión %', 'pct'],
      ['saldo_por_cobrar_usd', 'Saldo por cobrar USD', 'usd'], ['saldo_por_pagar_usd', 'Saldo por pagar USD', 'usd'],
      ['estatus', 'Estatus', 'text']
    ] },
    products: { label: 'Productos / tienda', fields: [
      ['sku', 'SKU', 'text'], ['nombre', 'Nombre', 'text'], ['categoria', 'Categoría', 'text'],
      ['descripcion', 'Descripción', 'text'], ['precio_usd', 'Precio USD', 'usd'],
      ['stock', 'Stock', 'int'], ['stock_min', 'Stock mínimo', 'int'], ['activo', 'Activo', 'text']
    ] },
    payables: { label: 'Cuentas por pagar', fields: [
      ['numero_factura', 'Factura', 'text'], ['numero_control', 'Control', 'text'], ['proveedor_rif', 'Proveedor', 'text'],
      ['fecha_emision', 'Fecha de emisión', 'date'], ['fecha_vencimiento', 'Vencimiento', 'date'],
      ['base_usd', 'Base USD', 'usd'], ['iva_usd', 'IVA USD', 'usd'], ['igtf_usd', 'IGTF USD', 'usd'],
      ['total_usd', 'Total USD', 'usd'], ['ret_iva_usd', 'Retención IVA USD', 'usd'],
      ['ret_islr_usd', 'Retención ISLR USD', 'usd'], ['estatus', 'Estatus', 'text']
    ] },
    withholdings: { label: 'Comprobantes de retención', fields: [
      ['numero_comprobante', 'Comprobante', 'text'], ['periodo', 'Período', 'text'], ['tipo', 'Tipo', 'text'],
      ['proveedor_rif', 'Proveedor RIF', 'text'], ['proveedor_nombre', 'Proveedor', 'text'],
      ['factura_numero', 'Factura', 'text'], ['fecha', 'Fecha', 'date'], ['base_ves', 'Base VES', 'ves'],
      ['iva_ves', 'IVA VES', 'ves'], ['ret_iva_ves', 'Retención IVA VES', 'ves'],
      ['ret_islr_ves', 'Retención ISLR VES', 'ves'], ['total_retenido_ves', 'Total retenido VES', 'ves'],
      ['estado', 'Estado', 'text']
    ] }
  };

  function tableDef(key) {
    return CUSTOM_TABLES[key] || null;
  }
  function fieldDef(tableKey, fieldKey) {
    const t = tableDef(tableKey);
    if (!t) return null;
    const f = t.fields.find((x) => x[0] === fieldKey);
    return f ? { key: f[0], label: f[1], type: f[2] } : null;
  }
  function defaultTable(module) {
    const map = { clients: 'clients', drivers: 'drivers', users: 'users', services: 'services', payables: 'suppliers', partners: 'partners', inventory: 'products', taxes: 'withholdings', settings: 'users', audit: 'users', dashboard: 'services' };
    return map[module] || 'clients';
  }
  function customFor(module) {
    return (db().customReports || []).filter((r) => r.modulo === module);
  }
  function customBuild(rep) {
    const table = tableDef(rep.tabla);
    if (!table) throw new Error('La tabla del reporte ya no está disponible.');
    const cols = (rep.columnas || []).map((k) => fieldDef(rep.tabla, k)).filter(Boolean);
    if (!cols.length) throw new Error('El reporte no tiene columnas válidas.');
    let rows = (db()[rep.tabla] || []).slice();
    if (rep.filtro_campo && String(rep.filtro_valor || '').trim() !== '') {
      const f = fieldDef(rep.tabla, rep.filtro_campo);
      const raw = String(rep.filtro_valor).trim();
      const needle = raw.toLowerCase();
      const numeric = f && ['usd', 'ves', 'num', 'int', 'pct'].includes(f.type);
      rows = rows.filter((row) => {
        const value = row[rep.filtro_campo];
        if (numeric) {
          const a = Number(value) || 0;
          const b = Number(raw) || 0;
          if (rep.filtro_op === 'mayor') return a > b;
          if (rep.filtro_op === 'menor') return a < b;
          if (rep.filtro_op === 'igual') return a === b;
          return String(value).toLowerCase().includes(needle);
        }
        const text = String(value == null ? '' : value).toLowerCase();
        if (rep.filtro_op === 'igual') return text === needle;
        if (rep.filtro_op === 'mayor') return text > needle;
        if (rep.filtro_op === 'menor') return text < needle;
        return text.includes(needle);
      });
    }
    if (rep.orden_campo) {
      const f = fieldDef(rep.tabla, rep.orden_campo);
      const numeric = f && ['usd', 'ves', 'num', 'int', 'pct'].includes(f.type);
      rows.sort((a, b) => {
        const av = a[rep.orden_campo];
        const bv = b[rep.orden_campo];
        const cmp = numeric ? (Number(av) || 0) - (Number(bv) || 0) : String(av == null ? '' : av).localeCompare(String(bv == null ? '' : bv), 'es');
        return rep.orden_dir === 'desc' ? -cmp : cmp;
      });
    }
    const out = rows.map((row) => {
      const obj = {};
      cols.forEach((c) => { obj[c.key] = row[c.key]; });
      return obj;
    });
    const filterLabel = rep.filtro_campo && String(rep.filtro_valor || '').trim() !== ''
      ? ` · Filtro: ${fieldDef(rep.tabla, rep.filtro_campo) ? fieldDef(rep.tabla, rep.filtro_campo).label : rep.filtro_campo} ${rep.filtro_op} "${rep.filtro_valor}"`
      : '';
    return {
      title: rep.nombre,
      subtitle: table.label + ' · Reporte personalizado' + filterLabel,
      columns: cols,
      rows: out
    };
  }
  function customDef(rep) {
    return {
      id: rep.id,
      title: rep.nombre,
      icon: 'filter',
      description: rep.descripcion || (tableDef(rep.tabla) ? 'Listado personalizado de ' + tableDef(rep.tabla).label.toLowerCase() : 'Reporte personalizado'),
      custom: true,
      definition: rep,
      build() { return customBuild(rep); }
    };
  }

  const REPORTS = {
    dashboard: [
      {
        id: 'resumen', title: 'Resumen ejecutivo', icon: 'dashboard',
        description: 'Métricas principales de la operación, cartera y flota.',
        build() {
          const m = NS.store.metrics();
          const rows = [
            { indicador: 'Servicios registrados', valor: m.trips, tipo: 'Servicios' },
            { indicador: 'Ingresos brutos', valor: usd(m.gross), tipo: 'USD' },
            { indicador: 'Comisión ENVIA', valor: usd(m.commission), tipo: 'USD' },
            { indicador: 'Ticket promedio', valor: usd(m.ticketAvg), tipo: 'USD' },
            { indicador: 'IVA facturado', valor: usd(m.iva), tipo: 'USD' },
            { indicador: 'IGTF generado', valor: usd(m.igtf), tipo: 'USD' },
            { indicador: 'Clientes registrados', valor: m.clients, tipo: 'Maestro' },
            { indicador: 'Conductores activos', valor: m.activeDrivers + ' / ' + m.totalDrivers, tipo: 'Flota' },
            { indicador: 'Cuentas por pagar pendientes', valor: usd(m.pending), tipo: 'USD' },
            { indicador: 'Saldo por liquidar a conductores', valor: usd(m.driversPending), tipo: 'USD' }
          ];
          return {
            title: 'Resumen ejecutivo', subtitle: 'Tablero gerencial ENVIA ERP',
            columns: [{ key: 'indicador', label: 'Indicador' }, { key: 'valor', label: 'Valor', type: 'text' }, { key: 'tipo', label: 'Unidad' }],
            rows
          };
        }
      },
      {
        id: 'servicios-14', title: 'Servicios de los últimos 14 días', icon: 'route',
        description: 'Detalle operativo reciente con ingresos, IVA, IGTF y comisión.',
        build() {
          const from = NS.store.iso(14);
          const rows = db().services.filter((s) => s.fecha >= from).sort((a, b) => b.fecha.localeCompare(a.fecha)).map((s) => ({
            fecha: s.fecha, id: s.id, tipo: s.tipo, cliente: s.cliente_cedula_rif,
            conductor: s.conductor_cedula_rif, total: s.total_usd, comision: s.comision_usd
          }));
          return {
            title: 'Servicios de los últimos 14 días', subtitle: 'Del ' + NS.ui.date(from) + ' al ' + NS.ui.date(NS.store.today()),
            columns: [
              { key: 'fecha', label: 'Fecha', type: 'date' }, { key: 'id', label: 'Servicio' },
              { key: 'tipo', label: 'Tipo' }, { key: 'cliente', label: 'Cliente' }, { key: 'conductor', label: 'Conductor' },
              { key: 'total', label: 'Total USD', type: 'usd' }, { key: 'comision', label: 'Comisión USD', type: 'usd' }
            ],
            rows,
            totals: { total: rows.reduce((s, r) => s + MONEY(r.total), 0), comision: rows.reduce((s, r) => s + MONEY(r.comision), 0) }
          };
        }
      },
      {
        id: 'clientes-estatus', title: 'Clientes por estatus', icon: 'users',
        description: 'Distribución del maestro de clientes y saldos de billetera.',
        build() {
          const rows = Array.from(groupBy(db().clients, (c) => c.estatus || 'Sin estatus')).map(([estatus, list]) => ({
            estatus, clientes: list.length,
            usd: list.reduce((s, c) => s + MONEY(c.saldo_wallet_usd), 0),
            ves: list.reduce((s, c) => s + MONEY(c.saldo_wallet_ves), 0)
          }));
          return {
            title: 'Clientes por estatus', subtitle: 'Composición del maestro de clientes',
            columns: [{ key: 'estatus', label: 'Estatus' }, { key: 'clientes', label: 'Clientes', type: 'int' }, { key: 'usd', label: 'Wallet USD', type: 'usd' }, { key: 'ves', label: 'Wallet VES', type: 'ves' }],
            rows,
            totals: { clientes: rows.reduce((s, r) => s + r.clientes, 0), usd: rows.reduce((s, r) => s + r.usd, 0), ves: rows.reduce((s, r) => s + r.ves, 0) }
          };
        }
      }
    ],

    services: [
      {
        id: 'listado', title: 'Listado general de servicios', icon: 'route',
        description: 'Carreras y encomiendas con base, impuestos, total y comisión.',
        build() {
          const rows = db().services.slice().sort((a, b) => b.fecha.localeCompare(a.fecha)).map((s) => ({
            fecha: s.fecha, id: s.id, tipo: s.tipo, cliente: s.cliente_cedula_rif, conductor: s.conductor_cedula_rif,
            origen: s.origen, destino: s.destino, base: s.base_usd, iva: s.iva_usd, igtf: s.igtf_usd, total: s.total_usd, comision: s.comision_usd
          }));
          return {
            title: 'Listado general de servicios', subtitle: 'Carreras y encomiendas registradas',
            columns: [
              { key: 'fecha', label: 'Fecha', type: 'date' }, { key: 'id', label: 'ID' }, { key: 'tipo', label: 'Tipo' },
              { key: 'cliente', label: 'Cliente' }, { key: 'conductor', label: 'Conductor' }, { key: 'origen', label: 'Origen' }, { key: 'destino', label: 'Destino' },
              { key: 'base', label: 'Base USD', type: 'usd' }, { key: 'iva', label: 'IVA USD', type: 'usd' }, { key: 'igtf', label: 'IGTF USD', type: 'usd' },
              { key: 'total', label: 'Total USD', type: 'usd' }, { key: 'comision', label: 'Comisión USD', type: 'usd' }
            ],
            rows,
            totals: {
              base: rows.reduce((s, r) => s + r.base, 0), iva: rows.reduce((s, r) => s + r.iva, 0),
              igtf: rows.reduce((s, r) => s + r.igtf, 0), total: rows.reduce((s, r) => s + r.total, 0),
              comision: rows.reduce((s, r) => s + r.comision, 0)
            }
          };
        }
      },
      {
        id: 'ingresos-tipo', title: 'Ingresos por tipo de servicio', icon: 'chart',
        description: 'Consolidado de carreras y encomiendas con impuestos.',
        build() {
          const rows = Array.from(groupBy(db().services, (s) => s.tipo)).map(([tipo, list]) => ({
            tipo, cantidad: list.length, base: list.reduce((s, x) => s + MONEY(x.base_usd), 0),
            iva: list.reduce((s, x) => s + MONEY(x.iva_usd), 0), igtf: list.reduce((s, x) => s + MONEY(x.igtf_usd), 0),
            total: list.reduce((s, x) => s + MONEY(x.total_usd), 0), comision: list.reduce((s, x) => s + MONEY(x.comision_usd), 0)
          }));
          return {
            title: 'Ingresos por tipo de servicio', subtitle: 'Consolidado operativo',
            columns: [{ key: 'tipo', label: 'Tipo' }, { key: 'cantidad', label: 'Servicios', type: 'int' }, { key: 'base', label: 'Base USD', type: 'usd' }, { key: 'iva', label: 'IVA USD', type: 'usd' }, { key: 'igtf', label: 'IGTF USD', type: 'usd' }, { key: 'total', label: 'Total USD', type: 'usd' }, { key: 'comision', label: 'Comisión USD', type: 'usd' }],
            rows,
            totals: { cantidad: rows.reduce((s, r) => s + r.cantidad, 0), base: rows.reduce((s, r) => s + r.base, 0), iva: rows.reduce((s, r) => s + r.iva, 0), igtf: rows.reduce((s, r) => s + r.igtf, 0), total: rows.reduce((s, r) => s + r.total, 0), comision: rows.reduce((s, r) => s + r.comision, 0) }
          };
        }
      },
      {
        id: 'comisiones', title: 'Comisiones por conductor', icon: 'wallet',
        description: 'Base generada, comisión ENVIA y saldo pendiente por aliado.',
        build() {
          const rows = Array.from(groupBy(db().services, (s) => s.conductor_cedula_rif)).map(([cedula, list]) => {
            const driver = db().drivers.find((d) => d.cedula_rif === cedula);
            return {
              cedula, conductor: driver ? driver.nombres + ' ' + driver.apellidos : cedula,
              nivel: driver ? driver.nivel : '—', servicios: list.length,
              base: list.reduce((s, x) => s + MONEY(x.base_usd), 0), comision: list.reduce((s, x) => s + MONEY(x.comision_usd), 0),
              saldo: driver ? driver.saldo_por_liquidar_usd : 0
            };
          });
          return {
            title: 'Comisiones por conductor', subtitle: 'Liquidaciones y saldos de flota',
            columns: [{ key: 'cedula', label: 'Cédula' }, { key: 'conductor', label: 'Conductor' }, { key: 'nivel', label: 'Nivel' }, { key: 'servicios', label: 'Servicios', type: 'int' }, { key: 'base', label: 'Base USD', type: 'usd' }, { key: 'comision', label: 'Comisión USD', type: 'usd' }, { key: 'saldo', label: 'Por liquidar USD', type: 'usd' }],
            rows,
            totals: { servicios: rows.reduce((s, r) => s + r.servicios, 0), base: rows.reduce((s, r) => s + r.base, 0), comision: rows.reduce((s, r) => s + r.comision, 0), saldo: rows.reduce((s, r) => s + r.saldo, 0) }
          };
        }
      }
    ],

    clients: [
      {
        id: 'maestro', title: 'Maestro de clientes', icon: 'users',
        description: 'Datos completos de contacto, estatus y wallet por cliente.',
        build() {
          const rows = db().clients.slice().sort((a, b) => a.apellidos.localeCompare(b.apellidos)).map((c) => ({
            cedula: c.cedula_rif, nombre: c.nombres + ' ' + c.apellidos, telefono: c.telefono,
            correo: c.correo, estatus: c.estatus, ciudad: c.direccion,
            usd: c.saldo_wallet_usd, ves: c.saldo_wallet_ves, carreras: c.total_carreras, encomiendas: c.total_encomiendas
          }));
          return {
            title: 'Maestro de clientes', subtitle: 'Clave primaria: cédula / RIF',
            columns: [{ key: 'cedula', label: 'Cédula / RIF' }, { key: 'nombre', label: 'Cliente' }, { key: 'telefono', label: 'Teléfono' }, { key: 'correo', label: 'Correo' }, { key: 'estatus', label: 'Estatus' }, { key: 'ciudad', label: 'Dirección' }, { key: 'usd', label: 'Wallet USD', type: 'usd' }, { key: 'ves', label: 'Wallet VES', type: 'ves' }, { key: 'carreras', label: 'Carreras', type: 'int' }, { key: 'encomiendas', label: 'Encomiendas', type: 'int' }],
            rows
          };
        }
      },
      {
        id: 'wallet', title: 'Saldos de billetera', icon: 'wallet',
        description: 'Posición consolidada de wallet en USD y VES por cliente.',
        build() {
          const rows = db().clients.slice().sort((a, b) => MONEY(b.saldo_wallet_usd) - MONEY(a.saldo_wallet_usd)).map((c) => ({
            cedula: c.cedula_rif, nombre: c.nombres + ' ' + c.apellidos, estatus: c.estatus,
            usd: c.saldo_wallet_usd, ves: c.saldo_wallet_ves
          }));
          return {
            title: 'Saldos de billetera', subtitle: 'Saldos disponibles por cliente',
            columns: [{ key: 'cedula', label: 'Cédula / RIF' }, { key: 'nombre', label: 'Cliente' }, { key: 'estatus', label: 'Estatus' }, { key: 'usd', label: 'Wallet USD', type: 'usd' }, { key: 'ves', label: 'Wallet VES', type: 'ves' }],
            rows,
            totals: { usd: rows.reduce((s, r) => s + r.usd, 0), ves: rows.reduce((s, r) => s + r.ves, 0) }
          };
        }
      },
      {
        id: 'estatus', title: 'Clientes por estatus', icon: 'chart',
        description: 'Cantidad de clientes y saldos agrupados por estatus.',
        build() {
          const rows = Array.from(groupBy(db().clients, (c) => c.estatus || 'Sin estatus')).map(([estatus, list]) => ({
            estatus, clientes: list.length,
            usd: list.reduce((s, c) => s + MONEY(c.saldo_wallet_usd), 0),
            ves: list.reduce((s, c) => s + MONEY(c.saldo_wallet_ves), 0)
          }));
          return {
            title: 'Clientes por estatus', subtitle: 'Distribución del maestro',
            columns: [{ key: 'estatus', label: 'Estatus' }, { key: 'clientes', label: 'Clientes', type: 'int' }, { key: 'usd', label: 'Wallet USD', type: 'usd' }, { key: 'ves', label: 'Wallet VES', type: 'ves' }],
            rows,
            totals: { clientes: rows.reduce((s, r) => s + r.clientes, 0), usd: rows.reduce((s, r) => s + r.usd, 0), ves: rows.reduce((s, r) => s + r.ves, 0) }
          };
        }
      }
    ],

    drivers: [
      {
        id: 'maestro', title: 'Maestro de conductores y flota', icon: 'car',
        description: 'Datos operativos, nivel, vehículo, comisión y saldo por liquidar.',
        build() {
          const rows = db().drivers.slice().sort((a, b) => a.apellidos.localeCompare(b.apellidos)).map((d) => ({
            cedula: d.cedula_rif, conductor: d.nombres + ' ' + d.apellidos, nivel: d.nivel || 'Zafiro',
            tipo: d.tipo_servicio, placa: d.placa, telefono: d.telefono,
            comision: d.porcentaje_comision, saldo: d.saldo_por_liquidar_usd, estatus: d.estatus_conductor,
            docs: Object.values(d.docs_estado || {}).filter((x) => x === 'Aprobado').length + '/5'
          }));
          return {
            title: 'Maestro de conductores y flota', subtitle: 'Aliados operativos y vehículos',
            columns: [{ key: 'cedula', label: 'Cédula / RIF' }, { key: 'conductor', label: 'Conductor' }, { key: 'nivel', label: 'Nivel' }, { key: 'tipo', label: 'Tipo servicio' }, { key: 'placa', label: 'Placa' }, { key: 'telefono', label: 'Teléfono' }, { key: 'comision', label: '% Comisión', type: 'pct' }, { key: 'saldo', label: 'Por liquidar USD', type: 'usd' }, { key: 'estatus', label: 'Estatus' }, { key: 'docs', label: 'Docs' }],
            rows,
            totals: { saldo: rows.reduce((s, r) => s + r.saldo, 0) }
          };
        }
      },
      {
        id: 'niveles', title: 'Conductores por nivel', icon: 'chart',
        description: 'Distribución Plata, Oro y Platium con saldos y comisión promedio.',
        build() {
          const rows = (NS.store.DRIVER_LEVELS || ['Zafiro', 'Esmeralda', 'Diamante']).map((nivel) => {
            const list = db().drivers.filter((d) => (d.nivel || 'Zafiro') === nivel);
            return {
              nivel, conductores: list.length,
              saldo: list.reduce((s, d) => s + MONEY(d.saldo_por_liquidar_usd), 0),
              comision: list.length ? list.reduce((s, d) => s + MONEY(d.porcentaje_comision), 0) / list.length : 0
            };
          });
          return {
            title: 'Conductores por nivel', subtitle: 'Plata · Oro · Platium',
            columns: [{ key: 'nivel', label: 'Nivel' }, { key: 'conductores', label: 'Conductores', type: 'int' }, { key: 'saldo', label: 'Por liquidar USD', type: 'usd' }, { key: 'comision', label: 'Comisión promedio', type: 'pct' }],
            rows,
            totals: { conductores: rows.reduce((s, r) => s + r.conductores, 0), saldo: rows.reduce((s, r) => s + r.saldo, 0) }
          };
        }
      },
      {
        id: 'liquidaciones', title: 'Saldos por liquidar', icon: 'wallet',
        description: 'Detalle de saldos pendientes por conductor y nivel.',
        build() {
          const rows = db().drivers.filter((d) => MONEY(d.saldo_por_liquidar_usd) > 0).sort((a, b) => b.saldo_por_liquidar_usd - a.saldo_por_liquidar_usd).map((d) => ({
            cedula: d.cedula_rif, conductor: d.nombres + ' ' + d.apellidos, nivel: d.nivel || 'Zafiro',
            banco: d.banco, telefono: d.telefono_pago_movil, saldo: d.saldo_por_liquidar_usd
          }));
          return {
            title: 'Saldos por liquidar a conductores', subtitle: 'Obligaciones pendientes con la flota',
            columns: [{ key: 'cedula', label: 'Cédula' }, { key: 'conductor', label: 'Conductor' }, { key: 'nivel', label: 'Nivel' }, { key: 'banco', label: 'Banco' }, { key: 'telefono', label: 'Pago móvil' }, { key: 'saldo', label: 'Saldo USD', type: 'usd' }],
            rows,
            totals: { saldo: rows.reduce((s, r) => s + r.saldo, 0) }
          };
        }
      }
    ],

    accounting: [
      {
        id: 'diario', title: 'Libro diario detallado', icon: 'book',
        description: 'Asientos con sus líneas de DEBE y HABER en VES.',
        build() {
          const rows = [];
          db().entries.slice().sort((a, b) => b.fecha.localeCompare(a.fecha)).forEach((e) => {
            e.lines.forEach((l) => rows.push({ fecha: e.fecha, numero: e.numero, descripcion: e.descripcion, cuenta: l.cuenta, nombre: NS.store.accountName(l.cuenta), debe: l.debe, haber: l.haber }));
          });
          return {
            title: 'Libro diario detallado', subtitle: 'Partida doble · moneda funcional VES',
            columns: [{ key: 'fecha', label: 'Fecha', type: 'date' }, { key: 'numero', label: 'Asiento' }, { key: 'descripcion', label: 'Descripción' }, { key: 'cuenta', label: 'Cuenta' }, { key: 'nombre', label: 'Nombre de cuenta' }, { key: 'debe', label: 'DEBE VES', type: 'ves' }, { key: 'haber', label: 'HABER VES', type: 'ves' }],
            rows,
            totals: { debe: rows.reduce((s, r) => s + MONEY(r.debe), 0), haber: rows.reduce((s, r) => s + MONEY(r.haber), 0) }
          };
        }
      },
      {
        id: 'mayor', title: 'Libro mayor', icon: 'chart',
        description: 'Movimientos y saldo por cuenta contable.',
        build() {
          const rows = NS.store.getAccountBalances().filter((r) => r.debe || r.haber || r.saldo).map((r) => ({
            codigo: r.account.codigo, cuenta: r.account.nombre, naturaleza: r.account.naturaleza,
            debe: r.debe, haber: r.haber, saldo: r.saldo
          }));
          return {
            title: 'Libro mayor', subtitle: 'Saldos por cuenta · VES',
            columns: [{ key: 'codigo', label: 'Código' }, { key: 'cuenta', label: 'Cuenta' }, { key: 'naturaleza', label: 'Naturaleza' }, { key: 'debe', label: 'DEBE VES', type: 'ves' }, { key: 'haber', label: 'HABER VES', type: 'ves' }, { key: 'saldo', label: 'Saldo VES', type: 'ves' }],
            rows,
            totals: { debe: rows.reduce((s, r) => s + r.debe, 0), haber: rows.reduce((s, r) => s + r.haber, 0), saldo: rows.reduce((s, r) => s + r.saldo, 0) }
          };
        }
      },
      {
        id: 'comprobacion', title: 'Balance de comprobación', icon: 'activity',
        description: 'Sumas y saldos deudores/acreedores por cuenta.',
        build() {
          const rows = NS.store.trialBalance();
          return {
            title: 'Balance de comprobación', subtitle: 'Sumas y saldos · VES',
            columns: [{ key: 'codigo', label: 'Código' }, { key: 'nombre', label: 'Cuenta' }, { key: 'debe', label: 'DEBE VES', type: 'ves' }, { key: 'haber', label: 'HABER VES', type: 'ves' }, { key: 'deudor', label: 'Saldo deudor', type: 'ves' }, { key: 'acreedor', label: 'Saldo acreedor', type: 'ves' }],
            rows,
            totals: { debe: rows.reduce((s, r) => s + r.debe, 0), haber: rows.reduce((s, r) => s + r.haber, 0), deudor: rows.reduce((s, r) => s + r.deudor, 0), acreedor: rows.reduce((s, r) => s + r.acreedor, 0) }
          };
        }
      },
      {
        id: 'resultados', title: 'Estado de resultados', icon: 'trendUp',
        description: 'Ingresos, costos, gastos y resultado del ejercicio.',
        build() {
          const inc = NS.store.incomeStatement();
          const rows = [
            ...inc.incomeRows.map((r) => ({ concepto: 'Ingreso · ' + r.account.nombre, cuenta: r.account.codigo, monto: Math.abs(r.saldo), grupo: 'Ingresos' })),
            ...inc.costRows.map((r) => ({ concepto: 'Costo · ' + r.account.nombre, cuenta: r.account.codigo, monto: Math.abs(r.saldo), grupo: 'Costos' })),
            ...inc.expenseRows.map((r) => ({ concepto: 'Gasto · ' + r.account.nombre, cuenta: r.account.codigo, monto: Math.abs(r.saldo), grupo: 'Gastos' })),
            { concepto: 'Resultado bruto', cuenta: '', monto: inc.gross, grupo: 'Resultado' },
            { concepto: 'Resultado del ejercicio', cuenta: '', monto: inc.profit, grupo: 'Resultado' }
          ];
          return {
            title: 'Estado de resultados', subtitle: 'Del período · VES',
            columns: [{ key: 'grupo', label: 'Grupo' }, { key: 'cuenta', label: 'Cuenta' }, { key: 'concepto', label: 'Concepto' }, { key: 'monto', label: 'Monto VES', type: 'ves' }],
            rows
          };
        }
      },
      {
        id: 'balance-general', title: 'Balance general', icon: 'grid',
        description: 'Activos, pasivos y patrimonio con saldos contables.',
        build() {
          const rows = NS.store.getAccountBalances().filter((r) => /^[123]/.test(r.account.codigo) && (r.debe || r.haber || r.saldo)).map((r) => ({
            codigo: r.account.codigo, cuenta: r.account.nombre, grupo: r.account.codigo.charAt(0) === '1' ? 'Activo' : r.account.codigo.charAt(0) === '2' ? 'Pasivo' : 'Patrimonio',
            saldo: r.saldo
          }));
          return {
            title: 'Balance general', subtitle: 'Situación financiera · VES',
            columns: [{ key: 'grupo', label: 'Grupo' }, { key: 'codigo', label: 'Código' }, { key: 'cuenta', label: 'Cuenta' }, { key: 'saldo', label: 'Saldo VES', type: 'ves' }],
            rows
          };
        }
      },
      {
        id: 'ventas', title: 'Libro de ventas', icon: 'receipt',
        description: 'Servicios facturados con base, IVA, IGTF y total en USD/VES.',
        build() {
          const rate = NS.ui.rate();
          const rows = db().services.slice().sort((a, b) => b.fecha.localeCompare(a.fecha)).map((s) => ({
            fecha: s.fecha, id: s.id, cliente: s.cliente_cedula_rif, tipo: s.tipo,
            base: s.base_usd, iva: s.iva_usd, igtf: s.igtf_usd, total: s.total_usd,
            baseVes: MONEY(s.base_usd) * rate, ivaVes: MONEY(s.iva_usd) * rate, igtfVes: MONEY(s.igtf_usd) * rate, totalVes: MONEY(s.total_usd) * rate
          }));
          return {
            title: 'Libro de ventas', subtitle: 'IVA e IGTF · SENIAT',
            columns: [{ key: 'fecha', label: 'Fecha', type: 'date' }, { key: 'id', label: 'Servicio' }, { key: 'cliente', label: 'Cliente' }, { key: 'tipo', label: 'Tipo' }, { key: 'base', label: 'Base USD', type: 'usd' }, { key: 'iva', label: 'IVA USD', type: 'usd' }, { key: 'igtf', label: 'IGTF USD', type: 'usd' }, { key: 'total', label: 'Total USD', type: 'usd' }, { key: 'baseVes', label: 'Base VES', type: 'ves' }, { key: 'ivaVes', label: 'IVA VES', type: 'ves' }, { key: 'igtfVes', label: 'IGTF VES', type: 'ves' }, { key: 'totalVes', label: 'Total VES', type: 'ves' }],
            rows,
            totals: { base: rows.reduce((s, r) => s + r.base, 0), iva: rows.reduce((s, r) => s + r.iva, 0), igtf: rows.reduce((s, r) => s + r.igtf, 0), total: rows.reduce((s, r) => s + r.total, 0), baseVes: rows.reduce((s, r) => s + r.baseVes, 0), ivaVes: rows.reduce((s, r) => s + r.ivaVes, 0), igtfVes: rows.reduce((s, r) => s + r.igtfVes, 0), totalVes: rows.reduce((s, r) => s + r.totalVes, 0) }
          };
        }
      },
      {
        id: 'compras', title: 'Libro de compras', icon: 'wallet',
        description: 'Facturas de proveedores con IVA, IGTF y retenciones.',
        build() {
          const rows = db().payables.slice().sort((a, b) => b.fecha_emision.localeCompare(a.fecha_emision)).map((p) => ({
            fecha: p.fecha_emision, factura: p.numero_factura, control: p.numero_control,
            proveedor: p.proveedor_rif, base: p.base_usd, iva: p.iva_usd, igtf: p.igtf_usd,
            retIva: p.ret_iva_usd, retIslr: p.ret_islr_usd, neto: p.neto_pagar_usd, estatus: p.estatus
          }));
          return {
            title: 'Libro de compras', subtitle: 'Compras y retenciones · SENIAT',
            columns: [{ key: 'fecha', label: 'Fecha', type: 'date' }, { key: 'factura', label: 'Factura' }, { key: 'control', label: 'Control' }, { key: 'proveedor', label: 'RIF' }, { key: 'base', label: 'Base USD', type: 'usd' }, { key: 'iva', label: 'IVA USD', type: 'usd' }, { key: 'igtf', label: 'IGTF USD', type: 'usd' }, { key: 'retIva', label: 'Ret. IVA USD', type: 'usd' }, { key: 'retIslr', label: 'Ret. ISLR USD', type: 'usd' }, { key: 'neto', label: 'Neto USD', type: 'usd' }, { key: 'estatus', label: 'Estatus' }],
            rows,
            totals: { base: rows.reduce((s, r) => s + r.base, 0), iva: rows.reduce((s, r) => s + r.iva, 0), igtf: rows.reduce((s, r) => s + r.igtf, 0), retIva: rows.reduce((s, r) => s + r.retIva, 0), retIslr: rows.reduce((s, r) => s + r.retIslr, 0), neto: rows.reduce((s, r) => s + r.neto, 0) }
          };
        }
      }
    ],

    taxes: [
      {
        id: 'resumen', title: 'Resumen fiscal', icon: 'percent',
        description: 'Posición de IVA, IGTF, retenciones y tasa BCV.',
        build() {
          const p = db().taxParams;
          const salesIva = db().services.reduce((s, x) => s + MONEY(x.iva_usd), 0);
          const purchaseIva = db().payables.reduce((s, x) => s + MONEY(x.iva_usd), 0);
          const igtfSales = db().services.reduce((s, x) => s + MONEY(x.igtf_usd), 0);
          const igtfPurchases = db().payables.reduce((s, x) => s + MONEY(x.igtf_usd), 0);
          const rows = [
            { concepto: 'Tasa BCV', valor: NS.ui.bs(p.bcvRate), detalle: 'Bs / USD' },
            { concepto: 'Unidad Tributaria', valor: NS.ui.bs(p.ut), detalle: 'Base ISLR' },
            { concepto: 'IVA débito fiscal (ventas)', valor: usd(salesIva), detalle: 'USD' },
            { concepto: 'IVA crédito fiscal (compras)', valor: usd(purchaseIva), detalle: 'USD' },
            { concepto: 'IVA por pagar / (favor)', valor: usd(salesIva - purchaseIva), detalle: 'USD' },
            { concepto: 'IGTF ventas', valor: usd(igtfSales), detalle: 'USD' },
            { concepto: 'IGTF compras', valor: usd(igtfPurchases), detalle: 'USD' },
            { concepto: 'Retenciones IVA', valor: bs(db().withholdings.reduce((s, v) => s + MONEY(v.ret_iva_ves), 0)), detalle: 'VES' },
            { concepto: 'Retenciones ISLR', valor: bs(db().withholdings.reduce((s, v) => s + MONEY(v.ret_islr_ves), 0)), detalle: 'VES' }
          ];
          return {
            title: 'Resumen fiscal', subtitle: 'IVA · IGTF · ISLR',
            columns: [{ key: 'concepto', label: 'Concepto' }, { key: 'valor', label: 'Valor' }, { key: 'detalle', label: 'Unidad' }],
            rows
          };
        }
      },
      {
        id: 'retenciones', title: 'Comprobantes de retención', icon: 'file',
        description: 'Todos los comprobantes de IVA e ISLR emitidos.',
        build() {
          const rows = db().withholdings.slice().sort((a, b) => String(b.numero_comprobante).localeCompare(String(a.numero_comprobante))).map((v) => ({
            numero: v.numero_comprobante, periodo: v.periodo, proveedor: v.proveedor_nombre || v.proveedor_rif,
            rif: v.proveedor_rif, factura: v.factura_numero, fecha: v.fecha, base: v.base_ves,
            iva: v.iva_ves, retIva: v.ret_iva_ves, retIslr: v.ret_islr_ves, total: v.total_retenido_ves
          }));
          return {
            title: 'Comprobantes de retención', subtitle: 'IVA e ISLR · VES',
            columns: [{ key: 'numero', label: 'Comprobante' }, { key: 'periodo', label: 'Período' }, { key: 'proveedor', label: 'Proveedor' }, { key: 'rif', label: 'RIF' }, { key: 'factura', label: 'Factura' }, { key: 'fecha', label: 'Fecha', type: 'date' }, { key: 'base', label: 'Base VES', type: 'ves' }, { key: 'iva', label: 'IVA VES', type: 'ves' }, { key: 'retIva', label: 'Ret. IVA VES', type: 'ves' }, { key: 'retIslr', label: 'Ret. ISLR VES', type: 'ves' }, { key: 'total', label: 'Total retenido', type: 'ves' }],
            rows,
            totals: { base: rows.reduce((s, r) => s + r.base, 0), iva: rows.reduce((s, r) => s + r.iva, 0), retIva: rows.reduce((s, r) => s + r.retIva, 0), retIslr: rows.reduce((s, r) => s + r.retIslr, 0), total: rows.reduce((s, r) => s + r.total, 0) }
          };
        }
      },
      {
        id: 'iva', title: 'Retenciones de IVA', icon: 'receipt',
        description: 'Retenciones de IVA practicadas a proveedores.',
        build() {
          const rows = db().withholdings.filter((v) => MONEY(v.ret_iva_ves) > 0).map((v) => ({
            numero: v.numero_comprobante, fecha: v.fecha, proveedor: v.proveedor_nombre || v.proveedor_rif, rif: v.proveedor_rif,
            factura: v.factura_numero, base: v.base_ves, iva: v.iva_ves, pct: v.ret_iva_pct, retenido: v.ret_iva_ves
          }));
          return {
            title: 'Retenciones de IVA', subtitle: 'Comprobantes con retención de IVA',
            columns: [{ key: 'numero', label: 'Comprobante' }, { key: 'fecha', label: 'Fecha', type: 'date' }, { key: 'proveedor', label: 'Proveedor' }, { key: 'rif', label: 'RIF' }, { key: 'factura', label: 'Factura' }, { key: 'base', label: 'Base VES', type: 'ves' }, { key: 'iva', label: 'IVA VES', type: 'ves' }, { key: 'pct', label: '% Retención', type: 'pct' }, { key: 'retenido', label: 'Retenido VES', type: 'ves' }],
            rows,
            totals: { base: rows.reduce((s, r) => s + r.base, 0), iva: rows.reduce((s, r) => s + r.iva, 0), retenido: rows.reduce((s, r) => s + r.retenido, 0) }
          };
        }
      },
      {
        id: 'islr', title: 'Retenciones de ISLR', icon: 'file',
        description: 'Retenciones de ISLR según Decreto 1.808.',
        build() {
          const rows = db().withholdings.filter((v) => MONEY(v.ret_islr_ves) > 0).map((v) => ({
            numero: v.numero_comprobante, fecha: v.fecha, proveedor: v.proveedor_nombre || v.proveedor_rif, rif: v.proveedor_rif,
            base: v.base_ves, tarifa: v.ret_islr_tarifa, sustraendo: v.ret_islr_sustraendo_ut, retenido: v.ret_islr_ves
          }));
          return {
            title: 'Retenciones de ISLR', subtitle: 'Decreto 1.808 · VES',
            columns: [{ key: 'numero', label: 'Comprobante' }, { key: 'fecha', label: 'Fecha', type: 'date' }, { key: 'proveedor', label: 'Proveedor' }, { key: 'rif', label: 'RIF' }, { key: 'base', label: 'Base VES', type: 'ves' }, { key: 'tarifa', label: 'Tarifa', type: 'pct' }, { key: 'sustraendo', label: 'Sustraendo UT', type: 'num' }, { key: 'retenido', label: 'Retenido VES', type: 'ves' }],
            rows,
            totals: { base: rows.reduce((s, r) => s + r.base, 0), retenido: rows.reduce((s, r) => s + r.retenido, 0) }
          };
        }
      }
    ],

    payables: [
      {
        id: 'facturas', title: 'Facturas de compra', icon: 'receipt',
        description: 'Detalle de facturas, vencimientos, retenciones y saldos.',
        build() {
          const rows = db().payables.slice().sort((a, b) => b.fecha_emision.localeCompare(a.fecha_emision)).map((p) => ({
            factura: p.numero_factura, control: p.numero_control, proveedor: p.proveedor_rif,
            emision: p.fecha_emision, vence: p.fecha_vencimiento, base: p.base_usd, iva: p.iva_usd,
            igtf: p.igtf_usd, retIva: p.ret_iva_usd, retIslr: p.ret_islr_usd,
            neto: p.neto_pagar_usd, pagado: p.pagado_usd, pendiente: Math.max(0, p.neto_pagar_usd - p.pagado_usd), estatus: p.estatus
          }));
          return {
            title: 'Facturas de compra', subtitle: 'Cuentas por pagar · USD',
            columns: [{ key: 'factura', label: 'Factura' }, { key: 'control', label: 'Control' }, { key: 'proveedor', label: 'RIF' }, { key: 'emision', label: 'Emisión', type: 'date' }, { key: 'vence', label: 'Vence', type: 'date' }, { key: 'base', label: 'Base USD', type: 'usd' }, { key: 'iva', label: 'IVA USD', type: 'usd' }, { key: 'igtf', label: 'IGTF USD', type: 'usd' }, { key: 'retIva', label: 'Ret. IVA USD', type: 'usd' }, { key: 'retIslr', label: 'Ret. ISLR USD', type: 'usd' }, { key: 'neto', label: 'Neto USD', type: 'usd' }, { key: 'pagado', label: 'Pagado USD', type: 'usd' }, { key: 'pendiente', label: 'Pendiente USD', type: 'usd' }, { key: 'estatus', label: 'Estatus' }],
            rows,
            totals: { base: rows.reduce((s, r) => s + r.base, 0), iva: rows.reduce((s, r) => s + r.iva, 0), igtf: rows.reduce((s, r) => s + r.igtf, 0), retIva: rows.reduce((s, r) => s + r.retIva, 0), retIslr: rows.reduce((s, r) => s + r.retIslr, 0), neto: rows.reduce((s, r) => s + r.neto, 0), pagado: rows.reduce((s, r) => s + r.pagado, 0), pendiente: rows.reduce((s, r) => s + r.pendiente, 0) }
          };
        }
      },
      {
        id: 'antiguedad', title: 'Antigüedad de cuentas por pagar', icon: 'clock',
        description: 'Clasificación de saldos pendientes por días de vencimiento.',
        build() {
          const hoy = new Date(NS.store.today() + 'T00:00:00');
          const rows = db().payables.map((p) => {
            const pend = Math.max(0, MONEY(p.neto_pagar_usd) - MONEY(p.pagado_usd));
            const dias = Math.floor((hoy - new Date(p.fecha_vencimiento + 'T00:00:00')) / 86400000);
            const bucket = dias <= 0 ? 'Por vencer' : dias <= 30 ? '1 a 30 días' : dias <= 60 ? '31 a 60 días' : dias <= 90 ? '61 a 90 días' : 'Más de 90 días';
            return { factura: p.numero_factura, proveedor: p.proveedor_rif, vence: p.fecha_vencimiento, dias, bucket, pendiente: pend };
          }).filter((r) => r.pendiente > 0.01);
          return {
            title: 'Antigüedad de cuentas por pagar', subtitle: 'Saldos pendientes por vencimiento',
            columns: [{ key: 'factura', label: 'Factura' }, { key: 'proveedor', label: 'RIF' }, { key: 'vence', label: 'Vencimiento', type: 'date' }, { key: 'dias', label: 'Días', type: 'int' }, { key: 'bucket', label: 'Tramo' }, { key: 'pendiente', label: 'Pendiente USD', type: 'usd' }],
            rows,
            totals: { pendiente: rows.reduce((s, r) => s + r.pendiente, 0) }
          };
        }
      },
      {
        id: 'proveedores', title: 'Maestro de proveedores', icon: 'building',
        description: 'Proveedores con facturas, compras y saldos pendientes.',
        build() {
          const rows = db().suppliers.map((s) => {
            const invs = db().payables.filter((p) => p.proveedor_rif === s.rif);
            return {
              rif: s.rif, proveedor: s.razon_social, tipo: s.tipo_persona, retIva: s.retencion_iva_pct,
              facturas: invs.length, compras: invs.reduce((a, p) => a + MONEY(p.total_usd), 0),
              pendiente: invs.reduce((a, p) => a + Math.max(0, MONEY(p.neto_pagar_usd) - MONEY(p.pagado_usd)), 0),
              estatus: s.estatus || 'Activo'
            };
          });
          return {
            title: 'Maestro de proveedores', subtitle: 'Compras y saldos por proveedor',
            columns: [{ key: 'rif', label: 'RIF' }, { key: 'proveedor', label: 'Razón social' }, { key: 'tipo', label: 'Tipo ISLR' }, { key: 'retIva', label: 'Ret. IVA', type: 'pct' }, { key: 'facturas', label: 'Facturas', type: 'int' }, { key: 'compras', label: 'Compras USD', type: 'usd' }, { key: 'pendiente', label: 'Pendiente USD', type: 'usd' }, { key: 'estatus', label: 'Estatus' }],
            rows,
            totals: { facturas: rows.reduce((s, r) => s + r.facturas, 0), compras: rows.reduce((s, r) => s + r.compras, 0), pendiente: rows.reduce((s, r) => s + r.pendiente, 0) }
          };
        }
      },
      {
        id: 'liquidaciones', title: 'Liquidaciones a conductores', icon: 'moto',
        description: 'Saldos pendientes y datos de pago de la flota.',
        build() {
          const rows = db().drivers.filter((d) => MONEY(d.saldo_por_liquidar_usd) > 0).map((d) => ({
            cedula: d.cedula_rif, conductor: d.nombres + ' ' + d.apellidos, nivel: d.nivel || 'Zafiro',
            banco: d.banco, telefono: d.telefono_pago_movil, cedula_pago: d.cedula_pago_movil, saldo: d.saldo_por_liquidar_usd
          }));
          return {
            title: 'Liquidaciones a conductores', subtitle: 'Saldos por pagar a la flota',
            columns: [{ key: 'cedula', label: 'Cédula' }, { key: 'conductor', label: 'Conductor' }, { key: 'nivel', label: 'Nivel' }, { key: 'banco', label: 'Banco' }, { key: 'telefono', label: 'Pago móvil' }, { key: 'cedula_pago', label: 'Cédula pago móvil' }, { key: 'saldo', label: 'Saldo USD', type: 'usd' }],
            rows,
            totals: { saldo: rows.reduce((s, r) => s + r.saldo, 0) }
          };
        }
      }
    ],

    partners: [
      {
        id: 'cartera', title: 'Cartera de negocios asociados', icon: 'building',
        description: 'Comisiones por cobrar, recaudaciones por pagar y comisión pactada.',
        build() {
          const rows = db().partners.map((p) => ({
            rif: p.rif, negocio: p.razon_social, tipo: p.tipo, comision: p.comision_pct,
            porCobrar: p.saldo_por_cobrar_usd, porPagar: p.saldo_por_pagar_usd,
            movimientos: NS.store.partnerMovements(p.rif).length, estatus: p.estatus
          }));
          return {
            title: 'Cartera de negocios asociados', subtitle: 'Comisiones y recaudaciones · USD',
            columns: [
              { key: 'rif', label: 'RIF' }, { key: 'negocio', label: 'Negocio' }, { key: 'tipo', label: 'Tipo' },
              { key: 'comision', label: 'Comisión', type: 'pct' }, { key: 'porCobrar', label: 'Por cobrar USD', type: 'usd' },
              { key: 'porPagar', label: 'Por pagar USD', type: 'usd' }, { key: 'movimientos', label: 'Movimientos', type: 'int' },
              { key: 'estatus', label: 'Estatus' }
            ],
            rows,
            totals: {
              porCobrar: rows.reduce((s, r) => s + MONEY(r.porCobrar), 0),
              porPagar: rows.reduce((s, r) => s + MONEY(r.porPagar), 0),
              movimientos: rows.reduce((s, r) => s + r.movimientos, 0)
            }
          };
        }
      },
      {
        id: 'movimientos', title: 'Movimientos de asociados', icon: 'activity',
        description: 'Comisiones, cobros, recaudaciones y pagos con su referencia.',
        build() {
          const rows = db().partnerMovements.slice().sort((a, b) => String(b.fecha).localeCompare(String(a.fecha))).map((m) => {
            const p = db().partners.find((x) => x.rif === m.partner_rif);
            return { fecha: m.fecha, rif: m.partner_rif, negocio: p ? p.razon_social : m.partner_rif, tipo: m.tipo, concepto: m.concepto, referencia: m.referencia, monto: m.monto_usd };
          });
          return {
            title: 'Movimientos de asociados', subtitle: 'Historial de cartera · USD',
            columns: [
              { key: 'fecha', label: 'Fecha', type: 'date' }, { key: 'rif', label: 'RIF' }, { key: 'negocio', label: 'Negocio' },
              { key: 'tipo', label: 'Tipo' }, { key: 'concepto', label: 'Concepto' }, { key: 'referencia', label: 'Referencia' },
              { key: 'monto', label: 'Monto USD', type: 'usd' }
            ],
            rows,
            totals: { monto: rows.reduce((s, r) => s + r.monto, 0) }
          };
        }
      }
    ],

    inventory: [
      {
        id: 'catalogo', title: 'Catálogo e inventario', icon: 'package',
        description: 'Productos, precio, costo, stock y valor del inventario.',
        build() {
          const rows = db().products.map((p) => ({
            sku: p.sku, producto: p.nombre, categoria: p.categoria, precio: p.precio_usd, costo: p.costo_usd,
            stock: p.stock, minimo: p.stock_min, valor: MONEY(p.stock) * MONEY(p.costo_usd), activo: p.activo ? 'Sí' : 'No'
          }));
          return {
            title: 'Catálogo e inventario', subtitle: 'Tienda del conductor · USD',
            columns: [
              { key: 'sku', label: 'SKU' }, { key: 'producto', label: 'Producto' }, { key: 'categoria', label: 'Categoría' },
              { key: 'precio', label: 'Precio USD', type: 'usd' }, { key: 'costo', label: 'Costo USD', type: 'usd' },
              { key: 'stock', label: 'Stock', type: 'int' }, { key: 'minimo', label: 'Mínimo', type: 'int' },
              { key: 'valor', label: 'Valor USD', type: 'usd' }, { key: 'activo', label: 'Activo' }
            ],
            rows,
            totals: {
              stock: rows.reduce((s, r) => s + r.stock, 0),
              valor: rows.reduce((s, r) => s + r.valor, 0)
            }
          };
        }
      },
      {
        id: 'financiamientos', title: 'Financiamientos a conductores', icon: 'wallet',
        description: 'Compras a crédito, cuotas, abonos y saldo pendiente por conductor.',
        build() {
          const rows = db().driverCharges.map((c) => {
            const d = db().drivers.find((x) => x.cedula_rif === c.conductor_cedula_rif);
            return {
              fecha: c.fecha, cedula: c.conductor_cedula_rif,
              conductor: d ? d.nombres + ' ' + d.apellidos : c.conductor_cedula_rif,
              producto: c.producto_nombre, cantidad: c.cantidad, total: c.total_usd,
              pagado: c.pagado_usd, saldo: c.saldo_usd, cuotas: c.cuotas, estatus: c.estatus
            };
          });
          return {
            title: 'Financiamientos a conductores', subtitle: 'Cuentas por cobrar de la tienda · USD',
            columns: [
              { key: 'fecha', label: 'Fecha', type: 'date' }, { key: 'cedula', label: 'Cédula' }, { key: 'conductor', label: 'Conductor' },
              { key: 'producto', label: 'Producto' }, { key: 'cantidad', label: 'Cant.', type: 'int' },
              { key: 'total', label: 'Total USD', type: 'usd' }, { key: 'pagado', label: 'Pagado USD', type: 'usd' },
              { key: 'saldo', label: 'Saldo USD', type: 'usd' }, { key: 'cuotas', label: 'Cuotas', type: 'int' }, { key: 'estatus', label: 'Estatus' }
            ],
            rows,
            totals: {
              total: rows.reduce((s, r) => s + r.total, 0),
              pagado: rows.reduce((s, r) => s + r.pagado, 0),
              saldo: rows.reduce((s, r) => s + r.saldo, 0)
            }
          };
        }
      }
    ],

    audit: [
      {
        id: 'bitacora', title: 'Bitácora de auditoría', icon: 'activity',
        description: 'Trazabilidad de acciones por usuario, módulo y fecha.',
        build() {
          const rows = NS.store.getAuditLog().map((a) => ({
            fecha: a.fecha, hora: a.hora, usuario: a.usuario, nombre: a.nombre, rol: a.rol,
            accion: a.accion, modulo: a.modulo, detalle: a.detalle, referencia: a.referencia
          }));
          return {
            title: 'Bitácora de auditoría', subtitle: 'Registro cronológico de cambios',
            columns: [{ key: 'fecha', label: 'Fecha', type: 'date' }, { key: 'hora', label: 'Hora' }, { key: 'usuario', label: 'Usuario' }, { key: 'nombre', label: 'Nombre' }, { key: 'rol', label: 'Rol' }, { key: 'accion', label: 'Acción' }, { key: 'modulo', label: 'Módulo' }, { key: 'detalle', label: 'Detalle' }, { key: 'referencia', label: 'Referencia' }],
            rows
          };
        }
      },
      {
        id: 'usuarios', title: 'Actividad por usuario', icon: 'users',
        description: 'Cantidad de eventos registrados por cada usuario.',
        build() {
          const rows = Array.from(groupBy(NS.store.getAuditLog(), (a) => a.usuario)).map(([usuario, list]) => ({
            usuario, nombre: list[0].nombre, rol: list[0].rol, eventos: list.length,
            ultimo: list[0].fecha + ' ' + list[0].hora
          }));
          return {
            title: 'Actividad por usuario', subtitle: 'Resumen de la bitácora',
            columns: [{ key: 'usuario', label: 'Usuario' }, { key: 'nombre', label: 'Nombre' }, { key: 'rol', label: 'Rol' }, { key: 'eventos', label: 'Eventos', type: 'int' }, { key: 'ultimo', label: 'Último evento' }],
            rows,
            totals: { eventos: rows.reduce((s, r) => s + r.eventos, 0) }
          };
        }
      },
      {
        id: 'modulos', title: 'Eventos por módulo', icon: 'grid',
        description: 'Distribución de la actividad registrada por módulo.',
        build() {
          const rows = Array.from(groupBy(NS.store.getAuditLog(), (a) => a.modulo)).map(([modulo, list]) => ({
            modulo, eventos: list.length, usuarios: new Set(list.map((a) => a.usuario)).size
          }));
          return {
            title: 'Eventos por módulo', subtitle: 'Actividad de auditoría',
            columns: [{ key: 'modulo', label: 'Módulo' }, { key: 'eventos', label: 'Eventos', type: 'int' }, { key: 'usuarios', label: 'Usuarios distintos', type: 'int' }],
            rows,
            totals: { eventos: rows.reduce((s, r) => s + r.eventos, 0) }
          };
        }
      }
    ],

    users: [
      {
        id: 'usuarios', title: 'Usuarios y roles', icon: 'users',
        description: 'Cuentas del sistema, rol asignado y estado de acceso.',
        build() {
          const rows = db().users.map((u) => ({
            usuario: u.usuario, nombre: u.nombre, correo: u.correo, rol: u.rol,
            estado: u.activo ? 'Activo' : 'Inactivo', permisos: u.permisos ? 'Personalizados' : 'Heredados del rol',
            creado: u.created_at
          }));
          return {
            title: 'Usuarios y roles', subtitle: 'Control de acceso del sistema',
            columns: [{ key: 'usuario', label: 'Usuario' }, { key: 'nombre', label: 'Nombre' }, { key: 'correo', label: 'Correo' }, { key: 'rol', label: 'Rol' }, { key: 'estado', label: 'Estado' }, { key: 'permisos', label: 'Permisos' }, { key: 'creado', label: 'Creado', type: 'date' }],
            rows
          };
        }
      },
      {
        id: 'roles', title: 'Roles y permisos', icon: 'shield',
        description: 'Módulos, pestañas y acciones autorizadas por rol.',
        build() {
          const rows = db().roles.map((r) => {
            const perms = r.permisos || {};
            const modules = Object.keys(perms).filter((m) => perms[m] && perms[m].ver);
            const tabs = modules.reduce((s, m) => s + (perms[m].tabs || []).length, 0);
            const actions = modules.reduce((s, m) => s + (perms[m].acciones || []).length, 0);
            return {
              rol: r.nombre, admin: r.admin ? 'Sí' : 'No', usuarios: db().users.filter((u) => u.rol === r.nombre).length,
              modulos: r.admin ? 'Todos' : modules.length,
              pestanas: r.admin ? 'Todas' : tabs,
              acciones: r.admin ? 'Todas' : actions,
              descripcion: r.descripcion
            };
          });
          return {
            title: 'Roles y permisos', subtitle: 'Matriz de acceso',
            columns: [{ key: 'rol', label: 'Rol' }, { key: 'admin', label: 'Admin' }, { key: 'usuarios', label: 'Usuarios', type: 'int' }, { key: 'modulos', label: 'Módulos' }, { key: 'pestanas', label: 'Pestañas' }, { key: 'acciones', label: 'Acciones' }, { key: 'descripcion', label: 'Descripción' }],
            rows
          };
        }
      },
      {
        id: 'matriz', title: 'Matriz de permisos', icon: 'grid',
        description: 'Acceso por módulo para cada rol del sistema.',
        build() {
          const roles = db().roles;
          const rows = Object.keys(NS.store.PERMISSION_CATALOG).map((module) => {
            const row = { modulo: NS.store.PERMISSION_CATALOG[module].label };
            roles.forEach((r) => { row['r_' + r.id] = NS.store.can(r.nombre, module) ? 'Sí' : 'No'; });
            return row;
          });
          return {
            title: 'Matriz de permisos', subtitle: 'Acceso por módulo y rol',
            columns: [{ key: 'modulo', label: 'Módulo' }].concat(roles.map((r) => ({ key: 'r_' + r.id, label: r.nombre }))),
            rows
          };
        }
      }
    ],

    settings: [
      {
        id: 'parametros', title: 'Parámetros del sistema', icon: 'settings',
        description: 'Tasa BCV, parámetros fiscales y estado de almacenamiento.',
        build() {
          const p = db().taxParams;
          const info = NS.store.storageInfo();
          const rows = [
            { parametro: 'Tasa BCV', valor: NS.ui.bs(p.bcvRate), detalle: 'Bs / USD · ' + date(p.bcvUpdatedAt) },
            { parametro: 'IVA general', valor: p.ivaGeneral + '%', detalle: 'Alícuota' },
            { parametro: 'IVA reducido', valor: p.ivaReducido + '%', detalle: 'Alícuota' },
            { parametro: 'IGTF', valor: p.igtf + '%', detalle: 'Alícuota' },
            { parametro: 'Unidad Tributaria', valor: NS.ui.bs(p.ut), detalle: 'VES' },
            { parametro: 'Base local', valor: Math.round(info.dbBytes / 1024) + ' KB', detalle: info.backup ? 'Copia de seguridad disponible' : 'Sin copia de seguridad' },
            { parametro: 'Documentos locales', valor: info.files, detalle: 'IndexedDB' },
            { parametro: 'Último guardado', valor: info.lastSavedAt ? NS.ui.dateTime(info.lastSavedAt) : '—', detalle: 'Local' }
          ];
          return {
            title: 'Parámetros del sistema', subtitle: 'Configuración vigente',
            columns: [{ key: 'parametro', label: 'Parámetro' }, { key: 'valor', label: 'Valor' }, { key: 'detalle', label: 'Detalle' }],
            rows
          };
        }
      }
    ]
  };

  function list(module) { return REPORTS[module] || []; }
  function has(module) { return list(module).length > 0; }

  function button(module) {
    if (!has(module) || !NS.app.canAction(module, 'reportes')) return '';
    const meta = (NS.app.MODULES && NS.app.MODULES[module]) || { label: module };
    return `<button type="button" class="btn btn-ghost" id="module-reports-btn" data-module-reports="${NS.ui.esc(module)}" title="Abrir el centro de reportes de ${NS.ui.esc(meta.label)}">${NS.ui.icon('chart', 16)} Reportes</button>`;
  }

  document.addEventListener('click', (e) => {
    const trigger = e.target && e.target.closest ? e.target.closest('[data-module-reports]') : null;
    if (!trigger) return;
    e.preventDefault();
    open(trigger.dataset.moduleReports);
  });

  function open(module) {
    const built = list(module);
    const customs = customFor(module).map(customDef);
    if (!built.length && !customs.length) return NS.ui.toast('Este módulo no tiene reportes disponibles.', 'info');
    if (!NS.app.canAction(module, 'reportes')) return NS.ui.toast('Tu rol no tiene permiso para abrir reportes en este módulo.', 'warning');
    const meta = (NS.app.MODULES && NS.app.MODULES[module]) || { label: module };
    const isAdmin = NS.session.isAdmin();
    const itemHtml = (r) => {
      const custom = !!r.custom;
      return `<article class="report-item ${custom ? 'report-item-custom' : ''}">
        <span class="report-ico">${NS.ui.icon(r.icon || 'chart', 20)}</span>
        <div class="report-copy"><strong>${NS.ui.esc(r.title)}${custom ? ' <span class="report-custom-badge">Personalizado</span>' : ''}</strong><p>${NS.ui.esc(r.description || '')}</p></div>
        <div class="report-actions">
          ${custom && isAdmin ? `<button class="icon-btn" data-edit-custom="${NS.ui.esc(r.id)}" title="Editar reporte">${NS.ui.icon('edit', 16)}</button>
          <button class="icon-btn danger" data-del-custom="${NS.ui.esc(r.id)}" title="Eliminar reporte">${NS.ui.icon('trash', 16)}</button>` : ''}
          <button class="btn btn-ghost btn-sm" data-report-print="${NS.ui.esc(r.id)}">${NS.ui.icon('print', 14)} Imprimir</button>
          <button class="btn btn-primary btn-sm" data-report-excel="${NS.ui.esc(r.id)}">${NS.ui.icon('download', 14)} Excel</button>
        </div>
      </article>`;
    };
    const all = built.concat(customs);
    const overlay = NS.ui.modal({
      title: 'Reportes · ' + meta.label,
      eyebrow: 'Centro de reportes',
      subtitle: 'Selecciona un reporte para imprimirlo o descargarlo en Excel.',
      size: 'lg',
      body: `${customs.length ? `<div class="report-section-label">${NS.ui.icon('filter', 14)} Reportes personalizados</div>
        <div class="report-list">${customs.map(itemHtml).join('')}</div>` : ''}
        <div class="report-section-label">${NS.ui.icon('chart', 14)} Reportes del módulo</div>
        <div class="report-list">${built.map(itemHtml).join('')}</div>`,
      footer: `${isAdmin ? `<button class="btn btn-ghost" id="custom-report-new">${NS.ui.icon('plus', 14)} Nuevo reporte a la medida</button>` : ''}<button class="btn btn-ghost" data-close-modal>Cerrar</button>`
    });
    overlay.querySelectorAll('[data-report-print]').forEach((btn) => btn.addEventListener('click', () => {
      const rep = all.find((r) => r.id === btn.dataset.reportPrint);
      if (rep) run(module, rep, 'print');
    }));
    overlay.querySelectorAll('[data-report-excel]').forEach((btn) => btn.addEventListener('click', () => {
      const rep = all.find((r) => r.id === btn.dataset.reportExcel);
      if (rep) run(module, rep, 'excel');
    }));
    if (isAdmin) {
      const newBtn = overlay.querySelector('#custom-report-new');
      if (newBtn) newBtn.addEventListener('click', () => openBuilder(module));
      overlay.querySelectorAll('[data-edit-custom]').forEach((btn) => btn.addEventListener('click', () => openBuilder(module, btn.dataset.editCustom)));
      overlay.querySelectorAll('[data-del-custom]').forEach((btn) => btn.addEventListener('click', () => {
        const rep = customs.find((r) => r.id === btn.dataset.delCustom);
        NS.ui.confirm({
          title: 'Eliminar reporte personalizado',
          message: `¿Eliminar el reporte "${rep ? rep.title : btn.dataset.delCustom}"? Esta acción no elimina datos, solo la definición del listado.`,
          confirmText: 'Eliminar', danger: true
        }).then((ok) => {
          if (!ok) return;
          try {
            NS.store.deleteCustomReport(btn.dataset.delCustom);
            NS.ui.toast('Reporte personalizado eliminado.', 'success');
            NS.ui.closeModal(overlay);
            open(module);
          } catch (e) { NS.ui.toast(e.message, 'error'); }
        });
      }));
    }
  }

  /* ------------------ Constructor de reportes a la medida ------------------ */
  function openBuilder(module, reportId) {
    if (!NS.session.isAdmin()) return NS.ui.toast('Solo el administrador puede crear reportes personalizados.', 'warning');
    const existing = reportId ? (db().customReports || []).find((r) => r.id === reportId) : null;
    const modules = Object.values(NS.router.MODULES || {}).map((m) => m.module);
    const overlay = NS.ui.modal({
      title: existing ? 'Editar reporte personalizado' : 'Nuevo reporte a la medida',
      eyebrow: 'Constructor de reportes',
      subtitle: 'Elige la tabla, las columnas y los filtros. El listado se arma con la información almacenada.',
      size: 'lg',
      body: `<form id="custom-report-form" class="form-grid" autocomplete="off">
        <label class="field field-full"><span>Nombre del reporte *</span><input name="nombre" value="${NS.ui.esc(existing ? existing.nombre : '')}" placeholder="Conductores · correo y dirección" required></label>
        <label class="field field-full"><span>Descripción</span><input name="descripcion" value="${NS.ui.esc(existing ? existing.descripcion || '' : '')}" placeholder="Para qué sirve este listado..."></label>
        <label class="field"><span>Módulo del reporte *</span><select name="modulo">${modules.map((m) => {
          const mm = NS.router.MODULES[m];
          return `<option value="${NS.ui.esc(m)}" ${((existing && existing.modulo) || module) === m ? 'selected' : ''}>${NS.ui.esc(mm.label)}</option>`;
        }).join('')}</select></label>
        <label class="field"><span>Tabla base *</span><select name="tabla">${Object.keys(CUSTOM_TABLES).map((k) => `<option value="${NS.ui.esc(k)}" ${((existing && existing.tabla) || defaultTable(module)) === k ? 'selected' : ''}>${NS.ui.esc(CUSTOM_TABLES[k].label)}</option>`).join('')}</select></label>
        <div class="field field-full"><span>Columnas del listado *</span><div class="report-columns" id="custom-columns"></div><small class="block muted">Marca las columnas que quieres ver, imprimir o exportar.</small></div>
        <div class="field field-full"><span>Filtro (opcional)</span><div class="report-filter-row" id="custom-filter-row"></div></div>
        <div class="field field-full"><span>Orden (opcional)</span><div class="report-filter-row" id="custom-order-row"></div></div>
      </form>`,
      footer: `<button class="btn btn-ghost" data-cancel>Cancelar</button><button class="btn btn-primary" id="custom-report-save">${NS.ui.icon('check', 15)} ${existing ? 'Guardar cambios' : 'Crear reporte'}</button>`
    });
    const form = overlay.querySelector('#custom-report-form');
    const colBox = overlay.querySelector('#custom-columns');
    const filterRow = overlay.querySelector('#custom-filter-row');
    const orderRow = overlay.querySelector('#custom-order-row');
    const initialColumns = existing && existing.columnas ? existing.columnas.slice() : [];
    const initialTable = existing ? existing.tabla : defaultTable(module);

    function refreshFields() {
      const tableKey = form.elements.tabla.value;
      const table = tableDef(tableKey);
      const fields = table ? table.fields.map((f) => ({ key: f[0], label: f[1], type: f[2] })) : [];
      const checked = tableKey === initialTable ? initialColumns : [];
      colBox.innerHTML = fields.map((f) => `<label class="check-inline report-col-check"><input type="checkbox" name="columna" value="${NS.ui.esc(f.key)}" ${checked.includes(f.key) ? 'checked' : ''}> ${NS.ui.esc(f.label)}</label>`).join('');
      const options = (selected) => `<option value="">— Ninguno —</option>` + fields.map((f) => `<option value="${NS.ui.esc(f.key)}" ${selected === f.key ? 'selected' : ''}>${NS.ui.esc(f.label)}</option>`).join('');
      filterRow.innerHTML = `<select name="filtro_campo" class="report-filter-field">${options(existing && existing.tabla === tableKey ? existing.filtro_campo : '')}</select>
        <select name="filtro_op" class="report-filter-op">
          <option value="contiene" ${!existing || existing.filtro_op === 'contiene' ? 'selected' : ''}>contiene</option>
          <option value="igual" ${existing && existing.filtro_op === 'igual' ? 'selected' : ''}>igual a</option>
          <option value="mayor" ${existing && existing.filtro_op === 'mayor' ? 'selected' : ''}>mayor que</option>
          <option value="menor" ${existing && existing.filtro_op === 'menor' ? 'selected' : ''}>menor que</option>
        </select>
        <input name="filtro_valor" class="report-filter-value" value="${NS.ui.esc(existing && existing.tabla === tableKey ? existing.filtro_valor || '' : '')}" placeholder="Valor a filtrar">`;
      orderRow.innerHTML = `<select name="orden_campo" class="report-filter-field">${options(existing && existing.tabla === tableKey ? existing.orden_campo : '')}</select>
        <select name="orden_dir" class="report-filter-op">
          <option value="asc" ${!existing || existing.orden_dir !== 'desc' ? 'selected' : ''}>Ascendente</option>
          <option value="desc" ${existing && existing.orden_dir === 'desc' ? 'selected' : ''}>Descendente</option>
        </select>`;
    }
    refreshFields();
    form.elements.tabla.addEventListener('change', refreshFields);
    overlay.querySelector('[data-cancel]').addEventListener('click', () => NS.ui.closeModal(overlay));
    overlay.querySelector('#custom-report-save').addEventListener('click', () => {
      if (!form.reportValidity()) return;
      const columnas = Array.from(form.querySelectorAll('input[name="columna"]:checked')).map((i) => i.value);
      if (!columnas.length) return NS.ui.toast('Selecciona al menos una columna.', 'warning');
      try {
        NS.store.upsertCustomReport({
          id: existing ? existing.id : '',
          modulo: form.elements.modulo.value,
          nombre: form.elements.nombre.value,
          descripcion: form.elements.descripcion.value,
          tabla: form.elements.tabla.value,
          columnas,
          filtro_campo: form.elements.filtro_campo.value,
          filtro_op: form.elements.filtro_op.value,
          filtro_valor: form.elements.filtro_valor.value,
          orden_campo: form.elements.orden_campo.value,
          orden_dir: form.elements.orden_dir.value
        });
        const target = form.elements.modulo.value;
        NS.ui.closeAllModals();
        NS.ui.toast(existing ? 'Reporte personalizado actualizado.' : 'Reporte personalizado creado.', 'success');
        open(target);
      } catch (e) { NS.ui.toast(e.message, 'error'); }
    });
  }

  function run(module, report, action) {
    try {
      const built = report.build();
      if (!built || !built.columns || !built.rows) throw new Error('El reporte no tiene datos configurados.');
      if (action === 'print') printReport(built);
      else excelReport(built);
      NS.store.addAuditLog('reporte', module, `${action === 'print' ? 'Impresión' : 'Exportación Excel'} · ${built.title}`, report.id);
      NS.ui.toast(action === 'print' ? 'Ventana de impresión abierta.' : 'Reporte Excel generado.', 'success');
    } catch (e) {
      NS.errors.fail(e, 'Reporte ' + report.id);
      NS.ui.toast('No se pudo generar el reporte: ' + e.message, 'error');
    }
  }

  NS.reports = { list, has, button, open, run, openBuilder };
})();
