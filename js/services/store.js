/* =========================================================================
   ENVIA ERP · store.js
   Capa de datos local (localStorage), motor contable y datos demo.
   La moneda funcional contable es el Bolívar (VES). Los módulos operativos
   manejan USD y convierten a VES con la tasa BCV parametrizada.
   ========================================================================= */
(function () {
  'use strict';

  const NS = (window.ENVIA = window.ENVIA || {});
  const DB_KEY = 'envia_db_v1';
  const DB_BACKUP_KEY = 'envia_db_v1_backup';
  const PREFS_KEY = 'envia_prefs_v1';
  const FILES_KEY = 'envia_files_v1';

  const round = (n, d = 2) => {
    const f = Math.pow(10, d);
    return Math.round((Number(n) || 0) * f) / f;
  };
  const today = () => new Date().toISOString().slice(0, 10);
  const iso = (daysAgo) => {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    return d.toISOString().slice(0, 10);
  };
  const stamp = () => new Date().toISOString();
  let seq = 0;
  const uid = (p) => `${p}_${Date.now().toString(36)}${(seq++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const norm = (s) => String(s || '').trim();
  const clone = (o) => JSON.parse(JSON.stringify(o));

  /* ------------------------------------------------------------------ *
   *  VALIDACIONES DE ENTRADA (usadas antes de guardar cualquier registro)
   *  ------------------------------------------------------------------ */
  const ID_RE = /^[VEJ]-[0-9]{7,9}$/;
  function normId(v) {
    let s = String(v || '').toUpperCase().replace(/\s+/g, '').replace(/[^VEJ0-9-]/g, '');
    if (!s.includes('-') && /^[VEJ]/.test(s)) s = s[0] + '-' + s.slice(1);
    return s;
  }
  function validId(v) { return ID_RE.test(normId(v)); }
  function idError(v) {
    if (!v) return 'La Cédula / RIF es obligatoria.';
    if (!validId(v)) return 'Formato de Cédula / RIF inválido. Use V-12345678, E-12345678 o J-123456789.';
    return '';
  }
  function validEmail(v) { return !v || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v)); }
  function emailError(v) { return v && !validEmail(v) ? 'El correo electrónico no es válido.' : ''; }
  function validPhone(v) { const d = String(v || '').replace(/\D/g, ''); return d.length >= 10 && d.length <= 13; }
  function phoneError(v) { return v && !validPhone(v) ? 'El teléfono debe tener entre 10 y 13 dígitos.' : ''; }
  function money(n, campo) {
    const x = Number(n);
    if (!isFinite(x) || x < 0) throw new Error((campo || 'El monto') + ' debe ser un número válido igual o mayor a cero.');
    return round(x);
  }
  function moneyPositive(n, campo) {
    const x = money(n, campo);
    if (x <= 0) throw new Error((campo || 'El monto') + ' debe ser mayor a cero.');
    return x;
  }
  function required(v, campo) {
    if (v == null || String(v).trim() === '') throw new Error((campo || 'El campo') + ' es obligatorio.');
    return String(v).trim();
  }
  function accountCodeValid(codigo) { return /^[0-9]+(\.[0-9]+)*$/.test(String(codigo || '')); }

  /* ------------------------------------------------------------------ *
   *  CATÁLOGOS BASE
   * ------------------------------------------------------------------ */
  const ACTION_LABELS = {
    ver: 'Ver / consultar',
    crear: 'Crear',
    editar: 'Editar',
    eliminar: 'Eliminar',
    exportar: 'Exportar',
    imprimir: 'Imprimir',
    reportes: 'Centro de reportes',
    billetera: 'Billetera / recargas',
    documentos: 'Gestionar documentos',
    liquidar: 'Registrar liquidaciones',
    pagar: 'Registrar pagos',
    cobrar: 'Registrar cobros',
    movimientos: 'Registrar movimientos',
    asignar: 'Asignar productos / financiar',
    roles: 'Administrar roles y permisos'
  };

  const PERMISSION_CATALOG = {
    dashboard: {
      label: 'Dashboard', group: 'Operación', icon: 'dashboard',
      tabs: [], actions: ['ver', 'exportar', 'imprimir', 'reportes']
    },
    services: {
      label: 'Servicios', group: 'Operación', icon: 'route',
      tabs: [], actions: ['ver', 'crear', 'editar', 'eliminar', 'exportar', 'imprimir', 'reportes']
    },
    clients: {
      label: 'Clientes', group: 'Maestros', icon: 'users',
      tabs: [], actions: ['ver', 'crear', 'editar', 'eliminar', 'billetera', 'documentos', 'exportar', 'imprimir', 'reportes']
    },
    drivers: {
      label: 'Conductores y Flota', group: 'Maestros', icon: 'car',
      tabs: [], actions: ['ver', 'crear', 'editar', 'eliminar', 'documentos', 'liquidar', 'tarifa_plana', 'exportar', 'imprimir', 'reportes']
    },
    partners: {
      label: 'Negocios Asociados', group: 'Operación', icon: 'building',
      tabs: [], actions: ['ver', 'crear', 'editar', 'eliminar', 'movimientos', 'cobrar', 'pagar', 'exportar', 'imprimir', 'reportes']
    },
    inventory: {
      label: 'Tienda & Inventario', group: 'Operación', icon: 'package',
      tabs: [], actions: ['ver', 'crear', 'editar', 'eliminar', 'asignar', 'cobrar', 'exportar', 'imprimir', 'reportes']
    },
    accounting: {
      label: 'Contabilidad', group: 'Finanzas', icon: 'book',
      tabs: [
        { id: 'entries', label: 'Asientos' },
        { id: 'accounts', label: 'Plan de cuentas' },
        { id: 'rules', label: 'Reglas automáticas' },
        { id: 'journal', label: 'Libro Diario' },
        { id: 'ledger', label: 'Libro Mayor' },
        { id: 'trial', label: 'Balance de Comprobación' },
        { id: 'balance', label: 'Balance General' },
        { id: 'income', label: 'Estado de Resultados' },
        { id: 'sales', label: 'Libro de Ventas' },
        { id: 'purchases', label: 'Libro de Compras' }
      ],
      actions: ['ver', 'crear', 'editar', 'eliminar', 'exportar', 'imprimir', 'reportes']
    },
    taxes: {
      label: 'Tributos & BCV', group: 'Finanzas', icon: 'percent',
      tabs: [], actions: ['ver', 'editar', 'exportar', 'imprimir', 'reportes']
    },
    payables: {
      label: 'Cuentas por Pagar', group: 'Finanzas', icon: 'wallet',
      tabs: [
        { id: 'invoices', label: 'Facturas de compra' },
        { id: 'suppliers', label: 'Maestro de proveedores' },
        { id: 'settlements', label: 'Liquidaciones a conductores' }
      ],
      actions: ['ver', 'crear', 'editar', 'eliminar', 'pagar', 'exportar', 'imprimir', 'reportes']
    },
    audit: {
      label: 'Bitácora de Auditoría', group: 'Sistema', icon: 'activity',
      tabs: [], actions: ['ver', 'exportar', 'imprimir', 'reportes']
    },
    users: {
      label: 'Usuarios del sistema', group: 'Sistema', icon: 'shield',
      tabs: [], actions: ['ver', 'crear', 'editar', 'eliminar', 'roles', 'exportar', 'imprimir', 'reportes']
    },
    settings: {
      label: 'Configuración del Sistema', group: 'Sistema', icon: 'database',
      tabs: [], actions: ['ver', 'editar', 'reportes', 'parametros']
    }
  };

  function allPermissions() {
    const out = {};
    Object.keys(PERMISSION_CATALOG).forEach((key) => {
      const meta = PERMISSION_CATALOG[key];
      out[key] = { ver: true, tabs: (meta.tabs || []).map((t) => t.id), acciones: ['*'] };
    });
    return out;
  }

  function permissionsForModules(modules, actions) {
    const out = {};
    modules.forEach((key) => {
      const meta = PERMISSION_CATALOG[key];
      if (!meta) return;
      out[key] = {
        ver: true,
        tabs: (meta.tabs || []).map((t) => t.id),
        acciones: actions.slice()
      };
    });
    return out;
  }

  function defaultRoles() {
    return clone([
      {
        id: 'role_superadmin', nombre: 'SuperAdmin', icono: 'shield', admin: true, sistema: true,
        descripcion: 'Acceso ilimitado a todos los módulos, configuración, usuarios y sincronización.',
        permisos: allPermissions()
      },
      {
        id: 'role_contador', nombre: 'Contador / Fiscal', icono: 'book', admin: false, sistema: true,
        descripcion: 'Contabilidad, tributos, libros SENIAT, cuentas por pagar y maestros.',
        permisos: permissionsForModules(
          ['dashboard', 'services', 'clients', 'drivers', 'partners', 'inventory', 'accounting', 'taxes', 'payables'],
          ['ver', 'crear', 'editar', 'eliminar', 'exportar', 'imprimir', 'reportes', 'documentos', 'liquidar', 'pagar', 'cobrar', 'movimientos', 'asignar', 'billetera']
        )
      },
      {
        id: 'role_tesorero', nombre: 'Tesorero / Cuentas por Pagar', icono: 'wallet', admin: false, sistema: true,
        descripcion: 'Pagos, proveedores, liquidaciones, maestros y consulta tributaria.',
        permisos: permissionsForModules(
          ['dashboard', 'services', 'clients', 'drivers', 'partners', 'inventory', 'payables', 'taxes'],
          ['ver', 'crear', 'editar', 'eliminar', 'exportar', 'imprimir', 'reportes', 'documentos', 'liquidar', 'pagar', 'cobrar', 'movimientos', 'asignar', 'billetera']
        )
      },
      {
        id: 'role_auditor', nombre: 'Auditor / Operaciones', icono: 'eye', admin: false, sistema: true,
        descripcion: 'Consulta de todos los módulos financieros y operativos en modo solo lectura.',
        permisos: permissionsForModules(
          ['dashboard', 'services', 'clients', 'drivers', 'partners', 'inventory', 'accounting', 'taxes', 'payables'],
          ['ver', 'exportar', 'imprimir', 'reportes']
        )
      }
    ]);
  }

  const PAYMENT_METHODS = ['Pago Móvil', 'Efectivo USD', 'Zelle', 'Tarjeta', 'Wallet'];
  const VEHICLE_TYPES = ['Moto Delivery', 'Moto Taxi', 'Vehículo Sedán', 'Camioneta Carga'];
  /* Niveles comerciales de la flota: Zafiro (entrada), Esmeralda (intermedio), Diamante (alto desempeño). */
  const DRIVER_LEVELS = ['Zafiro', 'Esmeralda', 'Diamante'];
  const CLIENT_STATUS = ['Activo', 'Corporativo', 'Suspendido', 'Pendiente de Verificación'];
  const DRIVER_STATUS = ['Activo / Disponible', 'En Servicio', 'En Revisión Documental', 'Inactivo por Documentos Vencidos', 'Suspendido'];
  const PARTNER_TYPES = ['Restaurante', 'Farmacia', 'Comercio', 'Delivery', 'Servicio', 'Otro'];
  const PRODUCT_CATEGORIES = ['Uniforme', 'Equipamiento', 'Seguridad', 'Accesorio'];
  const PARTNER_MOVEMENT_TYPES = {
    comision: { label: 'Comisión por cobrar', sign: 1 },
    cobro: { label: 'Cobro recibido', sign: -1 },
    recaudacion: { label: 'Recaudación por pagar', sign: 1 },
    pago: { label: 'Pago al negocio', sign: -1 },
    ajuste: { label: 'Ajuste', sign: 0 }
  };

  const ACCOUNT_LEVELS = ['Grupo', 'Subgrupo', 'Rubro', 'Cuenta de Movimiento'];

  const DEFAULT_TAX = {
    bcvRate: 78.45,
    bcvUpdatedAt: today(),
    ivaGeneral: 16,
    ivaReducido: 8,
    igtf: 3,
    ut: 90,
    currency: 'USD'
  };

  const ISLR_TARIFFS = {
    PN_RES: { label: 'Persona Natural Residente', tarifa: 3, sustraendoUT: 10 },
    PJ_DOM: { label: 'Persona Jurídica Domiciliada', tarifa: 5, sustraendoUT: 0 },
    PN_NORES: { label: 'Persona Natural No Residente', tarifa: 34, sustraendoUT: 0 },
    PJ_NODOM: { label: 'Persona Jurídica No Domiciliada', tarifa: 34, sustraendoUT: 0 }
  };

  const DEFAULT_RULES = [
    {
      evento: 'traslado',
      nombre: 'Carrera de taxi / traslado',
      cuenta_debe: '1.1.1.02',
      cuenta_haber: '4.1.1.01',
      cuenta_iva: '2.1.2.01',
      cuenta_igtf: '2.1.2.02',
      activo: true,
      descripcion: 'Ingreso por servicio de traslado cobrado al cliente'
    },
    {
      evento: 'encomienda',
      nombre: 'Envío de encomienda / delivery',
      cuenta_debe: '1.1.1.02',
      cuenta_haber: '4.1.2.01',
      cuenta_iva: '2.1.2.01',
      cuenta_igtf: '2.1.2.02',
      activo: true,
      descripcion: 'Ingreso por encomienda cobrada al cliente'
    },
    {
      evento: 'recarga_wallet',
      nombre: 'Recarga de Wallet (USD)',
      cuenta_debe: '1.1.1.03',
      cuenta_haber: '2.1.3.01',
      cuenta_iva: '',
      cuenta_igtf: '',
      activo: true,
      descripcion: 'Abono a billetera virtual del cliente en dólares'
    },
    {
      evento: 'recarga_wallet_ves',
      nombre: 'Recarga de Wallet (VES)',
      cuenta_debe: '1.1.1.02',
      cuenta_haber: '2.1.3.02',
      cuenta_iva: '',
      cuenta_igtf: '',
      activo: true,
      descripcion: 'Abono a billetera virtual del cliente en bolívares'
    },
    {
      evento: 'liquidacion_conductor',
      nombre: 'Liquidación a conductor',
      cuenta_debe: '5.1.1.01',
      cuenta_haber: '2.1.1.02',
      cuenta_iva: '',
      cuenta_igtf: '',
      activo: true,
      descripcion: 'Costo de flota y cuenta por pagar al conductor'
    },
    {
      evento: 'compra_proveedor',
      nombre: 'Factura de compra a proveedor',
      cuenta_debe: '6.1.1.03',
      cuenta_haber: '2.1.1.01',
      cuenta_iva: '1.1.4.01',
      cuenta_igtf: '1.1.5.01',
      activo: true,
      descripcion: 'Gasto / costo con IVA crédito fiscal e IGTF'
    },
    {
      evento: 'pago_proveedor',
      nombre: 'Pago a proveedor o conductor',
      cuenta_debe: '2.1.1.01',
      cuenta_haber: '1.1.1.02',
      cuenta_iva: '',
      cuenta_igtf: '',
      activo: true,
      descripcion: 'Cancelación de cuentas por pagar'
    },
    {
      evento: 'comision_asociado',
      nombre: 'Comisión por cobrar a negocio asociado',
      cuenta_debe: '1.1.2.03',
      cuenta_haber: '4.2.1.02',
      cuenta_iva: '',
      cuenta_igtf: '',
      activo: true,
      descripcion: 'Ingreso por comisión de pedidos gestionados para un negocio asociado'
    },
    {
      evento: 'cobro_asociado',
      nombre: 'Cobro de comisión a negocio asociado',
      cuenta_debe: '1.1.1.02',
      cuenta_haber: '1.1.2.03',
      cuenta_iva: '',
      cuenta_igtf: '',
      activo: true,
      descripcion: 'Cobro recibido del negocio asociado, reduce la cuenta por cobrar'
    },
    {
      evento: 'recaudacion_asociado',
      nombre: 'Recaudación recibida por cuenta de negocio asociado',
      cuenta_debe: '1.1.1.01',
      cuenta_haber: '2.1.1.03',
      cuenta_iva: '',
      cuenta_igtf: '',
      activo: true,
      descripcion: 'Efectivo cobrado al cliente final que pertenece al negocio asociado'
    },
    {
      evento: 'pago_asociado',
      nombre: 'Pago a negocio asociado',
      cuenta_debe: '2.1.1.03',
      cuenta_haber: '1.1.1.02',
      cuenta_iva: '',
      cuenta_igtf: '',
      activo: true,
      descripcion: 'Entrega de recaudaciones al negocio asociado'
    },
    {
      evento: 'venta_tienda_conductor',
      nombre: 'Venta financiada de artículo a conductor',
      cuenta_debe: '1.1.2.02',
      cuenta_haber: '4.2.1.03',
      cuenta_iva: '',
      cuenta_igtf: '',
      activo: true,
      descripcion: 'Cuenta por cobrar al conductor por uniforme o equipamiento financiado'
    },
    {
      evento: 'costo_tienda_conductor',
      nombre: 'Costo del artículo entregado al conductor',
      cuenta_debe: '5.2.2.01',
      cuenta_haber: '1.1.6.01',
      cuenta_iva: '',
      cuenta_igtf: '',
      activo: true,
      descripcion: 'Descarga del inventario por la entrega física del artículo'
    }
  ];

  const ACCOUNTS = [
    { codigo: '1', nombre: 'ACTIVOS', nivel: 'Grupo', naturaleza: 'Deudora', moneda: 'VES' },
    { codigo: '1.1', nombre: 'Activo Corriente', nivel: 'Subgrupo', naturaleza: 'Deudora', moneda: 'VES' },
    { codigo: '1.1.1', nombre: 'Disponible', nivel: 'Rubro', naturaleza: 'Deudora', moneda: 'VES' },
    { codigo: '1.1.1.01', nombre: 'Caja General VES', nivel: 'Cuenta de Movimiento', naturaleza: 'Deudora', moneda: 'VES' },
    { codigo: '1.1.1.02', nombre: 'Banco Mercantil · Cta. Corriente VES', nivel: 'Cuenta de Movimiento', naturaleza: 'Deudora', moneda: 'VES' },
    { codigo: '1.1.1.03', nombre: 'Banco Banesco · Cta. Corriente USD', nivel: 'Cuenta de Movimiento', naturaleza: 'Deudora', moneda: 'USD' },
    { codigo: '1.1.1.04', nombre: 'Pago Móvil / Caja Chica', nivel: 'Cuenta de Movimiento', naturaleza: 'Deudora', moneda: 'VES' },
    { codigo: '1.1.2', nombre: 'Cuentas por Cobrar', nivel: 'Rubro', naturaleza: 'Deudora', moneda: 'VES' },
    { codigo: '1.1.2.01', nombre: 'Cuentas por Cobrar Clientes', nivel: 'Cuenta de Movimiento', naturaleza: 'Deudora', moneda: 'VES' },
    { codigo: '1.1.2.02', nombre: 'Cuentas por Cobrar Conductores', nivel: 'Cuenta de Movimiento', naturaleza: 'Deudora', moneda: 'VES' },
    { codigo: '1.1.4', nombre: 'Impuestos a Favor', nivel: 'Rubro', naturaleza: 'Deudora', moneda: 'VES' },
    { codigo: '1.1.4.01', nombre: 'IVA Crédito Fiscal', nivel: 'Cuenta de Movimiento', naturaleza: 'Deudora', moneda: 'VES' },
    { codigo: '1.1.5', nombre: 'Tributos Pagados', nivel: 'Rubro', naturaleza: 'Deudora', moneda: 'VES' },
    { codigo: '1.1.5.01', nombre: 'IGTF Pagado', nivel: 'Cuenta de Movimiento', naturaleza: 'Deudora', moneda: 'VES' },
    { codigo: '2', nombre: 'PASIVOS', nivel: 'Grupo', naturaleza: 'Acreedora', moneda: 'VES' },
    { codigo: '2.1', nombre: 'Pasivo Corriente', nivel: 'Subgrupo', naturaleza: 'Acreedora', moneda: 'VES' },
    { codigo: '2.1.1', nombre: 'Cuentas por Pagar', nivel: 'Rubro', naturaleza: 'Acreedora', moneda: 'VES' },
    { codigo: '2.1.1.01', nombre: 'Cuentas por Pagar Proveedores', nivel: 'Cuenta de Movimiento', naturaleza: 'Acreedora', moneda: 'VES' },
    { codigo: '2.1.1.02', nombre: 'Cuentas por Pagar Conductores (Liquidaciones)', nivel: 'Cuenta de Movimiento', naturaleza: 'Acreedora', moneda: 'VES' },
    { codigo: '2.1.2', nombre: 'Impuestos por Pagar', nivel: 'Rubro', naturaleza: 'Acreedora', moneda: 'VES' },
    { codigo: '2.1.2.01', nombre: 'IVA por Pagar', nivel: 'Cuenta de Movimiento', naturaleza: 'Acreedora', moneda: 'VES' },
    { codigo: '2.1.2.02', nombre: 'IGTF por Pagar', nivel: 'Cuenta de Movimiento', naturaleza: 'Acreedora', moneda: 'VES' },
    { codigo: '2.1.2.03', nombre: 'ISLR por Pagar (Retenciones)', nivel: 'Cuenta de Movimiento', naturaleza: 'Acreedora', moneda: 'VES' },
    { codigo: '2.1.2.04', nombre: 'Retenciones de IVA por Pagar', nivel: 'Cuenta de Movimiento', naturaleza: 'Acreedora', moneda: 'VES' },
    { codigo: '2.1.3', nombre: 'Wallet Clientes', nivel: 'Rubro', naturaleza: 'Acreedora', moneda: 'VES' },
    { codigo: '2.1.3.01', nombre: 'Saldo Wallet Clientes USD', nivel: 'Cuenta de Movimiento', naturaleza: 'Acreedora', moneda: 'USD' },
    { codigo: '2.1.3.02', nombre: 'Saldo Wallet Clientes VES', nivel: 'Cuenta de Movimiento', naturaleza: 'Acreedora', moneda: 'VES' },
    { codigo: '3', nombre: 'PATRIMONIO', nivel: 'Grupo', naturaleza: 'Acreedora', moneda: 'VES' },
    { codigo: '3.1', nombre: 'Capital y Resultados', nivel: 'Subgrupo', naturaleza: 'Acreedora', moneda: 'VES' },
    { codigo: '3.1.1', nombre: 'Capital Social', nivel: 'Rubro', naturaleza: 'Acreedora', moneda: 'VES' },
    { codigo: '3.1.1.01', nombre: 'Capital Social Suscrito y Pagado', nivel: 'Cuenta de Movimiento', naturaleza: 'Acreedora', moneda: 'VES' },
    { codigo: '3.1.2', nombre: 'Resultados', nivel: 'Rubro', naturaleza: 'Acreedora', moneda: 'VES' },
    { codigo: '3.1.2.01', nombre: 'Resultados Acumulados', nivel: 'Cuenta de Movimiento', naturaleza: 'Acreedora', moneda: 'VES' },
    { codigo: '3.1.3.01', nombre: 'Resultado del Ejercicio', nivel: 'Cuenta de Movimiento', naturaleza: 'Acreedora', moneda: 'VES' },
    { codigo: '4', nombre: 'INGRESOS', nivel: 'Grupo', naturaleza: 'Acreedora', moneda: 'VES' },
    { codigo: '4.1', nombre: 'Ingresos Operativos', nivel: 'Subgrupo', naturaleza: 'Acreedora', moneda: 'VES' },
    { codigo: '4.1.1', nombre: 'Ingresos por Traslados', nivel: 'Rubro', naturaleza: 'Acreedora', moneda: 'VES' },
    { codigo: '4.1.1.01', nombre: 'Ingresos por Carreras (Taxi)', nivel: 'Cuenta de Movimiento', naturaleza: 'Acreedora', moneda: 'VES' },
    { codigo: '4.1.2', nombre: 'Ingresos por Encomiendas', nivel: 'Rubro', naturaleza: 'Acreedora', moneda: 'VES' },
    { codigo: '4.1.2.01', nombre: 'Ingresos por Delivery / Encomiendas', nivel: 'Cuenta de Movimiento', naturaleza: 'Acreedora', moneda: 'VES' },
    { codigo: '4.1.3', nombre: 'Comisiones', nivel: 'Rubro', naturaleza: 'Acreedora', moneda: 'VES' },
    { codigo: '4.1.3.01', nombre: 'Comisión Neta ENVIA', nivel: 'Cuenta de Movimiento', naturaleza: 'Acreedora', moneda: 'VES' },
    { codigo: '4.2', nombre: 'Otros Ingresos', nivel: 'Subgrupo', naturaleza: 'Acreedora', moneda: 'VES' },
    { codigo: '4.2.1.01', nombre: 'Ingresos por Publicidad', nivel: 'Cuenta de Movimiento', naturaleza: 'Acreedora', moneda: 'VES' },
    { codigo: '5', nombre: 'COSTOS', nivel: 'Grupo', naturaleza: 'Deudora', moneda: 'VES' },
    { codigo: '5.1', nombre: 'Costos de Flota', nivel: 'Subgrupo', naturaleza: 'Deudora', moneda: 'VES' },
    { codigo: '5.1.1', nombre: 'Costos de Conductores', nivel: 'Rubro', naturaleza: 'Deudora', moneda: 'VES' },
    { codigo: '5.1.1.01', nombre: 'Costo Liquidación Conductores', nivel: 'Cuenta de Movimiento', naturaleza: 'Deudora', moneda: 'VES' },
    { codigo: '5.1.1.02', nombre: 'Combustible y Mantenimiento', nivel: 'Cuenta de Movimiento', naturaleza: 'Deudora', moneda: 'VES' },
    { codigo: '5.2', nombre: 'Costos de Plataforma', nivel: 'Subgrupo', naturaleza: 'Deudora', moneda: 'VES' },
    { codigo: '5.2.1.01', nombre: 'Comisiones Pasarela / Procesamiento', nivel: 'Cuenta de Movimiento', naturaleza: 'Deudora', moneda: 'VES' },
    { codigo: '6', nombre: 'GASTOS', nivel: 'Grupo', naturaleza: 'Deudora', moneda: 'VES' },
    { codigo: '6.1', nombre: 'Gastos Operativos', nivel: 'Subgrupo', naturaleza: 'Deudora', moneda: 'VES' },
    { codigo: '6.1.1', nombre: 'Gastos de Personal', nivel: 'Rubro', naturaleza: 'Deudora', moneda: 'VES' },
    { codigo: '6.1.1.01', nombre: 'Sueldos y Salarios', nivel: 'Cuenta de Movimiento', naturaleza: 'Deudora', moneda: 'VES' },
    { codigo: '6.1.1.03', nombre: 'Compras y Suministros', nivel: 'Cuenta de Movimiento', naturaleza: 'Deudora', moneda: 'VES' },
    { codigo: '6.1.2', nombre: 'Gastos Generales', nivel: 'Rubro', naturaleza: 'Deudora', moneda: 'VES' },
    { codigo: '6.1.2.01', nombre: 'Alquiler de Oficina', nivel: 'Cuenta de Movimiento', naturaleza: 'Deudora', moneda: 'VES' },
    { codigo: '6.1.2.02', nombre: 'Servicios Públicos', nivel: 'Cuenta de Movimiento', naturaleza: 'Deudora', moneda: 'VES' },
    { codigo: '6.1.2.03', nombre: 'Publicidad y Marketing', nivel: 'Cuenta de Movimiento', naturaleza: 'Deudora', moneda: 'VES' },
    { codigo: '6.1.2.04', nombre: 'Honorarios Profesionales', nivel: 'Cuenta de Movimiento', naturaleza: 'Deudora', moneda: 'VES' },
    { codigo: '6.1.2.05', nombre: 'Gastos Bancarios', nivel: 'Cuenta de Movimiento', naturaleza: 'Deudora', moneda: 'VES' },
    { codigo: '6.1.2.06', nombre: 'Repuestos, Lubricantes y Mantenimiento', nivel: 'Cuenta de Movimiento', naturaleza: 'Deudora', moneda: 'VES' },
    /* --- Negocios asociados, tienda del conductor e inventario --- */
    { codigo: '1.1.2.03', nombre: 'Cuentas por Cobrar Negocios Asociados', nivel: 'Cuenta de Movimiento', naturaleza: 'Deudora', moneda: 'VES' },
    { codigo: '1.1.6', nombre: 'Inventario de Artículos', nivel: 'Rubro', naturaleza: 'Deudora', moneda: 'VES' },
    { codigo: '1.1.6.01', nombre: 'Inventario de Artículos y Uniformes', nivel: 'Cuenta de Movimiento', naturaleza: 'Deudora', moneda: 'VES' },
    { codigo: '2.1.1.03', nombre: 'Cuentas por Pagar Negocios Asociados', nivel: 'Cuenta de Movimiento', naturaleza: 'Acreedora', moneda: 'VES' },
    { codigo: '4.2.1.02', nombre: 'Ingresos por Negocios Asociados (Comisiones)', nivel: 'Cuenta de Movimiento', naturaleza: 'Acreedora', moneda: 'VES' },
    { codigo: '4.2.1.03', nombre: 'Ingresos por Tienda del Conductor', nivel: 'Cuenta de Movimiento', naturaleza: 'Acreedora', moneda: 'VES' },
    { codigo: '5.2.2', nombre: 'Costo de Artículos y Uniformes', nivel: 'Subgrupo', naturaleza: 'Deudora', moneda: 'VES' },
    { codigo: '5.2.2.01', nombre: 'Costo de Artículos y Uniformes', nivel: 'Cuenta de Movimiento', naturaleza: 'Deudora', moneda: 'VES' }
  ].map((a) => ({
    ...a,
    id: 'cta_' + a.codigo.replace(/\./g, '_'),
    estado: 'Activa',
    created_at: stamp()
  }));

  /* ------------------------------------------------------------------ *
   *  SEED · CLIENTES
   * ------------------------------------------------------------------ */
  function seedClients() {
    return [
      {
        cedula_rif: 'V-19654872', nombres: 'Jesús Alberto', apellidos: 'Mendoza Quintero',
        telefono: '0414-555-0673', correo: 'jesus.mendoza@gmail.com',
        direccion: 'Urb. La Trinidad, Av. Principal, Res. Villa Hermosa, Apto 5-A, Baruta, Municipio Baruta, Estado Miranda',
        saldo_wallet_usd: 63.4, saldo_wallet_ves: 2450.0, total_carreras: 31, total_encomiendas: 8,
        estatus: 'Activo', fecha_registro: iso(190),
        url_foto_cedula: 'demo://cliente/V-19654872/cedula',
        url_foto_rif: 'demo://cliente/V-19654872/rif'
      },
      {
        cedula_rif: 'V-15876543', nombres: 'Carlos Eduardo', apellidos: 'Pérez Marcano',
        telefono: '0414-555-0927', correo: 'carlos.perez@gmail.com',
        direccion: 'Urb. Los Chaguaramos, Av. Los Ilustres, Res. Humboldt, Apto 4-B, Caracas, Municipio Libertador, Distrito Capital',
        saldo_wallet_usd: 1099.5, saldo_wallet_ves: 3200.0, total_carreras: 14, total_encomiendas: 2,
        estatus: 'Activo', fecha_registro: iso(180),
        url_foto_cedula: 'demo://cliente/V-15876543/cedula',
        url_foto_rif: 'demo://cliente/V-15876543/rif'
      },
      {
        cedula_rif: 'J-401234567', nombres: 'Corporación', apellidos: 'TeleViajes C.A.',
        telefono: '0212-555-7711', correo: 'compras@televiajes.com.ve',
        direccion: 'Av. Francisco de Miranda, Torre Europa, Piso 12, Los Palos Grandes, Municipio Chacao, Estado Miranda',
        saldo_wallet_usd: 350.0, saldo_wallet_ves: 12500.0, total_carreras: 112, total_encomiendas: 64,
        estatus: 'Corporativo', fecha_registro: iso(320),
        url_foto_cedula: 'demo://cliente/J-401234567/cedula',
        url_foto_rif: 'demo://cliente/J-401234567/rif'
      },
      {
        cedula_rif: 'V-21456789', nombres: 'Andrea Sofía', apellidos: 'González Rivas',
        telefono: '0424-555-0316', correo: 'andrea.gonzalez@gmail.com',
        direccion: 'Calle 72 con Av. 3H, Quinta Ana María, Maracaibo, Municipio Maracaibo, Estado Zulia',
        saldo_wallet_usd: 18.75, saldo_wallet_ves: 900.0, total_carreras: 22, total_encomiendas: 9,
        estatus: 'Pendiente de Verificación', fecha_registro: iso(16),
        url_foto_cedula: 'demo://cliente/V-21456789/cedula',
        url_foto_rif: ''
      },
      {
        cedula_rif: 'E-84500211', nombres: 'Luis Enrique', apellidos: 'Márquez Salas',
        telefono: '0416-555-0488', correo: 'luis.marquez@hotmail.com',
        direccion: 'Av. Bolívar Norte, Res. Don Bosco, Torre B, Apto 3-A, Valencia, Municipio Valencia, Estado Carabobo',
        saldo_wallet_usd: 0, saldo_wallet_ves: 450.0, total_carreras: 7, total_encomiendas: 1,
        estatus: 'Activo', fecha_registro: iso(96),
        url_foto_cedula: 'demo://cliente/E-84500211/cedula',
        url_foto_rif: 'demo://cliente/E-84500211/rif'
      },
      {
        cedula_rif: 'J-409876543', nombres: 'Inversiones', apellidos: 'La Guaira C.A.',
        telefono: '0212-555-3300', correo: 'admin@inversioneslaguaira.com',
        direccion: 'Av. Soublette, Edificio Puerta del Mar, Piso 3, La Guaira, Municipio Vargas, Estado La Guaira',
        saldo_wallet_usd: 120.0, saldo_wallet_ves: 6800.0, total_carreras: 56, total_encomiendas: 41,
        estatus: 'Corporativo', fecha_registro: iso(400),
        url_foto_cedula: 'demo://cliente/J-409876543/cedula',
        url_foto_rif: 'demo://cliente/J-409876543/rif'
      },
      {
        cedula_rif: 'V-26789012', nombres: 'Daniela Valentina', apellidos: 'Rivas Torres',
        telefono: '0412-555-7766', correo: 'daniela.rivas@gmail.com',
        direccion: 'Urb. El Trigal, Calle 140, Quinta Los Cedros, Barquisimeto, Municipio Iribarren, Estado Lara',
        saldo_wallet_usd: 7.25, saldo_wallet_ves: 300.0, total_carreras: 11, total_encomiendas: 3,
        estatus: 'Activo', fecha_registro: iso(74),
        url_foto_cedula: 'demo://cliente/V-26789012/cedula',
        url_foto_rif: ''
      },
      {
        cedula_rif: 'V-13456789', nombres: 'Pedro Jesús', apellidos: 'Herrera Linares',
        telefono: '0414-555-1199', correo: 'pedro.herrera@gmail.com',
        direccion: 'Calle Sucre, Casa 24, Sector Centro, Maracay, Municipio Girardot, Estado Aragua',
        saldo_wallet_usd: 0, saldo_wallet_ves: 0, total_carreras: 3, total_encomiendas: 0,
        estatus: 'Suspendido', fecha_registro: iso(140),
        url_foto_cedula: 'demo://cliente/V-13456789/cedula',
        url_foto_rif: 'demo://cliente/V-13456789/rif'
      },
      {
        cedula_rif: 'V-23987654', nombres: 'Gabriela Alejandra', apellidos: 'Mora Castro',
        telefono: '0416-555-2244', correo: 'gabriela.mora@gmail.com',
        direccion: 'Av. Universidad, Res. Parque Tamanaco, Torre 2, Apto 9-C, Caracas, Municipio Baruta, Estado Miranda',
        saldo_wallet_usd: 25.0, saldo_wallet_ves: 1200.0, total_carreras: 19, total_encomiendas: 5,
        estatus: 'Activo', fecha_registro: iso(52),
        url_foto_cedula: 'demo://cliente/V-23987654/cedula',
        url_foto_rif: 'demo://cliente/V-23987654/rif'
      },
      {
        cedula_rif: 'V-17234567', nombres: 'Ricardo José', apellidos: 'Aponte Silva',
        telefono: '0424-555-6633', correo: 'ricardo.aponte@gmail.com',
        direccion: 'Calle 5, Quinta El Paraíso, Sector Las Mercedes, Puerto la Cruz, Municipio Sotillo, Estado Anzoátegui',
        saldo_wallet_usd: 15.0, saldo_wallet_ves: 750.0, total_carreras: 9, total_encomiendas: 2,
        estatus: 'Activo', fecha_registro: iso(65),
        url_foto_cedula: 'demo://cliente/V-17234567/cedula',
        url_foto_rif: ''
      }
    ].map((c) => ({ ...c, created_at: stamp(), updated_at: stamp() }));
  }

  /* ------------------------------------------------------------------ *
   *  SEED · CONDUCTORES
   * ------------------------------------------------------------------ */
  function seedDrivers() {
    return [
      {
        cedula_rif: 'V-16874321', nombres: 'Carlos Luis', apellidos: 'Pérez Marcano',
        telefono: '0412-555-7788', correo: 'carlos.driver@envia.com.ve',
        direccion: 'Urb. Los Chaguaramos, Av. Los Ilustres, Res. Humboldt, Apto 4-B, Caracas, Distrito Capital',
        tipo_servicio: 'Moto Delivery', placa: 'AB123CD', marca: 'Italika', modelo: '250', anio: 2022, color: 'Rojo',
        banco: 'Banesco', telefono_pago_movil: '0412-555-7788', cedula_pago_movil: 'V-16874321',
        cuenta_bancaria: '0134-0021-71-0171234567', porcentaje_comision: 20,
        saldo_por_liquidar_usd: 186.4, estatus_conductor: 'Activo / Disponible', fecha_registro: iso(280),
        url_foto_cedula: 'demo://conductor/V-16874321/cedula',
        url_foto_rif: 'demo://conductor/V-16874321/rif',
        url_foto_licencia: 'demo://conductor/V-16874321/licencia',
        url_carnet_circulacion: 'demo://conductor/V-16874321/circulacion',
        urls_fotos_vehiculo: ['demo://vehiculo/AB123CD/frontal', 'demo://vehiculo/AB123CD/lateral', 'demo://vehiculo/AB123CD/placa'],
        docs_estado: { cedula: 'Aprobado', rif: 'Aprobado', licencia: 'Aprobado', circulacion: 'Aprobado', vehiculo: 'Aprobado' }
      },
      {
        cedula_rif: 'V-19234567', nombres: 'Luis Alberto', apellidos: 'Márquez Salas',
        telefono: '0414-555-3311', correo: 'luis.driver@envia.com.ve',
        direccion: 'Av. Bolívar Norte, Res. Don Bosco, Torre B, Apto 3-A, Valencia, Municipio Valencia, Estado Carabobo',
        tipo_servicio: 'Vehículo Sedán', placa: 'AC456EF', marca: 'Toyota', modelo: 'Corolla', anio: 2019, color: 'Blanco',
        banco: 'Mercantil', telefono_pago_movil: '0414-555-3311', cedula_pago_movil: 'V-19234567',
        cuenta_bancaria: '0105-0087-21-0176543210', porcentaje_comision: 18,
        saldo_por_liquidar_usd: 94.2, estatus_conductor: 'En Servicio', fecha_registro: iso(240),
        url_foto_cedula: 'demo://conductor/V-19234567/cedula',
        url_foto_rif: 'demo://conductor/V-19234567/rif',
        url_foto_licencia: 'demo://conductor/V-19234567/licencia',
        url_carnet_circulacion: 'demo://conductor/V-19234567/circulacion',
        urls_fotos_vehiculo: ['demo://vehiculo/AC456EF/frontal', 'demo://vehiculo/AC456EF/lateral', 'demo://vehiculo/AC456EF/placa'],
        docs_estado: { cedula: 'Aprobado', rif: 'Aprobado', licencia: 'Aprobado', circulacion: 'Aprobado', vehiculo: 'Aprobado' }
      },
      {
        cedula_rif: 'V-20345678', nombres: 'Jhonny Alexander', apellidos: 'Suárez Blanco',
        telefono: '0424-555-8822', correo: 'jhonny.driver@envia.com.ve',
        direccion: 'Calle 72 con Av. 3H, Quinta Ana María, Maracaibo, Municipio Maracaibo, Estado Zulia',
        tipo_servicio: 'Moto Taxi', placa: 'AD789GH', marca: 'Bera', modelo: 'BR-150', anio: 2021, color: 'Negro',
        banco: 'Provincial', telefono_pago_movil: '0424-555-8822', cedula_pago_movil: 'V-20345678',
        cuenta_bancaria: '0108-0012-34-0187654321', porcentaje_comision: 22,
        saldo_por_liquidar_usd: 58.9, estatus_conductor: 'Activo / Disponible', fecha_registro: iso(190),
        url_foto_cedula: 'demo://conductor/V-20345678/cedula',
        url_foto_rif: 'demo://conductor/V-20345678/rif',
        url_foto_licencia: 'demo://conductor/V-20345678/licencia',
        url_carnet_circulacion: 'demo://conductor/V-20345678/circulacion',
        urls_fotos_vehiculo: ['demo://vehiculo/AD789GH/frontal', 'demo://vehiculo/AD789GH/lateral'],
        docs_estado: { cedula: 'Aprobado', rif: 'Aprobado', licencia: 'Aprobado', circulacion: 'Pendiente', vehiculo: 'Pendiente' }
      },
      {
        cedula_rif: 'V-22109876', nombres: 'María Gabriela', apellidos: 'Torres Méndez',
        telefono: '0412-555-4400', correo: 'gabriela.driver@envia.com.ve',
        direccion: 'Av. Universidad, Res. Parque Tamanaco, Torre 2, Apto 9-C, Caracas, Municipio Baruta, Estado Miranda',
        tipo_servicio: 'Vehículo Sedán', placa: 'AE012IJ', marca: 'Hyundai', modelo: 'Accent', anio: 2020, color: 'Gris',
        banco: 'BDV', telefono_pago_movil: '0412-555-4400', cedula_pago_movil: 'V-22109876',
        cuenta_bancaria: '0102-0001-23-0198765432', porcentaje_comision: 20,
        saldo_por_liquidar_usd: 71.5, estatus_conductor: 'Activo / Disponible', fecha_registro: iso(155),
        url_foto_cedula: 'demo://conductor/V-22109876/cedula',
        url_foto_rif: 'demo://conductor/V-22109876/rif',
        url_foto_licencia: 'demo://conductor/V-22109876/licencia',
        url_carnet_circulacion: 'demo://conductor/V-22109876/circulacion',
        urls_fotos_vehiculo: ['demo://vehiculo/AE012IJ/frontal', 'demo://vehiculo/AE012IJ/lateral', 'demo://vehiculo/AE012IJ/placa'],
        docs_estado: { cedula: 'Aprobado', rif: 'Aprobado', licencia: 'Aprobado', circulacion: 'Aprobado', vehiculo: 'Aprobado' }
      },
      {
        cedula_rif: 'V-18765432', nombres: 'José Gregorio', apellidos: 'Rondón Ibarra',
        telefono: '0416-555-9955', correo: 'jose.driver@envia.com.ve',
        direccion: 'Urb. El Trigal, Calle 140, Quinta Los Cedros, Barquisimeto, Municipio Iribarren, Estado Lara',
        tipo_servicio: 'Camioneta Carga', placa: 'AF345KL', marca: 'Ford', modelo: 'Ranger', anio: 2021, color: 'Azul',
        banco: 'Banesco', telefono_pago_movil: '0416-555-9955', cedula_pago_movil: 'V-18765432',
        cuenta_bancaria: '0134-0045-67-0112345678', porcentaje_comision: 15,
        saldo_por_liquidar_usd: 210.0, estatus_conductor: 'En Servicio', fecha_registro: iso(310),
        url_foto_cedula: 'demo://conductor/V-18765432/cedula',
        url_foto_rif: 'demo://conductor/V-18765432/rif',
        url_foto_licencia: 'demo://conductor/V-18765432/licencia',
        url_carnet_circulacion: 'demo://conductor/V-18765432/circulacion',
        urls_fotos_vehiculo: ['demo://vehiculo/AF345KL/frontal', 'demo://vehiculo/AF345KL/lateral', 'demo://vehiculo/AF345KL/placa'],
        docs_estado: { cedula: 'Aprobado', rif: 'Aprobado', licencia: 'Aprobado', circulacion: 'Aprobado', vehiculo: 'Aprobado' }
      },
      {
        cedula_rif: 'V-17456789', nombres: 'Ana Isabel', apellidos: 'Colmenares Ríos',
        telefono: '0424-555-1177', correo: 'ana.driver@envia.com.ve',
        direccion: 'Av. Soublette, Edificio Puerta del Mar, Piso 3, La Guaira, Municipio Vargas, Estado La Guaira',
        tipo_servicio: 'Moto Delivery', placa: 'AG678MN', marca: 'Yamaha', modelo: 'FZ 250', anio: 2023, color: 'Azul',
        banco: 'Mercantil', telefono_pago_movil: '0424-555-1177', cedula_pago_movil: 'V-17456789',
        cuenta_bancaria: '0105-0011-22-0134567890', porcentaje_comision: 20,
        saldo_por_liquidar_usd: 33.25, estatus_conductor: 'En Revisión Documental', fecha_registro: iso(22),
        url_foto_cedula: 'demo://conductor/V-17456789/cedula',
        url_foto_rif: 'demo://conductor/V-17456789/rif',
        url_foto_licencia: 'demo://conductor/V-17456789/licencia',
        url_carnet_circulacion: '',
        urls_fotos_vehiculo: ['demo://vehiculo/AG678MN/frontal'],
        docs_estado: { cedula: 'Aprobado', rif: 'Aprobado', licencia: 'Rechazado', circulacion: 'Pendiente', vehiculo: 'Pendiente' }
      },
      {
        cedula_rif: 'V-19876543', nombres: 'Miguel Ángel', apellidos: 'Quintero Páez',
        telefono: '0414-555-5522', correo: 'miguel.driver@envia.com.ve',
        direccion: 'Calle Sucre, Casa 24, Sector Centro, Maracay, Municipio Girardot, Estado Aragua',
        tipo_servicio: 'Moto Taxi', placa: 'AH901OP', marca: 'Empire', modelo: 'Owen 150', anio: 2020, color: 'Rojo',
        banco: 'Provincial', telefono_pago_movil: '0414-555-5522', cedula_pago_movil: 'V-19876543',
        cuenta_bancaria: '0108-0043-21-0145678901', porcentaje_comision: 25,
        saldo_por_liquidar_usd: 0, estatus_conductor: 'Suspendido', fecha_registro: iso(130),
        url_foto_cedula: 'demo://conductor/V-19876543/cedula',
        url_foto_rif: 'demo://conductor/V-19876543/rif',
        url_foto_licencia: 'demo://conductor/V-19876543/licencia',
        url_carnet_circulacion: 'demo://conductor/V-19876543/circulacion',
        urls_fotos_vehiculo: ['demo://vehiculo/AH901OP/frontal'],
        docs_estado: { cedula: 'Aprobado', rif: 'Aprobado', licencia: 'Aprobado', circulacion: 'Aprobado', vehiculo: 'Aprobado' }
      },
      {
        cedula_rif: 'V-20987654', nombres: 'Yorman David', apellidos: 'Villegas Rojas',
        telefono: '0412-555-8866', correo: 'yorman.driver@envia.com.ve',
        direccion: 'Av. Bolívar, Res. Los Samanes, Torre A, Apto 2-D, San Cristóbal, Municipio San Cristóbal, Estado Táchira',
        tipo_servicio: 'Vehículo Sedán', placa: 'AI234QR', marca: 'Chevrolet', modelo: 'Onix', anio: 2022, color: 'Plata',
        banco: 'Banesco', telefono_pago_movil: '0412-555-8866', cedula_pago_movil: 'V-20987654',
        cuenta_bancaria: '0134-0078-90-0123456789', porcentaje_comision: 18,
        saldo_por_liquidar_usd: 47.8, estatus_conductor: 'Activo / Disponible', fecha_registro: iso(88),
        url_foto_cedula: 'demo://conductor/V-20987654/cedula',
        url_foto_rif: 'demo://conductor/V-20987654/rif',
        url_foto_licencia: 'demo://conductor/V-20987654/licencia',
        url_carnet_circulacion: 'demo://conductor/V-20987654/circulacion',
        urls_fotos_vehiculo: ['demo://vehiculo/AI234QR/frontal', 'demo://vehiculo/AI234QR/lateral', 'demo://vehiculo/AI234QR/placa'],
        docs_estado: { cedula: 'Aprobado', rif: 'Aprobado', licencia: 'Aprobado', circulacion: 'Aprobado', vehiculo: 'Aprobado' }
      }
    ].map((d) => {
      const niveles = {
        'V-16874321': 'Diamante',
        'V-19234567': 'Esmeralda',
        'V-20345678': 'Zafiro',
        'V-22109876': 'Esmeralda',
        'V-18765432': 'Diamante',
        'V-17456789': 'Zafiro',
        'V-19876543': 'Zafiro',
        'V-20987654': 'Esmeralda'
      };
      const hoy = new Date();
      const addYear = (base, years) => {
        const d2 = new Date(base.getTime());
        d2.setFullYear(d2.getFullYear() + years);
        return d2.toISOString().slice(0, 10);
      };
      const emision = iso(300);
      return {
        ...d,
        nivel: niveles[d.cedula_rif] || 'Zafiro',
        url_seguro_rcv: d.url_seguro_rcv || ('demo://conductor/' + d.cedula_rif + '/rcv'),
        docs_estado: { ...(d.docs_estado || {}), rcv: (d.docs_estado && d.docs_estado.rcv) || 'Aprobado' },
        docs_meta: d.docs_meta || {
          cedula: { emision, vencimiento: addYear(new Date(emision + 'T12:00:00'), 10), origen: 'manual' },
          rif: { emision, vencimiento: addYear(new Date(emision + 'T12:00:00'), 2), origen: 'manual' },
          licencia: { emision, vencimiento: addYear(new Date(emision + 'T12:00:00'), 3), origen: 'manual' },
          circulacion: d.cedula_rif === 'V-20345678'
            ? { emision: iso(355), vencimiento: iso(-12), origen: 'manual' }
            : { emision, vencimiento: addYear(new Date(emision + 'T12:00:00'), 1), origen: 'manual' },
          rcv: d.cedula_rif === 'V-20987654'
            ? { emision: iso(370), vencimiento: iso(5), origen: 'manual' }
            : { emision, vencimiento: addYear(new Date(emision + 'T12:00:00'), 1), origen: 'manual' }
        },
        created_at: stamp(),
        updated_at: stamp()
      };
    });
  }

  /* ------------------------------------------------------------------ *
   *  SEED · PROVEEDORES
   * ------------------------------------------------------------------ */
  function seedSuppliers() {
    return [
      {
        rif: 'J-301234567', razon_social: 'Repuestos El Rápido C.A.', telefono: '0212-555-4400',
        correo: 'ventas@repuestoselrapido.com', retencion_iva_pct: 75, tipo_persona: 'PJ_DOM',
        direccion: 'Av. Nueva Granada, Galpón 14, Caracas, Municipio Libertador, Distrito Capital',
        actividad: 'Repuestos y accesorios para vehículos', estatus: 'Activo'
      },
      {
        rif: 'J-405678901', razon_social: 'Lubricantes Vía C.A.', telefono: '0241-555-2200',
        correo: 'administracion@lubricantesvia.com', retencion_iva_pct: 100, tipo_persona: 'PJ_DOM',
        direccion: 'Zona Industrial Municipal Norte, Calle 4, Galpón 22, Valencia, Estado Carabobo',
        actividad: 'Lubricantes y filtros', estatus: 'Activo'
      },
      {
        rif: 'V-14567890', razon_social: 'Juan Carlos Mecánica Integral', telefono: '0414-555-6677',
        correo: 'jc.mecanica@gmail.com', retencion_iva_pct: 75, tipo_persona: 'PN_RES',
        direccion: 'Calle 9, Taller 3, Sector La California, Caracas, Municipio Sucre, Estado Miranda',
        actividad: 'Mantenimiento preventivo y correctivo', estatus: 'Activo'
      },
      {
        rif: 'J-412345678', razon_social: 'Seguros La Movilidad C.A.', telefono: '0212-555-9000',
        correo: 'siniestros@lamovilidad.com.ve', retencion_iva_pct: 100, tipo_persona: 'PJ_DOM',
        direccion: 'Torre Seguros, Piso 6, Av. Andrés Bello, Caracas, Municipio Libertador, Distrito Capital',
        actividad: 'Seguros de flota y responsabilidad civil', estatus: 'Activo'
      },
      {
        rif: 'J-298765432', razon_social: 'Publicidad Caracas C.A.', telefono: '0212-555-1122',
        correo: 'medios@publicidadcaracas.com', retencion_iva_pct: 75, tipo_persona: 'PJ_DOM',
        direccion: 'Av. Venezuela, Torre Mercantil, Piso 4, El Rosal, Caracas, Municipio Chacao, Estado Miranda',
        actividad: 'Publicidad digital y vallas', estatus: 'Activo'
      }
    ].map((s) => ({ ...s, created_at: stamp(), updated_at: stamp() }));
  }

  /* ------------------------------------------------------------------ *
   *  SEED · NEGOCIOS ASOCIADOS (comercios aliados)
   * ------------------------------------------------------------------ */
  function seedPartners() {
    return [
      { rif: 'J-401112223', razon_social: 'Panadería La Espiga C.A.', tipo: 'Restaurante', contacto: 'María Pérez', telefono: '0212-555-7788', correo: 'pedidos@laespiga.com.ve', direccion: 'Av. Francisco de Miranda, Local 4, Los Palos Grandes, Caracas', comision_pct: 12, saldo_por_cobrar_usd: 86.4, saldo_por_pagar_usd: 0, estatus: 'Activo', notas: 'Pedidos de desayuno y panadería con delivery ENVIA.' },
      { rif: 'J-402223334', razon_social: 'Farmacia Salud Total C.A.', tipo: 'Farmacia', contacto: 'Carlos Rivas', telefono: '0212-555-9900', correo: 'delivery@saludtotal.com.ve', direccion: 'Av. Libertador, Torre Exterior, Chacao, Caracas', comision_pct: 10, saldo_por_cobrar_usd: 0, saldo_por_pagar_usd: 240.5, estatus: 'Activo', notas: 'Recaudación de medicamentos cobrados en efectivo.' },
      { rif: 'J-403334445', razon_social: 'Market Express 24 C.A.', tipo: 'Comercio', contacto: 'Ana Gómez', telefono: '0414-555-2200', correo: 'operaciones@marketexpress.com', direccion: 'Av. Casanova, Local 12, Sabana Grande, Caracas', comision_pct: 15, saldo_por_cobrar_usd: 132.8, saldo_por_pagar_usd: 0, estatus: 'Activo', notas: 'Compras de última milla en horario nocturno.' },
      { rif: 'J-404445556', razon_social: 'Pizzería Don Nino C.A.', tipo: 'Restaurante', contacto: 'Giuseppe Nino', telefono: '0212-555-3311', correo: 'pedidos@donnino.com.ve', direccion: 'Calle Madrid, Quinta Don Nino, Las Mercedes, Caracas', comision_pct: 14, saldo_por_cobrar_usd: 48.0, saldo_por_pagar_usd: 0, estatus: 'Activo', notas: 'Convenio de delivery con comisión por pedido.' },
      { rif: 'J-405556667', razon_social: 'Servicios Eléctricos Voltios C.A.', tipo: 'Servicio', contacto: 'Pedro Salas', telefono: '0424-555-6677', correo: 'contacto@voltios.com.ve', direccion: 'Av. Sucre, Galpón 8, Catia, Caracas', comision_pct: 8, saldo_por_cobrar_usd: 0, saldo_por_pagar_usd: 0, estatus: 'Inactivo', notas: 'Convenio pausado hasta renovación de contrato.' }
    ].map((p) => ({ ...p, created_at: stamp(), updated_at: stamp() }));
  }

  /* ------------------------------------------------------------------ *
   *  SEED · TIENDA DEL CONDUCTOR (inventario)
   * ------------------------------------------------------------------ */
  function seedProducts() {
    return [
      { sku: 'BOL-DEL-001', nombre: 'Bolso Delivery', categoria: 'Equipamiento', precio_usd: 80, costo_usd: 52, stock: 38, stock_min: 6, activo: true, descripcion: 'Bolso térmico impermeable con capacidad de 40 L.' },
      { sku: 'FRA-ML-001', nombre: 'Franela manga larga tipo chemis', categoria: 'Uniforme', precio_usd: 25, costo_usd: 14, stock: 120, stock_min: 20, activo: true, descripcion: 'Franela institucional manga larga, tela de secado rápido.' },
      { sku: 'CAS-PER-001', nombre: 'Casco personalizado', categoria: 'Seguridad', precio_usd: 50, costo_usd: 31, stock: 24, stock_min: 8, activo: true, descripcion: 'Casco certificado con identidad visual ENVIA.' },
      { sku: 'SEG-RCV-001', nombre: 'Seguro RCV', categoria: 'Seguridad', precio_usd: 25, costo_usd: 18, stock: 200, stock_min: 25, activo: true, descripcion: 'Cobertura de responsabilidad civil de vehículos (RCV) por período.' },
      { sku: 'CHA-COR-001', nombre: 'Chaqueta cortaviento', categoria: 'Uniforme', precio_usd: 50, costo_usd: 29, stock: 32, stock_min: 10, activo: true, descripcion: 'Chaqueta cortaviento con logos reflectivos.' },
      { sku: 'POR-CEL-001', nombre: 'Portacelular', categoria: 'Accesorio', precio_usd: 25, costo_usd: 11, stock: 60, stock_min: 12, activo: true, descripcion: 'Soporte de manubrio para celular, resistente al agua.' }
    ].map((p) => ({ ...p, id: 'prd_' + p.sku.toLowerCase(), created_at: stamp(), updated_at: stamp() }));
  }

  function seedPartnerMovements() {
    const hoy = today();
    return [
      { id: uid('pmv'), partner_rif: 'J-401112223', tipo: 'comision', concepto: 'Comisión de 14 pedidos de la semana', monto_usd: 86.4, fecha: iso(6), referencia: 'ASOC-ESPIGA-01', created_at: stamp() },
      { id: uid('pmv'), partner_rif: 'J-403334445', tipo: 'comision', concepto: 'Comisión de 22 pedidos nocturnos', monto_usd: 132.8, fecha: iso(4), referencia: 'ASOC-MARKET-01', created_at: stamp() },
      { id: uid('pmv'), partner_rif: 'J-404445556', tipo: 'comision', concepto: 'Comisión de 8 pedidos fin de semana', monto_usd: 48.0, fecha: iso(2), referencia: 'ASOC-NINO-01', created_at: stamp() },
      { id: uid('pmv'), partner_rif: 'J-402223334', tipo: 'recaudacion', concepto: 'Efectivo recaudado por medicamentos a domicilio', monto_usd: 240.5, fecha: iso(3), referencia: 'ASOC-SALUD-01', created_at: stamp() },
      { id: uid('pmv'), partner_rif: 'J-403334445', tipo: 'cobro', concepto: 'Cobro parcial de comisión', monto_usd: 0, fecha: hoy, referencia: 'ASOC-MARKET-02', created_at: stamp() }
    ];
  }

  /* ------------------------------------------------------------------ *
   *  SEED · CARTERA DEL CONDUCTOR (financiamientos de tienda)
   * ------------------------------------------------------------------ */
  function seedDriverCharges() {
    const mk = (cedula, sku, cantidad, cuotas, fecha) => {
      const product = seedProducts().find((p) => p.sku === sku);
      const total = round(product.precio_usd * cantidad);
      return {
        id: uid('dchg'), conductor_cedula_rif: cedula, producto_sku: sku, producto_nombre: product.nombre,
        cantidad, precio_unit_usd: product.precio_usd, total_usd: total, cuotas,
        cuota_usd: round(total / cuotas), saldo_usd: total, pagado_usd: 0,
        fecha, estatus: 'Vigente', created_at: stamp(), updated_at: stamp()
      };
    };
    return [
      mk('V-16874321', 'BOL-DEL-001', 1, 4, iso(25)),
      mk('V-16874321', 'CAS-PER-001', 1, 2, iso(18)),
      mk('V-20345678', 'CHA-COR-001', 1, 4, iso(12)),
      mk('V-19234567', 'FRA-ML-001', 2, 1, iso(9))
    ];
  }

  function seedDriverMovements(services, charges) {
    const out = [];
    (services || []).forEach((s) => {
      out.push({
        id: uid('dmv'), conductor_cedula_rif: s.conductor_cedula_rif, tipo: 'ganancia',
        concepto: 'Ganancia por ' + (s.tipo === 'carrera' ? 'carrera' : 'encomienda') + ' ' + s.id,
        monto_usd: round(s.base_usd), fecha: s.fecha, referencia: s.id, created_at: stamp()
      });
      out.push({
        id: uid('dmv'), conductor_cedula_rif: s.conductor_cedula_rif, tipo: 'comision',
        concepto: 'Comisión ENVIA (' + s.comision_pct + '%) · ' + s.id,
        monto_usd: -round(s.comision_usd), fecha: s.fecha, referencia: s.id, created_at: stamp()
      });
    });
    (charges || []).forEach((c) => {
      out.push({
        id: uid('dmv'), conductor_cedula_rif: c.conductor_cedula_rif, tipo: 'producto',
        concepto: 'Financiamiento ' + c.producto_nombre + ' · ' + c.cuotas + ' cuota(s)',
        monto_usd: -round(c.total_usd), fecha: c.fecha, referencia: c.id, created_at: stamp()
      });
    });
    out.sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
    return out;
  }

  /* ------------------------------------------------------------------ *
   *  SEED · SERVICIOS
   * ------------------------------------------------------------------ */
  function seedServices() {
    const rows = [
      { tipo: 'carrera', cliente: 'V-19654872', conductor: 'V-19234567', dias: 0, origen: 'Torre Delta, Chacao', destino: 'Aeropuerto Internacional Maiquetía', km: 28.4, min: 42, base: 18.5, iva: 16, metodo: 'Pago Móvil' },
      { tipo: 'encomienda', cliente: 'J-401234567', conductor: 'V-16874321', dias: 0, origen: 'Los Palos Grandes', destino: 'Torre Europa, Chacao', km: 4.2, min: 18, base: 6.75, iva: 16, metodo: 'Wallet' },
      { tipo: 'carrera', cliente: 'V-15876543', conductor: 'V-22109876', dias: 0, origen: 'Los Chaguaramos', destino: 'Centro Comercial Sambil Chacao', km: 9.8, min: 26, base: 8.4, iva: 16, metodo: 'Efectivo USD' },
      { tipo: 'encomienda', cliente: 'J-409876543', conductor: 'V-17456789', dias: 1, origen: 'La Guaira, Puerto', destino: 'Catia La Mar', km: 12.5, min: 34, base: 11.2, iva: 16, metodo: 'Pago Móvil' },
      { tipo: 'carrera', cliente: 'V-23987654', conductor: 'V-18765432', dias: 1, origen: 'Parque Tamanaco', destino: 'Hotel Tamanaco', km: 3.1, min: 12, base: 4.5, iva: 16, metodo: 'Zelle' },
      { tipo: 'carrera', cliente: 'V-21456789', conductor: 'V-20345678', dias: 2, origen: 'Maracaibo, Bella Vista', destino: 'Aeropuerto La Chinita', km: 21.7, min: 38, base: 14.0, iva: 0, metodo: 'Pago Móvil' },
      { tipo: 'encomienda', cliente: 'V-26789012', conductor: 'V-16874321', dias: 2, origen: 'Barquisimeto, El Trigal', destino: 'C.C. Las Trinitarias', km: 7.4, min: 22, base: 5.9, iva: 16, metodo: 'Wallet' },
      { tipo: 'carrera', cliente: 'J-401234567', conductor: 'V-20987654', dias: 3, origen: 'Torre Europa', destino: 'Hilton Caracas', km: 6.2, min: 19, base: 7.2, iva: 16, metodo: 'Tarjeta' },
      { tipo: 'encomienda', cliente: 'V-19654872', conductor: 'V-17456789', dias: 4, origen: 'Chacao', destino: 'Los Ruices', km: 5.8, min: 20, base: 4.8, iva: 16, metodo: 'Pago Móvil' },
      { tipo: 'carrera', cliente: 'V-17234567', conductor: 'V-19876543', dias: 5, origen: 'Puerto La Cruz', destino: 'Lechería', km: 17.3, min: 30, base: 12.6, iva: 16, metodo: 'Efectivo USD' },
      { tipo: 'carrera', cliente: 'V-13456789', conductor: 'V-20345678', dias: 6, origen: 'Maracay, Centro', destino: 'C.C. Parque Aragua', km: 8.9, min: 24, base: 6.9, iva: 16, metodo: 'Pago Móvil' },
      { tipo: 'encomienda', cliente: 'J-409876543', conductor: 'V-16874321', dias: 7, origen: 'La Guaira, Plaza', destino: 'Maiquetía', km: 6.6, min: 21, base: 5.2, iva: 16, metodo: 'Zelle' },
      { tipo: 'carrera', cliente: 'V-23987654', conductor: 'V-22109876', dias: 8, origen: 'Baruta', destino: 'C.C. Tolón', km: 4.8, min: 17, base: 4.95, iva: 16, metodo: 'Wallet' },
      { tipo: 'carrera', cliente: 'V-15876543', conductor: 'V-19234567', dias: 10, origen: 'Los Chaguaramos', destino: 'La Castellana', km: 8.1, min: 23, base: 7.6, iva: 16, metodo: 'Tarjeta' },
      { tipo: 'encomienda', cliente: 'V-21456789', conductor: 'V-18765432', dias: 12, origen: 'Maracaibo, Centro', destino: 'San Francisco', km: 14.2, min: 33, base: 9.4, iva: 16, metodo: 'Pago Móvil' },
      { tipo: 'carrera', cliente: 'V-19654872', conductor: 'V-20987654', dias: 14, origen: 'Chacao', destino: 'Universidad Metropolitana', km: 11.5, min: 29, base: 9.8, iva: 16, metodo: 'Wallet' }
    ];
    return rows.map((r, i) => {
      const base = round(r.base);
      const iva = round(base * (r.iva / 100));
      const igtfPct = ['Efectivo USD', 'Zelle'].includes(r.metodo) ? 3 : 0;
      const igtf = round((base + iva) * (igtfPct / 100));
      const total = round(base + iva + igtf);
      const drv = seedDrivers().find((d) => d.cedula_rif === r.conductor);
      const comPct = drv ? drv.porcentaje_comision : 20;
      const comision = round(base * (comPct / 100));
      return {
        id: 'SRV-2026-' + String(1050 + i),
        tipo: r.tipo,
        cliente_cedula_rif: r.cliente,
        conductor_cedula_rif: r.conductor,
        fecha: iso(r.dias),
        origen: r.origen,
        destino: r.destino,
        distancia_km: r.km,
        duracion_min: r.min,
        base_usd: base,
        iva_pct: r.iva,
        iva_usd: iva,
        igtf_pct: igtfPct,
        igtf_usd: igtf,
        total_usd: total,
        comision_pct: comPct,
        comision_usd: comision,
        pago_conductor_usd: round(base - comision),
        metodo_pago: r.metodo,
        estatus: 'Completado',
        factura_numero: 'FAC-' + String(202600 + i),
        control_numero: '00-' + String(4500 + i),
        notas: r.tipo === 'carrera' ? 'Servicio completado y calificado con 5 estrellas.' : 'Encomienda entregada en destino.',
        created_at: stamp()
      };
    });
  }

  /* ------------------------------------------------------------------ *
   *  MOTOR CONTABLE · utilidades
   * ------------------------------------------------------------------ */
  function islrRate(tipo) {
    return (current.taxParams.islrTariffs && current.taxParams.islrTariffs[tipo]) || ISLR_TARIFFS.PJ_DOM;
  }

  function computePayable(input) {
    const base = round(input.base_usd);
    const exento = round(input.exento_usd || 0);
    const ivaPct = Number(input.iva_pct ?? 16);
    const igtfPct = Number(input.igtf_pct ?? 3);
    const tasa = Number(input.tasa_bcv || current.taxParams.bcvRate);
    const iva = round((base + exento) * (ivaPct / 100));
    const igtf = round((base + exento + iva) * (igtfPct / 100));
    const retIvaPct = Number(input.ret_iva_pct ?? 75);
    const retIva = round(iva * (retIvaPct / 100));
    const rate = islrRate(input.tipo_persona || 'PJ_DOM');
    const baseVes = round(base * tasa);
    const sustraendo = round((rate.sustraendoUT || 0) * Number(current.taxParams.ut || 0));
    const retIslrVes = Math.max(0, round(baseVes * (rate.tarifa / 100) - sustraendo));
    const retIslr = round(retIslrVes / tasa);
    const total = round(base + exento + iva + igtf);
    const retTotal = round(retIva + retIslr);
    const neto = round(total - retTotal);
    return {
      base_usd: base, exento_usd: exento, iva_pct: ivaPct, iva_usd: iva,
      igtf_pct: igtfPct, igtf_usd: igtf, ret_iva_pct: retIvaPct, ret_iva_usd: retIva,
      ret_islr_usd: retIslr, ret_islr_tarifa: rate.tarifa, ret_islr_sustraendo_ut: rate.sustraendoUT,
      ret_total_usd: retTotal, total_usd: total, neto_pagar_usd: neto,
      tasa_bcv: tasa, base_ves: baseVes, iva_ves: round(iva * tasa), igtf_ves: round(igtf * tasa),
      ret_iva_ves: round(retIva * tasa), ret_islr_ves: retIslrVes, total_ves: round(total * tasa),
      neto_pagar_ves: round(neto * tasa)
    };
  }

  /* ------------------------------------------------------------------ *
   *  SEED · CUENTAS POR PAGAR
   * ------------------------------------------------------------------ */
  function seedPayables() {
    const defs = [
      { proveedor: 'J-301234567', factura: '00012458', control: '00-8871', dias: 4, vence: 26, base: 480, exento: 0, iva: 16, igtf: 3, retIva: 75, tipoPersona: 'PJ_DOM', concepto: 'Repuestos para 12 motos de delivery (kit de arrastre y frenos)' },
      { proveedor: 'J-405678901', factura: '00004577', control: '00-3320', dias: 9, vence: 21, base: 1250, exento: 0, iva: 16, igtf: 0, retIva: 100, tipoPersona: 'PJ_DOM', concepto: 'Compra de lubricantes y filtros para flota ENVIA' },
      { proveedor: 'V-14567890', factura: '00000981', control: '00-1174', dias: 15, vence: 15, base: 850, exento: 0, iva: 16, igtf: 0, retIva: 75, tipoPersona: 'PN_RES', concepto: 'Mantenimiento correctivo de 8 unidades (servicio técnico)' },
      { proveedor: 'J-412345678', factura: '00099120', control: '00-5588', dias: 22, vence: 8, base: 2100, exento: 0, iva: 0, igtf: 3, retIva: 0, tipoPersona: 'PJ_DOM', concepto: 'Prima de seguro de flota trimestre octubre-diciembre' },
      { proveedor: 'J-298765432', factura: '00033019', control: '00-7712', dias: 30, vence: -5, base: 3600, exento: 0, iva: 16, igtf: 0, retIva: 75, tipoPersona: 'PJ_DOM', concepto: 'Campaña de publicidad digital y vallas en Caracas' },
      { proveedor: 'J-301234567', factura: '00012601', control: '00-8899', dias: 38, vence: -13, base: 640, exento: 0, iva: 16, igtf: 3, retIva: 75, tipoPersona: 'PJ_DOM', concepto: 'Neumáticos y baterías para motos de delivery' },
      { proveedor: 'V-14567890', factura: '00001012', control: '00-1190', dias: 46, vence: -21, base: 320, exento: 0, iva: 16, igtf: 0, retIva: 75, tipoPersona: 'PN_RES', concepto: 'Reparación de motor de camioneta Ford Ranger' }
    ];
    return defs.map((d, i) => {
      const comp = computePayable({
        base_usd: d.base, exento_usd: d.exento, iva_pct: d.iva, igtf_pct: d.igtf,
        ret_iva_pct: d.retIva, tipo_persona: d.tipoPersona, tasa_bcv: 78.45
      });
      const pagado = i === 6 ? 320 : (i === 5 ? 150 : (i === 3 ? 500 : 0));
      const neto = round(comp.neto_pagar_usd - pagado);
      const est = neto <= 0.01 ? 'Pagado' : (pagado > 0 ? 'Pagado Parcial' : 'Pendiente');
      return {
        id: 'CXP-2026-' + String(300 + i),
        numero_factura: d.factura,
        numero_control: d.control,
        proveedor_rif: d.proveedor,
        fecha_emision: iso(d.dias),
        fecha_vencimiento: iso(d.vence),
        concepto: d.concepto,
        tipo: 'compra',
        tasa_bcv: 78.45,
        pagado_usd: pagado,
        estatus: est,
        comprobante_numero: '',
        pagos: pagado > 0 ? [{ fecha: iso(Math.max(0, d.dias - 2)), monto_usd: pagado, metodo: 'Transferencia', referencia: 'PAGO-' + d.factura }] : [],
        created_at: stamp(),
        ...comp
      };
    });
  }

  /* ------------------------------------------------------------------ *
   *  BASE DE DATOS
   * ------------------------------------------------------------------ */
  let current = null;
  let storageReady = false;
  let recoveredFromBackup = false;
  const seeded = buildSeed();
  const loaded = loadDb();
  current = loaded || seeded;
  ensureCatalogs(current);

  function buildSeed() {
    const db = {
      version: 1,
      clients: seedClients(),
      drivers: seedDrivers(),
      suppliers: seedSuppliers(),
      services: seedServices(),
      payables: [],
      withholdings: [],
      walletMovements: [],
      partners: seedPartners(),
      partnerMovements: [],
      products: seedProducts(),
      driverCharges: [],
      driverMovements: [],
      systemParams: [],
      accounts: clone(ACCOUNTS),
      accountingRules: clone(DEFAULT_RULES).map((r) => ({ ...r, id: 'rule_' + r.evento, updated_at: stamp() })),
      entries: [],
      taxParams: { ...DEFAULT_TAX, islrTariffs: clone(ISLR_TARIFFS) },
      roles: defaultRoles(),
      users: [
        { id: 'usr_envia', usuario: 'ENVIA', password: '123456789', nombre: 'Administrador ENVIA', rol: 'SuperAdmin', correo: 'admin@envia.com.ve', activo: true, created_at: stamp() },
        { id: 'usr_contador', usuario: 'contador', password: 'Contador2026', nombre: 'Ana Belén Rojas', rol: 'Contador / Fiscal', correo: 'contabilidad@envia.com.ve', activo: true, created_at: stamp() },
        { id: 'usr_tesoreria', usuario: 'tesoreria', password: 'Tesoreria2026', nombre: 'Jorge Luis Medina', rol: 'Tesorero / Cuentas por Pagar', correo: 'tesoreria@envia.com.ve', activo: true, created_at: stamp() },
        { id: 'usr_auditor', usuario: 'auditor', password: 'Auditor2026', nombre: 'Patricia Salazar', rol: 'Auditor / Operaciones', correo: 'auditoria@envia.com.ve', activo: true, created_at: stamp() }
      ],
      meta: {
        entrySeq: 0,
        voucherSeq: 0,
        lastBackup: null,
        createdAt: stamp(),
        supabaseLastSync: null,
        schemaVersion: 2
      },
      auditLog: []
    };

    // Cuentas por pagar (necesitan el motor ya inicializado con current)
    current = db;
    db.payables = seedPayables();
    db.partnerMovements = seedPartnerMovements();
    db.driverCharges = seedDriverCharges();
    db.driverMovements = seedDriverMovements(db.services, db.driverCharges);
    db.meta.entrySeq = 0;
    db.meta.voucherSeq = 0;

    // Asiento de apertura
    postEntryInternal(db, {
      fecha: iso(400),
      descripcion: 'Asiento de apertura del ejercicio · ENVIA ERP',
      referencia: 'APERTURA-2026',
      origen: 'apertura',
      lines: [
        { cuenta: '1.1.1.02', debe: 1800000, haber: 0 },
        { cuenta: '1.1.1.01', debe: 200000, haber: 0 },
        { cuenta: '1.1.4.01', debe: 45000, haber: 0 },
        { cuenta: '2.1.1.01', debe: 0, haber: 120000 },
        { cuenta: '3.1.1.01', debe: 0, haber: 1925000 }
      ]
    });

    // Asientos automáticos de servicios
    db.services.forEach((s) => {
      postServiceEntries(db, s);
    });

    // Asientos de facturas de compra + comprobantes de retención
    db.payables.forEach((p) => {
      postPurchaseEntries(db, p);
      createVoucherInternal(db, p);
    });

    // Recargas de wallet demo
    const wallet = [
      { cliente: 'V-19654872', monto: 50, moneda: 'USD', metodo: 'Pago Móvil', dias: 3 },
      { cliente: 'J-401234567', monto: 200, moneda: 'USD', metodo: 'Zelle', dias: 8 },
      { cliente: 'V-15876543', monto: 1000, moneda: 'USD', metodo: 'Tarjeta', dias: 12 },
      { cliente: 'V-23987654', monto: 5000, moneda: 'VES', metodo: 'Pago Móvil', dias: 5 }
    ];
    wallet.forEach((w) => {
      const rate = 78.45;
      const montoUsd = w.moneda === 'USD' ? w.monto : round(w.monto / rate);
      const rule = db.accountingRules.find((r) => r.evento === (w.moneda === 'USD' ? 'recarga_wallet' : 'recarga_wallet_ves'));
      db.walletMovements.push({ id: uid('wal'), cliente_cedula_rif: w.cliente, monto: w.monto, moneda: w.moneda, monto_usd: montoUsd, metodo: w.metodo, fecha: iso(w.dias), created_at: stamp() });
      postEntryInternal(db, {
        fecha: iso(w.dias),
        descripcion: `Recarga de Wallet ${w.moneda} · ${w.cliente}`,
        referencia: 'WALLET-' + w.cliente,
        origen: 'wallet',
        lines: w.moneda === 'USD'
          ? [
              { cuenta: rule.cuenta_debe, debe: round(w.monto * rate), haber: 0 },
              { cuenta: rule.cuenta_haber, debe: 0, haber: round(w.monto * rate) }
            ]
          : [
              { cuenta: rule.cuenta_debe, debe: w.monto, haber: 0 },
              { cuenta: rule.cuenta_haber, debe: 0, haber: w.monto }
            ]
      });
    });

    // Un par de pagos a proveedores con su asiento
    const p3 = db.payables[3];
    const p6 = db.payables[6];
    if (p3) {
      postEntryInternal(db, {
        fecha: iso(6),
        descripcion: `Pago parcial factura ${p3.numero_factura} · Seguros La Movilidad`,
        referencia: 'PAGO-' + p3.numero_factura,
        origen: 'pago',
        lines: [
          { cuenta: '2.1.1.01', debe: round(500 * p3.tasa_bcv), haber: 0 },
          { cuenta: '1.1.1.02', debe: 0, haber: round(500 * p3.tasa_bcv) }
        ]
      });
    }
    if (p6) {
      postEntryInternal(db, {
        fecha: iso(20),
        descripcion: `Pago total factura ${p6.numero_factura} · Juan Carlos Mecánica`,
        referencia: 'PAGO-' + p6.numero_factura,
        origen: 'pago',
        lines: [
          { cuenta: '2.1.1.01', debe: round(320 * p6.tasa_bcv), haber: 0 },
          { cuenta: '1.1.1.02', debe: 0, haber: round(320 * p6.tasa_bcv) }
        ]
      });
    }

    // Gastos operativos demo
    const expenses = [
      { dias: 18, desc: 'Alquiler de oficina administrativa · octubre 2026', cuenta: '6.1.2.01', monto: 450, metodo: '1.1.1.02' },
      { dias: 25, desc: 'Servicios públicos (electricidad e internet) · octubre 2026', cuenta: '6.1.2.02', monto: 120, metodo: '1.1.1.02' },
      { dias: 11, desc: 'Nómina administrativa primera quincena · noviembre 2026', cuenta: '6.1.1.01', monto: 780, metodo: '1.1.1.02' },
      { dias: 7, desc: 'Comisiones de pasarela de pago · octubre 2026', cuenta: '5.2.1.01', monto: 96, metodo: '1.1.1.02' }
    ];
    expenses.forEach((e) => {
      const amount = round(e.monto * 78.45);
      postEntryInternal(db, {
        fecha: iso(e.dias),
        descripcion: e.desc,
        referencia: 'GASTO-' + e.dias,
        origen: 'gasto',
        lines: [
          { cuenta: e.cuenta, debe: amount, haber: 0 },
          { cuenta: e.metodo, debe: 0, haber: amount }
        ]
      });
    });

    /* ------------------------------------------------------------------ *
     *  Inventario inicial, financiamientos de tienda y negocios asociados
     *  (asientos demo para que los libros reflejen las nuevas carteras)
     * ------------------------------------------------------------------ */
    const costoEntregado = db.driverCharges.reduce((sum, c) => {
      const p = db.products.find((x) => x.sku === c.producto_sku);
      return sum + round((p ? p.costo_usd : 0) * c.cantidad);
    }, 0);
    const valorInventario = round(db.products.reduce((sum, p) => sum + p.stock * p.costo_usd, 0) + costoEntregado);
    postEntryInternal(db, {
      fecha: iso(400),
      descripcion: 'Inventario inicial de uniformes y equipamiento · ENVIA ERP',
      referencia: 'APERTURA-INVENTARIO',
      origen: 'apertura',
      lines: [
        { cuenta: '1.1.6.01', debe: valorInventario, haber: 0 },
        { cuenta: '3.1.1.01', debe: 0, haber: valorInventario }
      ]
    });
    db.driverCharges.forEach((c) => {
      const p = db.products.find((x) => x.sku === c.producto_sku);
      postEntryInternal(db, {
        fecha: c.fecha,
        descripcion: 'Venta financiada ' + c.producto_nombre + ' · ' + c.conductor_cedula_rif,
        referencia: c.id,
        origen: 'tienda',
        lines: [
          { cuenta: '1.1.2.02', debe: c.total_usd, haber: 0 },
          { cuenta: '4.2.1.03', debe: 0, haber: c.total_usd }
        ]
      });
      const costo = round((p ? p.costo_usd : 0) * c.cantidad);
      if (costo > 0) {
        postEntryInternal(db, {
          fecha: c.fecha,
          descripcion: 'Costo de artículo entregado · ' + c.producto_nombre,
          referencia: c.id,
          origen: 'tienda',
          lines: [
            { cuenta: '5.2.2.01', debe: costo, haber: 0 },
            { cuenta: '1.1.6.01', debe: 0, haber: costo }
          ]
        });
      }
    });
    db.partnerMovements.forEach((m) => {
      const partner = db.partners.find((p) => p.rif === m.partner_rif);
      if (!partner || !m.monto_usd) return;
      const entrada = { fecha: m.fecha, descripcion: m.concepto, referencia: m.id, origen: 'asociados', lines: [] };
      if (m.tipo === 'comision') {
        entrada.lines = [
          { cuenta: '1.1.2.03', debe: m.monto_usd, haber: 0 },
          { cuenta: '4.2.1.02', debe: 0, haber: m.monto_usd }
        ];
      } else if (m.tipo === 'cobro') {
        entrada.lines = [
          { cuenta: '1.1.1.02', debe: m.monto_usd, haber: 0 },
          { cuenta: '1.1.2.03', debe: 0, haber: m.monto_usd }
        ];
      } else if (m.tipo === 'recaudacion') {
        entrada.lines = [
          { cuenta: '1.1.1.01', debe: m.monto_usd, haber: 0 },
          { cuenta: '2.1.1.03', debe: 0, haber: m.monto_usd }
        ];
      } else if (m.tipo === 'pago') {
        entrada.lines = [
          { cuenta: '2.1.1.03', debe: m.monto_usd, haber: 0 },
          { cuenta: '1.1.1.02', debe: 0, haber: m.monto_usd }
        ];
      }
      if (entrada.lines.length) postEntryInternal(db, entrada);
    });

    return db;
  }

  function postEntryInternal(db, data) {
    if (!Array.isArray(data.lines) || data.lines.length < 2) throw new Error('El asiento debe contener al menos dos líneas.');
    const lines = data.lines.map((l) => {
      required(l.cuenta, 'Cuenta contable');
      const debe = money(l.debe, 'DEBE de ' + l.cuenta);
      const haber = money(l.haber, 'HABER de ' + l.cuenta);
      return { cuenta: l.cuenta, debe, haber };
    }).filter((l) => l.debe > 0 || l.haber > 0);
    if (lines.length < 2) throw new Error('El asiento debe contener al menos dos líneas con movimiento.');
    const d = round(lines.reduce((s, l) => s + l.debe, 0));
    const h = round(lines.reduce((s, l) => s + l.haber, 0));
    if (Math.abs(d - h) > 0.011) throw new Error('Partida doble: el asiento no cuadra (DEBE ' + d + ' / HABER ' + h + ').');
    // Ajuste de redondeo: fuerza DEBE = HABER exacto sobre la línea mayor del
    // lado menor, sin alterar la naturaleza del asiento.
    const diff = round(d - h);
    if (diff !== 0 && lines.length) {
      if (diff > 0) {
        let idx = -1;
        lines.forEach((l, i) => { if (l.haber > 0 && (idx < 0 || l.haber > lines[idx].haber)) idx = i; });
        if (idx >= 0) lines[idx].haber = round(lines[idx].haber + diff);
      } else {
        let idx = -1;
        lines.forEach((l, i) => { if (l.debe > 0 && (idx < 0 || l.debe > lines[idx].debe)) idx = i; });
        if (idx >= 0) lines[idx].debe = round(lines[idx].debe - diff);
      }
    }
    const year = (data.fecha || today()).slice(0, 4);
    db.meta.entrySeq = (db.meta.entrySeq || 0) + 1;
    const entry = {
      id: uid('as'),
      numero: 'AS-' + year + '-' + String(db.meta.entrySeq).padStart(4, '0'),
      fecha: data.fecha || today(),
      descripcion: data.descripcion || 'Asiento contable',
      referencia: data.referencia || '',
      origen: data.origen || 'manual',
      tasa_bcv: Number(data.tasa_bcv || db.taxParams.bcvRate),
      lines,
      created_at: stamp()
    };
    db.entries.push(entry);
    return entry;
  }

  function postServiceEntries(db, s) {
    const rate = Number(db.taxParams.bcvRate);
    const ruleKey = s.tipo === 'carrera' ? 'traslado' : 'encomienda';
    const rule = db.accountingRules.find((r) => r.evento === ruleKey);
    if (!rule) return;
    const totalVes = round(s.total_usd * rate);
    const baseVes = round(s.base_usd * rate);
    const ivaVes = round(s.iva_usd * rate);
    const igtfVes = round(s.igtf_usd * rate);
    const lines = [
      { cuenta: rule.cuenta_debe, debe: totalVes, haber: 0 },
      { cuenta: rule.cuenta_haber, debe: 0, haber: baseVes }
    ];
    if (ivaVes > 0 && rule.cuenta_iva) lines.push({ cuenta: rule.cuenta_iva, debe: 0, haber: ivaVes });
    if (igtfVes > 0 && rule.cuenta_igtf) lines.push({ cuenta: rule.cuenta_igtf, debe: 0, haber: igtfVes });
    postEntryInternal(db, {
      fecha: s.fecha,
      descripcion: (s.tipo === 'carrera' ? 'Ingreso por carrera' : 'Ingreso por encomienda') + ' · ' + s.origen + ' → ' + s.destino,
      referencia: s.id,
      origen: 'servicio',
      tasa_bcv: rate,
      lines
    });
    const liq = db.accountingRules.find((r) => r.evento === 'liquidacion_conductor');
    if (liq && s.pago_conductor_usd > 0) {
      postEntryInternal(db, {
        fecha: s.fecha,
        descripcion: 'Liquidación generada al conductor · ' + s.conductor_cedula_rif,
        referencia: s.id,
        origen: 'liquidacion',
        tasa_bcv: rate,
        lines: [
          { cuenta: liq.cuenta_debe, debe: round(s.pago_conductor_usd * rate), haber: 0 },
          { cuenta: liq.cuenta_haber, debe: 0, haber: round(s.pago_conductor_usd * rate) }
        ]
      });
    }
  }

  function postPurchaseEntries(db, p) {
    const rule = db.accountingRules.find((r) => r.evento === 'compra_proveedor');
    if (!rule) return;
    const base = round(p.base_usd * p.tasa_bcv);
    const exento = round((p.exento_usd || 0) * p.tasa_bcv);
    const iva = round(p.iva_usd * p.tasa_bcv);
    const igtf = round(p.igtf_usd * p.tasa_bcv);
    const retIva = round(p.ret_iva_usd * p.tasa_bcv);
    const retIslr = round(p.ret_islr_usd * p.tasa_bcv);
    const gross = round(base + exento + iva + igtf);
    const lines = [
      { cuenta: rule.cuenta_debe, debe: round(base + exento), haber: 0 },
      { cuenta: rule.cuenta_haber, debe: 0, haber: gross }
    ];
    if (iva > 0 && rule.cuenta_iva) lines.push({ cuenta: rule.cuenta_iva, debe: iva, haber: 0 });
    if (igtf > 0 && rule.cuenta_igtf) lines.push({ cuenta: rule.cuenta_igtf, debe: igtf, haber: 0 });
    if (retIva > 0) {
      lines.push({ cuenta: '2.1.1.01', debe: retIva, haber: 0 });
      lines.push({ cuenta: '2.1.2.04', debe: 0, haber: retIva });
    }
    if (retIslr > 0) {
      lines.push({ cuenta: '2.1.1.01', debe: retIslr, haber: 0 });
      lines.push({ cuenta: '2.1.2.03', debe: 0, haber: retIslr });
    }
    postEntryInternal(db, {
      fecha: p.fecha_emision,
      descripcion: 'Factura de compra N° ' + p.numero_factura + ' · ' + p.concepto,
      referencia: p.id,
      origen: 'compra',
      tasa_bcv: p.tasa_bcv,
      lines
    });
  }

  function createVoucherInternal(db, p) {
    if (!p.ret_iva_usd && !p.ret_islr_usd) return null;
    const periodo = p.fecha_emision.slice(0, 7).replace('-', '');
    db.meta.voucherSeq = (db.meta.voucherSeq || 0) + 1;
    const numero = periodo + String(db.meta.voucherSeq).padStart(8, '0');
    const supplier = db.suppliers.find((s) => s.rif === p.proveedor_rif);
    const voucher = {
      id: uid('ret'),
      numero_comprobante: numero,
      periodo,
      tipo: p.ret_iva_usd > 0 && p.ret_islr_usd > 0 ? 'IVA + ISLR' : (p.ret_iva_usd > 0 ? 'IVA' : 'ISLR'),
      proveedor_rif: p.proveedor_rif,
      proveedor_nombre: supplier ? supplier.razon_social : p.proveedor_rif,
      proveedor_direccion: supplier ? supplier.direccion : '',
      factura_numero: p.numero_factura,
      factura_control: p.numero_control,
      factura_id: p.id,
      fecha: p.fecha_emision,
      tasa_bcv: p.tasa_bcv,
      base_ves: p.base_ves,
      iva_ves: p.iva_ves,
      ret_iva_pct: p.ret_iva_pct,
      ret_iva_ves: p.ret_iva_ves,
      ret_islr_tarifa: p.ret_islr_tarifa,
      ret_islr_sustraendo_ut: p.ret_islr_sustraendo_ut,
      ret_islr_ves: p.ret_islr_ves,
      total_retenido_ves: round(p.ret_iva_ves + p.ret_islr_ves),
      concepto: p.concepto,
      estado: 'Emitido',
      created_at: stamp()
    };
    p.comprobante_numero = numero;
    db.withholdings.push(voucher);
    return voucher;
  }

  /* ------------------------------------------------------------------ *
   *  PERSISTENCIA / API
   * ------------------------------------------------------------------ */
  function parseDb(raw) {
    if (!raw) return null;
    try {
      const db = JSON.parse(raw);
      if (!db || !Array.isArray(db.clients) || !Array.isArray(db.accounts)) return null;
      return db;
    } catch (e) {
      return null;
    }
  }

  function loadDb() {
    const primary = parseDb(localStorage.getItem(DB_KEY));
    if (primary) return primary;
    const backup = parseDb(localStorage.getItem(DB_BACKUP_KEY));
    if (backup) {
      recoveredFromBackup = true;
      console.warn('ENVIA: base principal ilegible; se recuperó la copia de seguridad local.');
      return backup;
    }
    return null;
  }

  function persist() {
    try {
      current.meta.updatedAt = stamp();
      const payload = JSON.stringify(current);
      const previous = localStorage.getItem(DB_KEY);
      if (previous && previous !== payload) {
        try { localStorage.setItem(DB_BACKUP_KEY, previous); } catch (e) { /* la copia es opcional */ }
      }
      localStorage.setItem(DB_KEY, payload);
      const verify = localStorage.getItem(DB_KEY);
      if (!verify || verify.length !== payload.length) throw new Error('La verificación de guardado local falló.');
      return true;
    } catch (err) {
      console.error('ENVIA: error guardando datos', err);
      if (!storageReady) return false;
      throw new Error('No se pudieron guardar los datos en este navegador. Revisa el espacio libre o exporta un respaldo antes de continuar.');
    }
  }

  /**
   * Migración no destructiva: agrega catálogos nuevos sin tocar los datos del
   * usuario. Se ejecuta al cargar una base local existente.
   */
  function ensureCatalogs(db) {
    let changed = !!recoveredFromBackup;
    if (!Array.isArray(db.clients)) { db.clients = []; changed = true; }
    if (!Array.isArray(db.drivers)) { db.drivers = []; changed = true; }
    if (!Array.isArray(db.users)) { db.users = []; changed = true; }
    if (!Array.isArray(db.roles) || !db.roles.length) {
      db.roles = defaultRoles();
      changed = true;
    } else {
      const superRole = db.roles.find((r) => r.nombre === 'SuperAdmin');
      if (!superRole) {
        db.roles.unshift(defaultRoles()[0]);
        changed = true;
      } else if (!superRole.admin || !superRole.sistema) {
        superRole.admin = true;
        superRole.sistema = true;
        changed = true;
      }
      db.roles.forEach((r) => {
        if (!r.permisos || typeof r.permisos !== 'object') {
          r.permisos = {};
          changed = true;
        }
        if (!r.icono) { r.icono = 'shield'; changed = true; }
      });
    }
    const roleNames = db.roles.map((r) => r.nombre);
    db.users.forEach((u) => {
      if (!roleNames.includes(u.rol)) {
        u.rol = 'Auditor / Operaciones';
        changed = true;
      }
    });
    if (!Array.isArray(db.walletMovements)) { db.walletMovements = []; changed = true; }
    if (!Array.isArray(db.partners)) { db.partners = seedPartners(); changed = true; }
    if (!Array.isArray(db.partnerMovements)) { db.partnerMovements = []; changed = true; }
    if (!Array.isArray(db.products)) { db.products = seedProducts(); changed = true; }
    if (!Array.isArray(db.driverCharges)) { db.driverCharges = []; changed = true; }
    if (!Array.isArray(db.driverMovements)) { db.driverMovements = []; changed = true; }
    // Backfill del historial de wallet del conductor para bases creadas antes de esta versión.
    if (!db.driverMovements.length && Array.isArray(db.services) && db.services.length) {
      db.driverMovements = seedDriverMovements(db.services, db.driverCharges);
      changed = true;
    }
    if (!db.taxParams || !db.taxParams.islrTariffs) {
      db.taxParams = { ...DEFAULT_TAX, ...(db.taxParams || {}), islrTariffs: clone(ISLR_TARIFFS) };
      changed = true;
    }
    if (!Array.isArray(db.accounts)) { db.accounts = []; changed = true; }
    ACCOUNTS.forEach((a) => {
      if (!db.accounts.some((x) => x.codigo === a.codigo)) {
        db.accounts.push(clone(a));
        changed = true;
      }
    });
    if (!Array.isArray(db.accountingRules)) { db.accountingRules = []; changed = true; }
    DEFAULT_RULES.forEach((r) => {
      if (!db.accountingRules.some((x) => x.evento === r.evento)) {
        db.accountingRules.push({ ...clone(r), id: 'rule_' + r.evento, updated_at: stamp() });
        changed = true;
      }
    });
    if (!db.meta) { db.meta = { entrySeq: 0, voucherSeq: 0 }; changed = true; }

    if (!Array.isArray(db.auditLog)) { db.auditLog = []; changed = true; }

    db.drivers.forEach((d) => {
      const legacyLevels = { Plata: 'Zafiro', Oro: 'Esmeralda', Platium: 'Diamante' };
      if (legacyLevels[d.nivel]) {
        d.nivel = legacyLevels[d.nivel];
        changed = true;
      }
      if (!DRIVER_LEVELS.includes(d.nivel)) { d.nivel = 'Zafiro'; changed = true; }
      if (!d.docs_meta || typeof d.docs_meta !== 'object') {
        d.docs_meta = {};
        changed = true;
      }
      ['cedula', 'rif', 'licencia', 'circulacion', 'rcv'].forEach((k) => {
        if (!d.docs_meta[k]) {
          d.docs_meta[k] = { emision: '', vencimiento: '', origen: 'manual' };
          changed = true;
        }
      });
      if (!('url_seguro_rcv' in d)) { d.url_seguro_rcv = ''; changed = true; }
      const vencido = ['cedula', 'rif', 'licencia', 'circulacion', 'rcv'].some((k) => {
        const v = d.docs_meta[k] && d.docs_meta[k].vencimiento;
        return v && v < today();
      });
      if (vencido && d.estatus_conductor !== 'Suspendido' && d.estatus_conductor !== 'Inactivo por Documentos Vencidos') {
        d.estatus_conductor = 'Inactivo por Documentos Vencidos';
        d.inactivado_por_documentos = true;
        changed = true;
      } else if (!vencido && d.inactivado_por_documentos && d.estatus_conductor === 'Inactivo por Documentos Vencidos') {
        d.estatus_conductor = 'Activo / Disponible';
        d.inactivado_por_documentos = false;
        changed = true;
      }
    });

    // Parámetros por defecto de mantenimiento del sistema (si no existen).
    if (!Array.isArray(db.systemParams)) { db.systemParams = []; changed = true; }
    const defaultParams = [
      { key: 'tarifa_plana_semanal_usd', label: 'Tarifa plana semanal por conductor', value: '10', tipo: 'monto', module: 'drivers', descripcion: 'Monto fijo descontado de la wallet del conductor cada semana.' },
      { key: 'comision_nivel_zafiro_pct', label: 'Comisión nivel Zafiro', value: '5', tipo: 'porcentaje', module: 'drivers', descripcion: 'Porcentaje descontado al conductor Zafiro por cada servicio.' },
      { key: 'comision_nivel_esmeralda_pct', label: 'Comisión nivel Esmeralda', value: '10', tipo: 'porcentaje', module: 'drivers', descripcion: 'Porcentaje descontado al conductor Esmeralda por cada servicio.' },
      { key: 'comision_nivel_diamante_pct', label: 'Comisión nivel Diamante', value: '15', tipo: 'porcentaje', module: 'drivers', descripcion: 'Porcentaje descontado al conductor Diamante por cada servicio.' }
    ];
    defaultParams.forEach((dp) => {
      if (!db.systemParams.some((p) => p.key === dp.key)) {
        db.systemParams.push({ ...dp, created_at: stamp(), updated_at: stamp() });
        changed = true;
      }
    });

    // Migración demo: reemplaza el cliente "María Fernanda" por "Jesús Alberto"
    // y actualiza sus referencias en servicios y movimientos de billetera.
    if (db.clients.some((c) => c.cedula_rif === 'V-18500123')) {
      const viejo = 'V-18500123';
      const nuevo = 'V-19654872';
      db.clients = db.clients.map((c) => (c.cedula_rif === viejo ? {
        ...c,
        cedula_rif: nuevo,
        nombres: 'Jesús Alberto',
        apellidos: 'Mendoza Quintero',
        telefono: '0414-555-0673',
        correo: 'jesus.mendoza@gmail.com',
        direccion: 'Urb. La Trinidad, Av. Principal, Res. Villa Hermosa, Apto 5-A, Baruta, Municipio Baruta, Estado Miranda',
        url_foto_cedula: 'demo://cliente/' + nuevo + '/cedula',
        url_foto_rif: 'demo://cliente/' + nuevo + '/rif',
        updated_at: stamp()
      } : c));
      if (Array.isArray(db.services)) {
        db.services = db.services.map((s) => (s.cliente_cedula_rif === viejo ? { ...s, cliente_cedula_rif: nuevo } : s));
      }
      if (Array.isArray(db.walletMovements)) {
        db.walletMovements = db.walletMovements.map((w) => (w.cliente_cedula_rif === viejo ? { ...w, cliente_cedula_rif: nuevo } : w));
      }
      changed = true;
    }
    if (changed) {
      db.accounts.sort((a, b) => a.codigo.localeCompare(b.codigo, undefined, { numeric: true }));
      persist();
    }
  }

  /* ---------------------------------------------------------------- *
   *  MIGRACIÓN INTERNA DE ESQUEMA                                    *
   *  Ejecutada al iniciar y expuesta como migrateDatabase().         *
   *  Permite aplicar cambios de estructura (tablas, columnas,         *
   *  parámetros por defecto) sin que el usuario tenga que hacerlo      *
   *  manualmente. Incrementar schemaVersion para nuevas migraciones.   *
   * ---------------------------------------------------------------- */
  function ensureSchema(db) {
    const currentVersion = Number(db.meta && db.meta.schemaVersion) || 0;
    const targetVersion = 2;
    let migrated = false;
    if (currentVersion < targetVersion) {
      if (!Array.isArray(db.systemParams)) { db.systemParams = []; migrated = true; }
      const defaultParams = [
        { key: 'tarifa_plana_semanal_usd', label: 'Tarifa plana semanal por conductor', value: '10', tipo: 'monto', module: 'drivers', descripcion: 'Monto fijo descontado de la wallet del conductor cada semana.' },
        { key: 'comision_nivel_zafiro_pct', label: 'Comisión nivel Zafiro', value: '5', tipo: 'porcentaje', module: 'drivers', descripcion: 'Porcentaje descontado al conductor Zafiro por cada servicio.' },
        { key: 'comision_nivel_esmeralda_pct', label: 'Comisión nivel Esmeralda', value: '10', tipo: 'porcentaje', module: 'drivers', descripcion: 'Porcentaje descontado al conductor Esmeralda por cada servicio.' },
        { key: 'comision_nivel_diamante_pct', label: 'Comisión nivel Diamante', value: '15', tipo: 'porcentaje', module: 'drivers', descripcion: 'Porcentaje descontado al conductor Diamante por cada servicio.' }
      ];
      defaultParams.forEach((dp) => {
        if (!db.systemParams.some((p) => p.key === dp.key)) {
          db.systemParams.push({ ...dp, created_at: stamp(), updated_at: stamp() });
          migrated = true;
        }
      });
      if (migrated) {
        db.meta.schemaVersion = targetVersion;
        persist();
      }
    }
  }

  ensureSchema(current);

  if (!loadDb()) persist();
  storageReady = true;

  function nextServiceId() {
    const prefix = 'SRV-' + new Date().getFullYear() + '-';
    let max = 1049;
    current.services.forEach((s) => {
      if (String(s.id || '').startsWith(prefix)) max = Math.max(max, Number(s.id.slice(prefix.length)) || 0);
    });
    return prefix + String(max + 1).padStart(4, '0');
  }

  /* ------------------------------------------------------------------ *
   *  PERMISOS EFECTIVOS
   * ------------------------------------------------------------------ */
  function roleByName(nombre) {
    return (current.roles || []).find((r) => r.nombre === nombre);
  }

  function userByUsuario(usuario) {
    return usuario ? (current.users || []).find((u) => u.usuario.toUpperCase() === String(usuario).toUpperCase()) : null;
  }

  function effectivePermissions(rol, usuario) {
    const role = roleByName(rol);
    if (role && role.admin) return allPermissions();
    const user = userByUsuario(usuario);
    if (user && user.permisos && typeof user.permisos === 'object' && Object.keys(user.permisos).length) {
      return clone(user.permisos);
    }
    return role && role.permisos ? clone(role.permisos) : {};
  }

  function modulePermission(perms, module) {
    const p = perms && perms[module];
    return p && p.ver !== false ? p : null;
  }

  function hasTab(perms, module, tab) {
    const p = modulePermission(perms, module);
    if (!p || !tab) return !!p;
    if (!Array.isArray(p.tabs) || p.tabs.includes('*')) return true;
    return p.tabs.includes(tab);
  }

  function hasAction(perms, module, action) {
    const p = modulePermission(perms, module);
    if (!p || !action) return !!p;
    if (!Array.isArray(p.acciones) || p.acciones.includes('*')) return true;
    return p.acciones.includes(action);
  }

  function accessFor(rol, usuario) {
    const perms = effectivePermissions(rol, usuario);
    const role = roleByName(rol);
    if (role && role.admin) {
      return { modules: ['*'], write: true, tabs: '*', actions: '*', permissions: perms };
    }
    const modules = Object.keys(PERMISSION_CATALOG).filter((m) => !!modulePermission(perms, m));
    const writeActions = ['crear', 'editar', 'eliminar', 'billetera', 'documentos', 'liquidar', 'pagar', 'roles'];
    const write = modules.some((m) => writeActions.some((a) => hasAction(perms, m, a)));
    return { modules, write, tabs: perms, actions: perms, permissions: perms };
  }

  const api = {
    /* datos crudos */
    get db() { return current; },
    get prefs() {
      try { return JSON.parse(localStorage.getItem(PREFS_KEY)) || { currency: 'USD' }; }
      catch (e) { return { currency: 'USD' }; }
    },
    setPrefs(p) { localStorage.setItem(PREFS_KEY, JSON.stringify({ ...api.prefs, ...p })); },

    /* catálogos */
    get ROLES() { return (current.roles || []).map((r) => r.nombre); },
    PAYMENT_METHODS, VEHICLE_TYPES, DRIVER_LEVELS, CLIENT_STATUS, DRIVER_STATUS,
    PARTNER_TYPES, PRODUCT_CATEGORIES, PARTNER_MOVEMENT_TYPES,
    ACCOUNT_LEVELS, ISLR_TARIFFS, PERMISSION_CATALOG, ACTION_LABELS,

    save: persist,
    round, today, uid, iso,
    computePayable,

    roles() { return clone(current.roles || []); },
    role(nombre) { const r = roleByName(nombre); return r ? clone(r) : null; },
    permissionsFor(rol, usuario) { return effectivePermissions(rol, usuario); },
    defaultPermissions() { return allPermissions(); },
    accessFor,
    can(rol, module, usuario) {
      const a = accessFor(rol, usuario);
      return a.modules.includes('*') || a.modules.includes(module);
    },
    canTab(rol, module, tab, usuario) { return hasTab(effectivePermissions(rol, usuario), module, tab); },
    canAction(rol, module, action, usuario) { return hasAction(effectivePermissions(rol, usuario), module, action); },
    canWrite(rol, usuario) { return accessFor(rol, usuario).write; },
    isAdmin(rol) { const r = roleByName(rol); return !!(r && r.admin); },
    upsertRole(data) {
      const nombre = norm(data.nombre);
      if (!nombre) throw new Error('El nombre del rol es obligatorio.');
      const existing = current.roles.find((r) => r.nombre === nombre);
      if (existing && existing.nombre === 'SuperAdmin' && data.admin === false) {
        throw new Error('El rol SuperAdmin debe conservar el acceso administrativo.');
      }
      if (!existing && current.roles.some((r) => r.nombre.toLowerCase() === nombre.toLowerCase())) {
        throw new Error('Ya existe un rol con ese nombre.');
      }
      if (existing && existing.sistema && existing.nombre !== nombre) {
        throw new Error('Los roles del sistema no se pueden renombrar.');
      }
      const rec = {
        ...(existing || {}),
        id: existing ? existing.id : uid('role'),
        nombre: existing ? existing.nombre : nombre,
        descripcion: norm(data.descripcion),
        icono: data.icono || (existing ? existing.icono : 'shield'),
        admin: existing && existing.nombre === 'SuperAdmin' ? true : !!data.admin,
        sistema: existing ? !!existing.sistema : false,
        permisos: data.permisos && typeof data.permisos === 'object' ? clone(data.permisos) : (existing ? existing.permisos : {}),
        updated_at: stamp(),
        created_at: existing ? existing.created_at : stamp()
      };
      if (existing) {
        if (existing.nombre === 'SuperAdmin') rec.permisos = allPermissions();
        Object.assign(existing, rec);
      } else {
        current.roles.push(rec);
      }
      api.addAuditLog(existing ? 'actualizar' : 'crear', 'roles', `Rol ${nombre}`, nombre);
      persist();
      return rec;
    },
    deleteRole(nombre) {
      const role = current.roles.find((r) => r.nombre === nombre);
      if (!role) return;
      if (role.sistema || role.admin) throw new Error('Los roles del sistema no se pueden eliminar.');
      const assigned = current.users.filter((u) => u.rol === nombre);
      if (assigned.length) throw new Error(`No se puede eliminar: ${assigned.length} usuario(s) tienen asignado este rol.`);
      current.roles = current.roles.filter((r) => r.nombre !== nombre);
      api.addAuditLog('eliminar', 'roles', `Rol ${nombre}`, nombre);
      persist();
    },

    /* tasas */
    setRate(rate, when, source) {
      const n = Number(rate);
      if (!n || n <= 0) throw new Error('La tasa BCV debe ser mayor a cero.');
      current.taxParams.bcvRate = round(n, 4);
      current.taxParams.bcvUpdatedAt = when || today();
      const origen = source ? ` · fuente ${source}` : '';
      api.addAuditLog('actualizar', 'tributos_bcv', `Tasa BCV actualizada a Bs ${n} por USD${origen}`, 'taxParams');
      persist();
    },
    updateTaxParams(patch) {
      current.taxParams = { ...current.taxParams, ...patch };
      if (patch.islrTariffs) current.taxParams.islrTariffs = patch.islrTariffs;
      api.addAuditLog('actualizar', 'tributos_bcv', 'Parámetros tributarios actualizados', 'taxParams');
      persist();
    },

    /* clientes */
    upsertClient(data) {
      const cedErr = idError(data.cedula_rif);
      if (cedErr) throw new Error(cedErr);
      const cedula = normId(data.cedula_rif);
      if (!cedula) throw new Error('La Cédula / RIF es obligatoria.');
      const mailErr = emailError(data.correo);
      if (mailErr) throw new Error(mailErr);
      const telErr = phoneError(data.telefono);
      if (telErr) throw new Error(telErr);
      money(data.saldo_wallet_usd, 'Saldo Wallet USD');
      money(data.saldo_wallet_ves, 'Saldo Wallet VES');
      money(Number(data.total_carreras) || 0, 'Total carreras');
      money(Number(data.total_encomiendas) || 0, 'Total encomiendas');
      const existing = current.clients.find((c) => c.cedula_rif === cedula);
      if (!existing && current.clients.some((c) => c.cedula_rif === cedula)) {
        throw new Error('Ya existe un cliente con esa cédula / RIF.');
      }
      const rec = {
        ...(existing || {}),
        ...data,
        cedula_rif: cedula,
        nombres: required(data.nombres, 'Nombres'),
        apellidos: required(data.apellidos, 'Apellidos'),
        telefono: required(data.telefono, 'Teléfono móvil'),
        correo: required(data.correo, 'Correo electrónico'),
        direccion: required(data.direccion, 'Dirección completa'),
        estatus: data.estatus || 'Activo',
        saldo_wallet_usd: round(data.saldo_wallet_usd),
        saldo_wallet_ves: round(data.saldo_wallet_ves),
        total_carreras: Number(data.total_carreras) || 0,
        total_encomiendas: Number(data.total_encomiendas) || 0,
        updated_at: stamp(),
        created_at: existing ? existing.created_at : stamp()
      };
      if (existing) Object.assign(existing, rec);
      else current.clients.unshift(rec);
      api.addAuditLog(existing ? 'actualizar' : 'crear', 'clientes', `Cliente ${cedula} · ${data.nombres || ''} ${data.apellidos || ''}`, cedula);
      persist();
      return rec;
    },
    deleteClient(cedula) {
      const hasSvc = current.services.some((s) => s.cliente_cedula_rif === cedula);
      if (hasSvc) throw new Error('No se puede eliminar: el cliente tiene servicios asociados.');
      current.clients = current.clients.filter((c) => c.cedula_rif !== cedula);
      api.addAuditLog('eliminar', 'clientes', `Cliente ${cedula}`, cedula);
      persist();
    },
    addWalletRecharge(cedula, data) {
      const client = current.clients.find((c) => c.cedula_rif === cedula);
      if (!client) throw new Error('Cliente no encontrado.');
      const moneda = data.moneda || 'USD';
      const monto = round(data.monto);
      if (monto <= 0) throw new Error('El monto debe ser mayor a cero.');
      const rate = current.taxParams.bcvRate;
      const rule = current.accountingRules.find((r) => r.evento === (moneda === 'USD' ? 'recarga_wallet' : 'recarga_wallet_ves'));
      if (moneda === 'USD') client.saldo_wallet_usd = round(client.saldo_wallet_usd + monto);
      else client.saldo_wallet_ves = round(client.saldo_wallet_ves + monto);
      current.walletMovements.unshift({
        id: uid('wal'), cliente_cedula_rif: cedula, monto, moneda,
        monto_usd: moneda === 'USD' ? monto : round(monto / rate),
        metodo: data.metodo || 'Pago Móvil', referencia: data.referencia || '',
        fecha: data.fecha || today(), created_at: stamp()
      });
      if (rule) {
        const amountVes = moneda === 'USD' ? round(monto * rate) : monto;
        api.postEntry({
          fecha: data.fecha || today(),
          descripcion: `Recarga de Wallet ${moneda} · ${client.nombres} ${client.apellidos}`,
          referencia: 'WALLET-' + cedula,
          origen: 'wallet',
          lines: [
            { cuenta: rule.cuenta_debe, debe: amountVes, haber: 0 },
            { cuenta: rule.cuenta_haber, debe: 0, haber: amountVes }
          ]
        });
      }
      api.addAuditLog('recargar', 'billetera', `Recarga wallet ${moneda} $${monto} a ${client.nombres} ${client.apellidos}`, cedula);
      persist();
      return client;
    },

    /* conductores */
    upsertDriver(data) {
      const cedErr = idError(data.cedula_rif);
      if (cedErr) throw new Error(cedErr);
      const cedula = normId(data.cedula_rif);
      if (!cedula) throw new Error('La Cédula / RIF es obligatoria.');
      const mailErr = emailError(data.correo);
      if (mailErr) throw new Error(mailErr);
      const telErr = phoneError(data.telefono);
      if (telErr) throw new Error(telErr);
      const telPagoErr = phoneError(data.telefono_pago_movil);
      if (telPagoErr) throw new Error(telPagoErr);
      const cedPagoErr = idError(data.cedula_pago_movil);
      if (cedPagoErr) throw new Error(cedPagoErr);
      const comPct = Number(data.porcentaje_comision);
      if (!isFinite(comPct) || comPct < 0 || comPct > 100) throw new Error('El % de comisión debe estar entre 0 y 100.');
      money(data.saldo_por_liquidar_usd, 'Saldo por liquidar');
      const anio = Number(data.anio) || new Date().getFullYear();
      if (anio < 1990 || anio > 2030) throw new Error('El año del vehículo debe estar entre 1990 y 2030.');
      const existing = current.drivers.find((d) => d.cedula_rif === cedula);
      if (!existing && current.drivers.some((d) => d.cedula_rif === cedula)) {
        throw new Error('Ya existe un conductor con esa cédula / RIF.');
      }
      const rec = {
        ...(existing || {}),
        ...data,
        cedula_rif: cedula,
        nombres: required(data.nombres, 'Nombres'),
        apellidos: required(data.apellidos, 'Apellidos'),
        telefono: required(data.telefono, 'Teléfono móvil'),
        correo: required(data.correo, 'Correo electrónico'),
        direccion: required(data.direccion, 'Dirección completa'),
        telefono_pago_movil: required(data.telefono_pago_movil, 'Teléfono pago móvil'),
        cedula_pago_movil: required(data.cedula_pago_movil, 'Cédula pago móvil'),
        tipo_servicio: required(data.tipo_servicio, 'Tipo de servicio'),
        placa: required(data.placa, 'Placa'),
        marca: required(data.marca, 'Marca'),
        modelo: required(data.modelo, 'Modelo'),
        color: required(data.color, 'Color'),
        nivel: DRIVER_LEVELS.includes(data.nivel) ? data.nivel : (existing && DRIVER_LEVELS.includes(existing.nivel) ? existing.nivel : 'Zafiro'),
        porcentaje_comision: comPct,
        saldo_por_liquidar_usd: round(data.saldo_por_liquidar_usd),
        anio,
        urls_fotos_vehiculo: Array.isArray(data.urls_fotos_vehiculo) ? data.urls_fotos_vehiculo : [],
        docs_estado: data.docs_estado || (existing ? existing.docs_estado : {}),
        docs_meta: data.docs_meta || (existing ? existing.docs_meta : {}),
        url_seguro_rcv: data.url_seguro_rcv || (existing ? existing.url_seguro_rcv : ''),
        updated_at: stamp(),
        created_at: existing ? existing.created_at : stamp()
      };
      if (existing) Object.assign(existing, rec);
      else current.drivers.unshift(rec);
      api.addAuditLog(existing ? 'actualizar' : 'crear', 'conductores', `Conductor ${cedula} · ${data.nombres || ''} ${data.apellidos || ''}`, cedula);
      persist();
      return rec;
    },
    deleteDriver(cedula) {
      const hasSvc = current.services.some((s) => s.conductor_cedula_rif === cedula);
      if (hasSvc) throw new Error('No se puede eliminar: el conductor tiene servicios asociados.');
      current.drivers = current.drivers.filter((d) => d.cedula_rif !== cedula);
      api.addAuditLog('eliminar', 'conductores', `Conductor ${cedula}`, cedula);
      persist();
    },
    setDocStatus(cedula, docKey, status) {
      const d = current.drivers.find((x) => x.cedula_rif === cedula);
      if (!d) return;
      d.docs_estado = { ...(d.docs_estado || {}), [docKey]: status };
      if (status === 'Aprobado' && docKey !== 'vehiculo') {
        const all = ['cedula', 'rif', 'licencia', 'circulacion'].every((k) => d.docs_estado[k] === 'Aprobado');
        if (all && d.estatus_conductor === 'En Revisión Documental') d.estatus_conductor = 'Activo / Disponible';
      }
      d.updated_at = stamp();
      api.addAuditLog('actualizar_documento', 'conductores', `Documento ${docKey} → ${status} para conductor ${cedula}`, cedula);
      persist();
    },

    /* proveedores */
    upsertSupplier(data) {
      const rifErr = idError(data.rif);
      if (rifErr) throw new Error(rifErr);
      const rif = normId(data.rif);
      if (!rif) throw new Error('El RIF es obligatorio.');
      if (data.retencion_iva_pct != null && ![0, 75, 100].includes(Number(data.retencion_iva_pct))) {
        throw new Error('La retención de IVA debe ser 0 %, 75 % o 100 %.');
      }
      const existing = current.suppliers.find((s) => s.rif === rif);
      if (!existing && current.suppliers.some((s) => s.rif === rif)) {
        throw new Error('Ya existe un proveedor con ese RIF.');
      }
      const mailErr = emailError(data.correo);
      if (mailErr) throw new Error(mailErr);
      const telErr = phoneError(data.telefono);
      if (telErr) throw new Error(telErr);
      const rec = { ...(existing || {}), ...data, rif,
        razon_social: required(data.razon_social, 'Razón social'),
        telefono: required(data.telefono, 'Teléfono'),
        direccion: required(data.direccion, 'Dirección fiscal'),
        correo: data.correo || '',
        actividad: data.actividad || '',
        estatus: data.estatus || 'Activo',
        tipo_persona: data.tipo_persona || 'PJ_DOM',
        retencion_iva_pct: Number(data.retencion_iva_pct) || 75,
        updated_at: stamp(),
        created_at: existing ? existing.created_at : stamp() };
      if (existing) Object.assign(existing, rec);
      else current.suppliers.unshift(rec);
      api.addAuditLog(existing ? 'actualizar' : 'crear', 'proveedores', `Proveedor ${rif} · ${data.razon_social || ''}`, rif);
      persist();
      return rec;
    },
    deleteSupplier(rif) {
      const used = current.payables.some((p) => p.proveedor_rif === rif);
      if (used) throw new Error('No se puede eliminar: el proveedor tiene facturas registradas.');
      current.suppliers = current.suppliers.filter((s) => s.rif !== rif);
      api.addAuditLog('eliminar', 'proveedores', `Proveedor ${rif}`, rif);
      persist();
    },

    /* negocios asociados (comercios aliados) */
    partner(rif) {
      const p = current.partners.find((x) => x.rif === rif);
      return p ? clone(p) : null;
    },
    upsertPartner(data) {
      const rifErr = idError(data.rif);
      if (rifErr) throw new Error(rifErr);
      const rif = normId(data.rif);
      const existing = current.partners.find((p) => p.rif === rif);
      if (!existing && current.partners.some((p) => p.rif === rif)) {
        throw new Error('Ya existe un negocio asociado con ese RIF.');
      }
      const comPct = Number(data.comision_pct ?? 10);
      if (!isFinite(comPct) || comPct < 0 || comPct > 100) throw new Error('El % de comisión debe estar entre 0 y 100.');
      const mailErr = emailError(data.correo);
      if (mailErr) throw new Error(mailErr);
      const telErr = phoneError(data.telefono);
      if (telErr) throw new Error(telErr);
      if (data.tipo && !PARTNER_TYPES.includes(data.tipo)) throw new Error('Selecciona un tipo de negocio válido.');
      const rec = {
        ...(existing || {}),
        ...data,
        rif,
        razon_social: required(data.razon_social, 'Razón social'),
        tipo: data.tipo || 'Comercio',
        contacto: data.contacto || '',
        telefono: required(data.telefono, 'Teléfono'),
        correo: data.correo || '',
        direccion: required(data.direccion, 'Dirección'),
        comision_pct: comPct,
        estatus: data.estatus || 'Activo',
        notas: data.notas || '',
        saldo_por_cobrar_usd: existing ? existing.saldo_por_cobrar_usd : 0,
        saldo_por_pagar_usd: existing ? existing.saldo_por_pagar_usd : 0,
        updated_at: stamp(),
        created_at: existing ? existing.created_at : stamp()
      };
      if (existing) Object.assign(existing, rec);
      else current.partners.unshift(rec);
      api.addAuditLog(existing ? 'actualizar' : 'crear', 'negocios_asociados', `Negocio ${rif} · ${rec.razon_social}`, rif);
      persist();
      return rec;
    },
    deletePartner(rif) {
      const used = current.partnerMovements.some((m) => m.partner_rif === rif && m.monto_usd);
      if (used) throw new Error('No se puede eliminar: el negocio tiene movimientos registrados.');
      current.partners = current.partners.filter((p) => p.rif !== rif);
      api.addAuditLog('eliminar', 'negocios_asociados', `Negocio ${rif}`, rif);
      persist();
    },
    addPartnerMovement(rif, data) {
      const partner = current.partners.find((p) => p.rif === rif);
      if (!partner) throw new Error('Negocio asociado no encontrado.');
      const tipo = data.tipo || 'comision';
      if (!PARTNER_MOVEMENT_TYPES[tipo]) throw new Error('Tipo de movimiento no válido.');
      const monto = moneyPositive(data.monto_usd, 'Monto');
      required(data.concepto, 'Concepto');
      if (tipo === 'cobro' && monto > partner.saldo_por_cobrar_usd + 0.01) {
        throw new Error('El cobro excede el saldo por cobrar (' + partner.saldo_por_cobrar_usd.toFixed(2) + ' USD).');
      }
      if (tipo === 'pago' && monto > partner.saldo_por_pagar_usd + 0.01) {
        throw new Error('El pago excede el saldo por pagar (' + partner.saldo_por_pagar_usd.toFixed(2) + ' USD).');
      }
      const mov = {
        id: uid('pmv'), partner_rif: rif, tipo, concepto: data.concepto,
        monto_usd: monto, fecha: data.fecha || today(), referencia: data.referencia || '',
        created_at: stamp()
      };
      if (tipo === 'comision') partner.saldo_por_cobrar_usd = round(partner.saldo_por_cobrar_usd + monto);
      else if (tipo === 'cobro') partner.saldo_por_cobrar_usd = round(partner.saldo_por_cobrar_usd - monto);
      else if (tipo === 'recaudacion') partner.saldo_por_pagar_usd = round(partner.saldo_por_pagar_usd + monto);
      else if (tipo === 'pago') partner.saldo_por_pagar_usd = round(partner.saldo_por_pagar_usd - monto);
      const rule = current.accountingRules.find((r) => r.evento === {
        comision: 'comision_asociado', cobro: 'cobro_asociado', recaudacion: 'recaudacion_asociado', pago: 'pago_asociado'
      }[tipo]);
      if (rule) {
        api.postEntry({
          fecha: mov.fecha,
          descripcion: PARTNER_MOVEMENT_TYPES[tipo].label + ' · ' + partner.razon_social,
          referencia: mov.id,
          origen: 'asociados',
          lines: [
            { cuenta: rule.cuenta_debe, debe: monto, haber: 0 },
            { cuenta: rule.cuenta_haber, debe: 0, haber: monto }
          ]
        });
      }
      current.partnerMovements.unshift(mov);
      partner.updated_at = stamp();
      api.addAuditLog('movimiento', 'negocios_asociados', `${PARTNER_MOVEMENT_TYPES[tipo].label} · ${partner.razon_social} · $${monto}`, rif);
      persist();
      return mov;
    },
    partnerMovements(rif) {
      return current.partnerMovements.filter((m) => m.partner_rif === rif);
    },

    /* parámetros de mantenimiento del sistema */
    systemParam(key) {
      const p = current.systemParams.find((x) => x.key === key);
      return p ? clone(p) : null;
    },
    upsertSystemParam(data) {
      const key = norm(data.key);
      if (!key) throw new Error('La clave del parámetro es obligatoria.');
      if (!/^[a-z0-9_]{3,40}$/.test(key)) throw new Error('La clave debe tener entre 3 y 40 caracteres (minúsculas, números y guion bajo).');
      const existing = current.systemParams.find((x) => x.key === key);
      if (!existing && current.systemParams.some((x) => x.key === key)) throw new Error('Ya existe un parámetro con esa clave.');
      const value = String(data.value || '');
      const tipo = data.tipo || 'texto';
      if (!['monto', 'porcentaje', 'texto', 'booleano', 'fecha'].includes(tipo)) throw new Error('Tipo de parámetro no válido.');
      if (tipo === 'porcentaje') {
        const n = Number(value);
        if (!isFinite(n) || n < 0 || n > 100) throw new Error('El porcentaje debe estar entre 0 y 100.');
      }
      if (tipo === 'monto') {
        const n = Number(value);
        if (!isFinite(n) || n < 0) throw new Error('El monto debe ser mayor o igual a cero.');
      }
      const rec = {
        ...(existing || {}),
        ...data,
        key,
        label: required(data.label, 'Etiqueta'),
        value,
        tipo,
        module: data.module || 'sistema',
        descripcion: data.descripcion || '',
        updated_at: stamp(),
        created_at: existing ? existing.created_at : stamp()
      };
      if (existing) Object.assign(existing, rec);
      else current.systemParams.unshift(rec);
      api.addAuditParam ? api.addAuditParam('actualizar', 'system_params', `Parámetro ${key} = ${value}`, key) : api.addAuditLog('actualizar', 'system_params', `Parámetro ${key} = ${value}`, key);
      persist();
      return rec;
    },
    deleteSystemParam(key) {
      current.systemParams = current.systemParams.filter((p) => p.key !== key);
      api.addAuditLog('eliminar', 'system_params', `Parámetro ${key}`, key);
      persist();
    },
    systemParams() {
      return current.systemParams.slice();
    },
    systemParamsByModule(module) {
      return current.systemParams.filter((p) => p.module === module);
    },

    /* tienda del conductor e inventario */
    product(sku) {
      const p = current.products.find((x) => x.sku === sku);
      return p ? clone(p) : null;
    },
    upsertProduct(data) {
      const sku = norm(data.sku).toUpperCase();
      if (!sku) throw new Error('El SKU es obligatorio.');
      if (!/^[A-Z0-9\-]{3,24}$/.test(sku)) throw new Error('El SKU debe tener entre 3 y 24 caracteres (A-Z, 0-9 y guiones).');
      const existing = current.products.find((p) => p.sku === sku);
      if (!existing && current.products.some((p) => p.sku === sku)) throw new Error('Ya existe un producto con ese SKU.');
      const precio = moneyPositive(data.precio_usd, 'Precio de venta');
      const costo = money(data.costo_usd, 'Costo');
      const stock = Number(data.stock);
      if (!isFinite(stock) || stock < 0 || Math.floor(stock) !== stock) throw new Error('El stock debe ser un entero mayor o igual a cero.');
      const stockMin = Number(data.stock_min ?? 0);
      if (!isFinite(stockMin) || stockMin < 0) throw new Error('El stock mínimo debe ser mayor o igual a cero.');
      if (data.categoria && !PRODUCT_CATEGORIES.includes(data.categoria)) throw new Error('Categoría de producto no válida.');
      const rec = {
        ...(existing || {}),
        ...data,
        sku,
        id: existing ? existing.id : 'prd_' + sku.toLowerCase(),
        nombre: required(data.nombre, 'Nombre del producto'),
        categoria: data.categoria || 'Equipamiento',
        precio_usd: precio,
        costo_usd: costo,
        stock,
        stock_min: stockMin,
        activo: data.activo !== false,
        descripcion: data.descripcion || '',
        updated_at: stamp(),
        created_at: existing ? existing.created_at : stamp()
      };
      if (existing) Object.assign(existing, rec);
      else current.products.unshift(rec);
      api.addAuditLog(existing ? 'actualizar' : 'crear', 'inventario', `Producto ${sku} · ${rec.nombre}`, sku);
      persist();
      return rec;
    },
    adjustStock(sku, delta, motivo) {
      const p = current.products.find((x) => x.sku === sku);
      if (!p) throw new Error('Producto no encontrado.');
      const d = Number(delta);
      if (!isFinite(d) || d === 0) throw new Error('El ajuste de stock debe ser un número distinto de cero.');
      const nuevo = p.stock + d;
      if (nuevo < 0) throw new Error('El stock no puede quedar negativo.');
      p.stock = nuevo;
      p.updated_at = stamp();
      api.addAuditLog('ajuste_stock', 'inventario', `${p.nombre}: ${d > 0 ? '+' : ''}${d} unidades${motivo ? ' · ' + motivo : ''}`, sku);
      persist();
      return p;
    },
    deleteProduct(sku) {
      const used = current.driverCharges.some((c) => c.producto_sku === sku && c.saldo_usd > 0.01);
      if (used) throw new Error('No se puede eliminar: el producto tiene financiamientos vigentes.');
      current.products = current.products.filter((p) => p.sku !== sku);
      api.addAuditLog('eliminar', 'inventario', `Producto ${sku}`, sku);
      persist();
    },
    assignProduct(cedula, data) {
      const driver = current.drivers.find((d) => d.cedula_rif === cedula);
      if (!driver) throw new Error('Conductor no encontrado.');
      const product = current.products.find((p) => p.sku === data.sku);
      if (!product) throw new Error('Selecciona un producto válido.');
      if (!product.activo) throw new Error('El producto está inactivo.');
      const cantidad = Number(data.cantidad || 1);
      if (!isFinite(cantidad) || cantidad < 1 || Math.floor(cantidad) !== cantidad) throw new Error('La cantidad debe ser un entero mayor o igual a 1.');
      if (cantidad > product.stock) throw new Error('Stock insuficiente: disponibles ' + product.stock + ' unidades.');
      const cuotas = Number(data.cuotas || 1);
      if (!isFinite(cuotas) || cuotas < 1 || Math.floor(cuotas) !== cuotas || cuotas > 52) throw new Error('Las cuotas deben ser un entero entre 1 y 52.');
      const total = round(product.precio_usd * cantidad);
      const charge = {
        id: uid('dchg'), conductor_cedula_rif: cedula, producto_sku: product.sku,
        producto_nombre: product.nombre, cantidad, precio_unit_usd: product.precio_usd,
        total_usd: total, cuotas, cuota_usd: round(total / cuotas), saldo_usd: total, pagado_usd: 0,
        fecha: data.fecha || today(), estatus: 'Vigente', created_at: stamp(), updated_at: stamp()
      };
      product.stock -= cantidad;
      product.updated_at = stamp();
      current.driverCharges.unshift(charge);
      current.driverMovements.unshift({
        id: uid('dmv'), conductor_cedula_rif: cedula, tipo: 'producto',
        concepto: 'Financiamiento ' + product.nombre + ' · ' + cuotas + ' cuota(s)',
        monto_usd: -total, fecha: charge.fecha, referencia: charge.id, created_at: stamp()
      });
      const sale = current.accountingRules.find((r) => r.evento === 'venta_tienda_conductor');
      const cost = current.accountingRules.find((r) => r.evento === 'costo_tienda_conductor');
      if (sale) {
        api.postEntry({
          fecha: charge.fecha, descripcion: 'Venta financiada ' + product.nombre + ' · ' + driver.nombres + ' ' + driver.apellidos,
          referencia: charge.id, origen: 'tienda',
          lines: [
            { cuenta: sale.cuenta_debe, debe: total, haber: 0 },
            { cuenta: sale.cuenta_haber, debe: 0, haber: total }
          ]
        });
      }
      if (cost) {
        const costo = round(product.costo_usd * cantidad);
        if (costo > 0) {
          api.postEntry({
            fecha: charge.fecha, descripcion: 'Costo de artículo entregado · ' + product.nombre,
            referencia: charge.id, origen: 'tienda',
            lines: [
              { cuenta: cost.cuenta_debe, debe: costo, haber: 0 },
              { cuenta: cost.cuenta_haber, debe: 0, haber: costo }
            ]
          });
        }
      }
      api.addAuditLog('asignar', 'inventario', `${product.nombre} x${cantidad} a ${driver.nombres} ${driver.apellidos} · $${total} · ${cuotas} cuota(s)`, cedula);
      persist();
      return { charge, driver, product };
    },
    payDriverCharge(chargeId, montoUsd, data) {
      const charge = current.driverCharges.find((c) => c.id === chargeId);
      if (!charge) throw new Error('Financiamiento no encontrado.');
      const monto = moneyPositive(montoUsd, 'Monto de la cuota');
      if (monto > charge.saldo_usd + 0.01) throw new Error('El monto excede el saldo del financiamiento (' + charge.saldo_usd.toFixed(2) + ' USD).');
      charge.pagado_usd = round(charge.pagado_usd + monto);
      charge.saldo_usd = round(charge.saldo_usd - monto);
      charge.estatus = charge.saldo_usd <= 0.01 ? 'Pagado' : 'Vigente';
      charge.updated_at = stamp();
      const d = current.drivers.find((x) => x.cedula_rif === charge.conductor_cedula_rif);
      api.postEntry({
        fecha: (data && data.fecha) || today(),
        descripcion: 'Abono de financiamiento · ' + charge.producto_nombre + ' · ' + (d ? d.nombres + ' ' + d.apellidos : charge.conductor_cedula_rif),
        referencia: charge.id, origen: 'tienda',
        lines: [
          { cuenta: '1.1.1.02', debe: monto, haber: 0 },
          { cuenta: '1.1.2.02', debe: 0, haber: monto }
        ]
      });
      api.addAuditLog('cobrar', 'inventario', `Abono financiamiento ${charge.producto_nombre} · $${monto}`, charge.conductor_cedula_rif);
      persist();
      return charge;
    },
    driverCharges(cedula) {
      return current.driverCharges.filter((c) => c.conductor_cedula_rif === cedula);
    },
    driverMovements(cedula) {
      return current.driverMovements.filter((m) => m.conductor_cedula_rif === cedula);
    },
    driverWallet(cedula) {
      const movs = current.driverMovements.filter((m) => m.conductor_cedula_rif === cedula);
      const sum = (tipo) => round(movs.filter((m) => m.tipo === tipo).reduce((s, m) => s + m.monto_usd, 0));
      const ganancias = sum('ganancia');
      const comisiones = Math.abs(sum('comision'));
      const productos = Math.abs(sum('producto'));
      const pagos = Math.abs(sum('pago')) + Math.abs(sum('pago_producto'));
      const tarifas = Math.abs(sum('tarifa_plana'));
      const saldo = round(movs.reduce((s, m) => s + m.monto_usd, 0));
      const deuda = round(current.driverCharges.filter((c) => c.conductor_cedula_rif === cedula && c.saldo_usd > 0).reduce((s, c) => s + c.saldo_usd, 0));
      return { movimientos: movs, ganancias, comisiones, productos, pagos, tarifas, saldo, deuda };
    },
    applyTarifaPlana(cedula, data) {
      const driver = current.drivers.find((d) => d.cedula_rif === cedula);
      if (!driver) throw new Error('Conductor no encontrado.');
      const param = current.systemParams.find((p) => p.key === 'tarifa_plana_semanal_usd');
      const monto = param ? Number(param.value) : 0;
      if (!monto || monto <= 0) throw new Error('No hay tarifa plana configurada en Parámetros del Sistema.');
      const fecha = (data && data.fecha) || today();
      const referencia = (data && data.referencia) || 'TARIFA-' + cedula;
      const mov = {
        id: uid('dmv'), conductor_cedula_rif: cedula, tipo: 'tarifa_plana',
        concepto: 'Tarifa plana semanal · ' + fecha,
        monto_usd: -round(monto), fecha, referencia, created_at: stamp()
      };
      current.driverMovements.unshift(mov);
      api.addAuditLog('tarifa_plana', 'conductores', `Tarifa plana semanal aplicada a ${driver.nombres} ${driver.apellidos} · $${monto}`, cedula);
      persist();
      return mov;
    },

    /* alertas documentales (vencimientos) */
    docAlerts(driver) {
      if (!driver) return [];
      const meta = driver.docs_meta || {};
      const keys = ['cedula', 'rif', 'licencia', 'circulacion', 'rcv'];
      const labels = { cedula: 'Cédula de Identidad', rif: 'RIF Personal', licencia: 'Licencia de Conducir', circulacion: 'Carnet de Circulación', rcv: 'Seguro RCV' };
      const hoy = today();
      return keys.map((k) => {
        const m = meta[k] || {};
        const vence = m.vencimiento || '';
        let dias = null;
        if (vence) dias = Math.round((new Date(vence + 'T12:00:00') - new Date(hoy + 'T12:00:00')) / 86400000);
        return {
          key: k, label: labels[k], emision: m.emision || '', vencimiento: vence, origen: m.origen || 'manual',
          dias, vencido: dias != null && dias < 0,
          porVencer: dias != null && dias >= 0 && dias <= 30,
          sinFecha: !vence
        };
      });
    },
    documentAlerts() {
      const out = [];
      current.drivers.forEach((d) => {
        this.docAlerts(d).forEach((a) => {
          if (a.vencido || a.porVencer) out.push({ driver: d, alert: a });
        });
      });
      return out.sort((a, b) => (a.alert.dias ?? 9999) - (b.alert.dias ?? 9999));
    },
    setDocMeta(cedula, key, meta) {
      const d = current.drivers.find((x) => x.cedula_rif === cedula);
      if (!d) throw new Error('Conductor no encontrado.');
      const vencimiento = meta && meta.vencimiento ? String(meta.vencimiento) : '';
      const emision = meta && meta.emision ? String(meta.emision) : '';
      if (vencimiento && !/^\d{4}-\d{2}-\d{2}$/.test(vencimiento)) throw new Error('La fecha de vencimiento no es válida.');
      if (emision && !/^\d{4}-\d{2}-\d{2}$/.test(emision)) throw new Error('La fecha de emisión no es válida.');
      if (emision && vencimiento && vencimiento < emision) throw new Error('El vencimiento no puede ser anterior a la emisión.');
      d.docs_meta = { ...(d.docs_meta || {}), [key]: { emision, vencimiento, origen: (meta && meta.origen) || 'manual' } };
      d.updated_at = stamp();
      api.addAuditLog('actualizar_documento', 'conductores', `Fechas ${key} → ${emision || '—'} / ${vencimiento || '—'} para ${cedula}`, cedula);
      api.revalidateDriverStatus(cedula);
      persist();
      return d.docs_meta[key];
    },
    revalidateDriverStatus(cedula) {
      const d = current.drivers.find((x) => x.cedula_rif === cedula);
      if (!d) return;
      const alerts = api.docAlerts(d);
      const vencido = alerts.some((a) => a.vencido);
      if (vencido) {
        if (d.estatus_conductor !== 'Suspendido') {
          d.estatus_conductor = 'Inactivo por Documentos Vencidos';
          d.inactivado_por_documentos = true;
          d.updated_at = stamp();
          persist();
        }
        return;
      }
      if (d.inactivado_por_documentos && d.estatus_conductor === 'Inactivo por Documentos Vencidos') {
        d.estatus_conductor = 'Activo / Disponible';
        d.inactivado_por_documentos = false;
        d.updated_at = stamp();
        persist();
      }
    },

    /* cuentas por pagar */
    addPayable(data) {
      const rifErr = idError(data.proveedor_rif);
      if (rifErr) throw new Error(rifErr);
      const supplier = current.suppliers.find((s) => s.rif === data.proveedor_rif);
      if (!supplier) throw new Error('Selecciona un proveedor válido.');
      required(data.numero_factura, 'N° Factura');
      required(data.concepto, 'Concepto');
      money(data.base_usd, 'Base imponible');
      money(data.exento_usd, 'Monto exento');
      const ivaPct = Number(data.iva_pct ?? 16);
      if (!isFinite(ivaPct) || ivaPct < 0 || ivaPct > 100) throw new Error('El % de IVA debe estar entre 0 y 100.');
      const igtfPct = Number(data.igtf_pct ?? 3);
      if (!isFinite(igtfPct) || igtfPct < 0 || igtfPct > 100) throw new Error('El % de IGTF debe estar entre 0 y 100.');
      const retIvaPct = Number(data.ret_iva_pct ?? 75);
      if (![0, 75, 100].includes(retIvaPct)) throw new Error('La retención de IVA debe ser 0 %, 75 % o 100 %.');
      const tasa = Number(data.tasa_bcv || current.taxParams.bcvRate);
      if (!tasa || tasa <= 0) throw new Error('La tasa BCV debe ser mayor a cero.');
      required(data.fecha_emision, 'Fecha emisión');
      required(data.fecha_vencimiento, 'Fecha vencimiento');
      const comp = computePayable({ ...data, tipo_persona: supplier.tipo_persona, iva_pct: ivaPct, igtf_pct: igtfPct, ret_iva_pct: retIvaPct, tasa_bcv: tasa });
      const prefix = 'CXP-' + new Date().getFullYear() + '-';
      let max = 299;
      current.payables.forEach((p) => {
        if (String(p.id || '').startsWith(prefix)) max = Math.max(max, Number(p.id.slice(prefix.length)) || 0);
      });
      const p = {
        id: prefix + String(max + 1).padStart(3, '0'),
        numero_factura: data.numero_factura || String(Date.now()).slice(-8),
        numero_control: data.numero_control || '',
        proveedor_rif: data.proveedor_rif,
        fecha_emision: data.fecha_emision || today(),
        fecha_vencimiento: data.fecha_vencimiento || today(),
        concepto: data.concepto || 'Factura de compra',
        tipo: 'compra',
        pagado_usd: 0,
        estatus: 'Pendiente',
        comprobante_numero: '',
        created_at: stamp(),
        ...comp
      };
      current.payables.unshift(p);
      const entry = postPurchaseEntries(current, p);
      const voucher = createVoucherInternal(current, p);
      api.addAuditLog('crear', 'cuentas_por_pagar', `Factura ${p.numero_factura} · ${p.proveedor_rif} · $${p.total_usd}`, p.id);
      persist();
      return { payable: p, entry, voucher };
    },
    addPayment(payableId, data) {
      const p = current.payables.find((x) => x.id === payableId);
      if (!p) throw new Error('Factura no encontrada.');
      const monto = round(data.monto_usd);
      if (monto <= 0) throw new Error('El monto del pago debe ser mayor a cero.');
      const pendiente = round(p.neto_pagar_usd - p.pagado_usd);
      if (monto > pendiente + 0.01) throw new Error('El pago excede el saldo pendiente (' + pendiente.toFixed(2) + ' USD).');
      p.pagado_usd = round(p.pagado_usd + monto);
      p.estatus = p.pagado_usd >= p.neto_pagar_usd - 0.01 ? 'Pagado' : 'Pagado Parcial';
      p.fecha_ultimo_pago = data.fecha || today();
      p.metodo_pago = data.metodo || 'Transferencia';
      p.pagos = p.pagos || [];
      p.pagos.push({ fecha: data.fecha || today(), monto_usd: monto, metodo: data.metodo || 'Transferencia', referencia: data.referencia || '' });
      const rule = current.accountingRules.find((r) => r.evento === 'pago_proveedor');
      const amountVes = round(monto * current.taxParams.bcvRate);
      if (rule) {
        api.postEntry({
          fecha: data.fecha || today(),
          descripcion: 'Pago factura N° ' + p.numero_factura + ' · ' + p.proveedor_rif,
          referencia: p.id,
          origen: 'pago',
          lines: [
            { cuenta: '2.1.1.01', debe: amountVes, haber: 0 },
            { cuenta: rule.cuenta_haber, debe: 0, haber: amountVes }
          ]
        });
      }
      api.addAuditLog('pagar', 'cuentas_por_pagar', `Pago factura ${p.numero_factura} · $${monto} · ${data.metodo || 'Transferencia'}`, p.id);
      persist();
      return p;
    },
    deletePayable(id) {
      const p = current.payables.find((x) => x.id === id);
      if (p && p.pagado_usd > 0) throw new Error('No se puede eliminar: la factura tiene pagos registrados. Anula los pagos primero.');
      current.payables = current.payables.filter((p) => p.id !== id);
      current.withholdings = current.withholdings.filter((v) => v.factura_id !== id);
      current.entries = current.entries.filter((e) => e.referencia !== id);
      api.addAuditLog('eliminar', 'cuentas_por_pagar', `Factura ${id}`, id);
      persist();
    },

    /* asientos manuales */
    postEntry(data) {
      const entry = postEntryInternal(current, data);
      api.addAuditLog('registrar', 'asientos', `Asiento ${entry.numero} · ${data.descripcion || ''} · $${data.lines.reduce((s, l) => s + l.debe, 0).toFixed(2)}`, entry.referencia || entry.id);
      persist();
      return entry;
    },
    deleteEntry(id) {
      current.entries = current.entries.filter((e) => e.id !== id);
      api.addAuditLog('eliminar', 'asientos', `Asiento ${id}`, id);
      persist();
    },

    /* plan de cuentas */
    upsertAccount(data) {
      const codigo = norm(data.codigo);
      if (!codigo) throw new Error('El código contable es obligatorio.');
      if (!accountCodeValid(codigo)) throw new Error('El código contable tiene un formato inválido (ejemplo: 6.1.2.01).');
      required(data.nombre, 'Nombre de la cuenta');
      const existing = current.accounts.find((a) => a.codigo === codigo);
      const rec = {
        ...(existing || {}),
        ...data,
        codigo,
        id: 'cta_' + codigo.replace(/\./g, '_'),
        moneda: data.moneda || 'VES',
        estado: data.estado || 'Activa',
        created_at: existing ? existing.created_at : stamp()
      };
      if (existing) Object.assign(existing, rec);
      else current.accounts.push(rec);
      current.accounts.sort((a, b) => a.codigo.localeCompare(b.codigo, undefined, { numeric: true }));
      api.addAuditLog(existing ? 'actualizar' : 'crear', 'plan_de_cuentas', `Cuenta ${codigo} · ${data.nombre || ''}`, codigo);
      persist();
      return rec;
    },
    deleteAccount(codigo) {
      if (current.accounts.some((a) => a.codigo.startsWith(codigo + '.'))) throw new Error('No se puede eliminar: la cuenta tiene subcuentas.');
      if (current.entries.some((e) => e.lines.some((l) => l.cuenta === codigo))) throw new Error('No se puede eliminar: la cuenta tiene movimientos contables.');
      current.accounts = current.accounts.filter((a) => a.codigo !== codigo);
      api.addAuditLog('eliminar', 'plan_de_cuentas', `Cuenta ${codigo}`, codigo);
      persist();
    },

    /* reglas */
    saveRule(data) {
      const existing = current.accountingRules.find((r) => r.evento === data.evento);
      if (existing) Object.assign(existing, data, { updated_at: stamp() });
      else current.accountingRules.push({ ...data, id: 'rule_' + data.evento, updated_at: stamp() });
      api.addAuditLog(existing ? 'actualizar' : 'crear', 'reglas_contables', `Regla ${data.evento}`, data.evento);
      persist();
    },

    /* servicios */
    addService(data) {
      required(data.cliente_cedula_rif, 'Cliente');
      required(data.conductor_cedula_rif, 'Conductor');
      required(data.origen, 'Origen');
      required(data.destino, 'Destino');
      const client = current.clients.find((c) => c.cedula_rif === data.cliente_cedula_rif);
      const driver = current.drivers.find((d) => d.cedula_rif === data.conductor_cedula_rif);
      if (!client) throw new Error('El cliente no existe en el maestro.');
      if (!driver) throw new Error('El conductor no existe en el maestro.');
      if (driver.estatus_conductor === 'Inactivo por Documentos Vencidos') {
        throw new Error('El conductor está inactivo por documentos vencidos. Actualiza su expediente antes de asignarle servicios.');
      }
      const base = moneyPositive(data.base_usd, 'Tarifa base');
      const ivaPct = Number(data.iva_pct || 0);
      if (!isFinite(ivaPct) || ivaPct < 0 || ivaPct > 100) throw new Error('El % de IVA debe estar entre 0 y 100.');
      const iva = round(base * ivaPct / 100);
      const igtfPct = Number(data.igtf_pct || 0);
      if (!isFinite(igtfPct) || igtfPct < 0 || igtfPct > 100) throw new Error('El % de IGTF debe estar entre 0 y 100.');
      const igtf = round((base + iva) * igtfPct / 100);
      const total = round(base + iva + igtf);
      const nivelKey = 'comision_nivel_' + (driver.nivel || 'Zafiro').toLowerCase() + '_pct';
      const paramNivel = NS.store.systemParam(nivelKey);
      const comPct = Number(data.comision_pct ?? (paramNivel ? Number(paramNivel.value) : driver.porcentaje_comision));
      if (!isFinite(comPct) || comPct < 0 || comPct > 100) throw new Error('El % de comisión debe estar entre 0 y 100.');
      const comision = round(base * comPct / 100);
      const distancia = Number(data.distancia_km) || 0;
      const duracion = Number(data.duracion_min) || 0;
      if (distancia < 0 || duracion < 0) throw new Error('La distancia y la duración deben ser mayores o iguales a cero.');
      const svc = {
        id: nextServiceId(),
        tipo: data.tipo,
        cliente_cedula_rif: client.cedula_rif,
        conductor_cedula_rif: driver.cedula_rif,
        fecha: data.fecha || today(),
        origen: norm(data.origen) || 'Origen no indicado',
        destino: norm(data.destino) || 'Destino no indicado',
        distancia_km: Number(data.distancia_km) || 0,
        duracion_min: Number(data.duracion_min) || 0,
        base_usd: base, iva_pct: ivaPct, iva_usd: iva, igtf_pct: igtfPct, igtf_usd: igtf, total_usd: total,
        comision_pct: comPct, comision_usd: comision, pago_conductor_usd: round(base - comision),
        metodo_pago: data.metodo_pago || 'Pago Móvil',
        estatus: 'Completado',
        factura_numero: data.factura_numero || 'FAC-' + String(Date.now()).slice(-6),
        control_numero: data.control_numero || '',
        notas: data.notas || '',
        created_at: stamp()
      };
      current.services.unshift(svc);
      if (svc.tipo === 'carrera') client.total_carreras = (client.total_carreras || 0) + 1;
      else client.total_encomiendas = (client.total_encomiendas || 0) + 1;
      driver.saldo_por_liquidar_usd = round(driver.saldo_por_liquidar_usd + svc.pago_conductor_usd);
      // Historial de wallet del conductor (ganancia bruta, comisión y neto).
      current.driverMovements.unshift({
        id: uid('dmv'), conductor_cedula_rif: driver.cedula_rif, tipo: 'ganancia',
        concepto: 'Ganancia por ' + (svc.tipo === 'carrera' ? 'carrera' : 'encomienda') + ' ' + svc.id,
        monto_usd: base, fecha: svc.fecha, referencia: svc.id, created_at: stamp()
      });
      current.driverMovements.unshift({
        id: uid('dmv'), conductor_cedula_rif: driver.cedula_rif, tipo: 'comision',
        concepto: 'Comisión ENVIA (' + comPct + '%) · ' + svc.id,
        monto_usd: -comision, fecha: svc.fecha, referencia: svc.id, created_at: stamp()
      });
      if (svc.metodo_pago === 'Wallet') {
        const pay = svc.total_usd;
        if (client.saldo_wallet_usd >= pay) client.saldo_wallet_usd = round(client.saldo_wallet_usd - pay);
        else if (client.saldo_wallet_ves >= round(pay * current.taxParams.bcvRate)) client.saldo_wallet_ves = round(client.saldo_wallet_ves - pay * current.taxParams.bcvRate);
      }
      postServiceEntries(current, svc);
      api.addAuditLog('crear', 'servicios', `Servicio ${svc.id} · ${svc.tipo} · ${svc.cliente_cedula_rif} → ${svc.conductor_cedula_rif} · $${svc.total_usd}`, svc.id);
      persist();
      return svc;
    },
    deleteService(id) {
      current.services = current.services.filter((s) => s.id !== id);
      api.addAuditLog('eliminar', 'servicios', `Servicio ${id}`, id);
      persist();
    },

    settleDriver(cedula, data) {
      const driver = current.drivers.find((d) => d.cedula_rif === cedula);
      if (!driver) throw new Error('Conductor no encontrado.');
      const monto = round(data.monto_usd);
      if (monto <= 0) throw new Error('El monto debe ser mayor a cero.');
      if (monto > Number(driver.saldo_por_liquidar_usd) + 0.01) throw new Error('El monto excede el saldo por liquidar.');
      const amountVes = round(monto * current.taxParams.bcvRate);
      const rule = current.accountingRules.find((r) => r.evento === 'liquidacion_conductor');
      const bank = current.accountingRules.find((r) => r.evento === 'pago_proveedor');
      api.postEntry({
        fecha: data.fecha || today(),
        descripcion: 'Liquidación de saldo a conductor · ' + driver.nombres + ' ' + driver.apellidos,
        referencia: 'LIQ-' + cedula,
        origen: 'liquidacion',
        lines: [
          { cuenta: rule ? rule.cuenta_haber : '2.1.1.02', debe: amountVes, haber: 0 },
          { cuenta: bank ? bank.cuenta_haber : '1.1.1.02', debe: 0, haber: amountVes }
        ]
      });
      driver.saldo_por_liquidar_usd = round(driver.saldo_por_liquidar_usd - monto);
      driver.updated_at = stamp();
      current.driverMovements.unshift({
        id: uid('dmv'), conductor_cedula_rif: cedula, tipo: 'pago',
        concepto: 'Liquidación pagada · ' + ((data && data.metodo) || 'Pago Móvil'),
        monto_usd: -monto, fecha: (data && data.fecha) || today(), referencia: (data && data.referencia) || 'LIQ-' + cedula, created_at: stamp()
      });
      api.addAuditLog('liquidar', 'conductores', `Liquidación a ${driver.nombres} ${driver.apellidos} · $${monto}`, cedula);
      persist();
      return driver;
    },

    /* usuarios */
    upsertUser(data) {
      const usuario = norm(data.usuario).toUpperCase();
      if (!usuario) throw new Error('El usuario es obligatorio.');
      if (!data.password) throw new Error('La clave es obligatoria.');
      const role = current.roles.find((r) => r.nombre === data.rol);
      if (!role) throw new Error('Selecciona un rol válido.');
      const existing = current.users.find((u) => u.usuario.toUpperCase() === usuario);
      if (existing && existing.usuario === 'ENVIA' && data.rol !== 'SuperAdmin') throw new Error('El usuario ENVIA debe conservar el rol SuperAdmin.');
      const rec = {
        ...(existing || {}),
        ...data,
        id: existing ? existing.id : (data.id || uid('usr')),
        usuario,
        password: data.password,
        rol: data.rol,
        permisos: data.permisos && typeof data.permisos === 'object' ? clone(data.permisos) : null,
        activo: data.activo !== false,
        updated_at: stamp(),
        created_at: existing ? existing.created_at : stamp()
      };
      if (existing) Object.assign(existing, rec);
      else current.users.push(rec);
      api.addAuditLog(existing ? 'actualizar' : 'crear', 'usuarios', `Usuario ${usuario} · ${data.rol || ''}`, usuario);
      persist();
      return rec;
    },
    deleteUser(id) {
      const u = current.users.find((x) => x.id === id);
      if (!u) return;
      if (u.usuario === 'ENVIA') throw new Error('No puedes eliminar el usuario maestro ENVIA.');
      current.users = current.users.filter((x) => x.id !== id);
      api.addAuditLog('eliminar', 'usuarios', `Usuario ${u.usuario}`, id);
      persist();
    },
    authenticate(usuario, password) {
      const u = current.users.find((x) => x.usuario.toUpperCase() === norm(usuario).toUpperCase() && x.password === password);
      if (!u) throw new Error('Usuario o clave incorrectos.');
      if (!u.activo) throw new Error('El usuario se encuentra inactivo. Contacta al SuperAdmin.');
      return u;
    },

    /* contabilidad: consultas */
    account(code) { return current.accounts.find((a) => a.codigo === code); },
    accountName(code) { const a = api.account(code); return a ? a.nombre : code; },

    getAccountBalances() {
      const map = {};
      current.accounts.forEach((a) => { map[a.codigo] = { account: a, debe: 0, haber: 0 }; });
      current.entries.forEach((e) => e.lines.forEach((l) => {
        if (!map[l.cuenta]) map[l.cuenta] = { account: { codigo: l.cuenta, nombre: l.cuenta, nivel: 'Cuenta de Movimiento', naturaleza: 'Deudora' }, debe: 0, haber: 0 };
        map[l.cuenta].debe = round(map[l.cuenta].debe + l.debe);
        map[l.cuenta].haber = round(map[l.cuenta].haber + l.haber);
      }));
      return Object.values(map).map((r) => {
        const deudora = (r.account.naturaleza || 'Deudora') === 'Deudora';
        const saldo = round(r.debe - r.haber);
        return { ...r, saldo, saldoDeudor: saldo > 0 ? saldo : 0, saldoAcreedor: saldo < 0 ? -saldo : 0, deudora };
      });
    },
    trialBalance() {
      return api.getAccountBalances()
        .filter((r) => r.debe || r.haber)
        .map((r) => ({
          codigo: r.account.codigo, nombre: r.account.nombre,
          debe: r.debe, haber: r.haber,
          deudor: r.saldo > 0 ? r.saldo : 0,
          acreedor: r.saldo < 0 ? -r.saldo : 0
        }));
    },
    incomeStatement() {
      const balances = api.getAccountBalances();
      const pick = (prefixes) => balances.filter((b) => b.account.nivel === 'Cuenta de Movimiento'
        && (b.debe || b.haber)
        && prefixes.some((p) => b.account.codigo === p || b.account.codigo.startsWith(p + '.')));
      const sum = (rows, key) => round(rows.reduce((s, r) => s + Math.abs(r[key]), 0));
      const incomeRows = pick(['4']);
      const costRows = pick(['5']);
      const expenseRows = pick(['6']);
      const income = sum(incomeRows, 'saldo');
      const cost = sum(costRows, 'saldo');
      const expense = sum(expenseRows, 'saldo');
      return {
        income, cost, expense,
        gross: round(income - cost),
        profit: round(income - cost - expense),
        incomeRows, costRows, expenseRows
      };
    },
    voucherNumber(periodo) { return periodo + String((current.meta.voucherSeq || 0) + 1).padStart(8, '0'); },

    /* métricas dashboard */
    metrics() {
      const services = current.services;
      const rides = services.filter((s) => s.tipo === 'carrera');
      const deliveries = services.filter((s) => s.tipo === 'encomienda');
      const sum = (arr, k) => round(arr.reduce((s, x) => s + Number(x[k] || 0), 0));
      const pending = round(current.payables.filter((p) => p.estatus !== 'Pagado').reduce((s, p) => s + (p.neto_pagar_usd - p.pagado_usd), 0));
      const driversPending = round(current.drivers.reduce((s, d) => s + Number(d.saldo_por_liquidar_usd || 0), 0));
      return {
        rideIncome: sum(rides, 'base_usd'),
        deliveryIncome: sum(deliveries, 'base_usd'),
        gross: round(sum(rides, 'base_usd') + sum(deliveries, 'base_usd')),
        commission: round(sum(services, 'comision_usd')),
        trips: services.length,
        ridesCount: rides.length,
        deliveriesCount: deliveries.length,
        activeDrivers: current.drivers.filter((d) => d.estatus_conductor === 'Activo / Disponible' || d.estatus_conductor === 'En Servicio').length,
        totalDrivers: current.drivers.length,
        pending,
        driversPending,
        iva: round(sum(services, 'iva_usd')),
        igtf: round(sum(services, 'igtf_usd')),
        ticketAvg: services.length ? round((sum(rides, 'base_usd') + sum(deliveries, 'base_usd')) / services.length) : 0,
        clients: current.clients.length,
        corporateClients: current.clients.filter((c) => c.estatus === 'Corporativo').length,
        partners: current.partners.length,
        activePartners: current.partners.filter((p) => p.estatus === 'Activo').length,
        partnersReceivable: round(current.partners.reduce((s, p) => s + Number(p.saldo_por_cobrar_usd || 0), 0)),
        partnersPayable: round(current.partners.reduce((s, p) => s + Number(p.saldo_por_pagar_usd || 0), 0)),
        inventoryValue: round(current.products.reduce((s, p) => s + Number(p.stock || 0) * Number(p.costo_usd || 0), 0)),
        lowStock: current.products.filter((p) => p.activo && p.stock <= p.stock_min).length,
        driverDebt: round(current.driverCharges.filter((c) => c.saldo_usd > 0).reduce((s, c) => s + Number(c.saldo_usd || 0), 0)),
        docAlerts: api.documentAlerts().length
      };
    },

    resetDemo() {
      current = buildSeed();
      api.addAuditLog('resetear', 'sistema', 'Restablecimiento de datos de demostración', 'demo');
      persist();
    },
    exportJSON() {
      const files = NS.supabase && NS.supabase.listFiles ? NS.supabase.listFiles() : {};
      return JSON.stringify({ exportedAt: stamp(), db: current, files }, null, 2);
    },
    importJSON(json) {
      const parsed = JSON.parse(json);
      if (!parsed.db || !parsed.db.clients) throw new Error('El archivo no tiene el formato de respaldo ENVIA.');
      current = parsed.db;
      ensureCatalogs(current);
      persist();
      if (parsed.files && NS.supabase && NS.supabase.importFiles) {
        NS.supabase.importFiles(parsed.files).catch((e) => console.warn('ENVIA: no se pudieron importar los archivos', e));
      }
    },
    storageInfo() {
      let dbBytes = 0;
      try { dbBytes = (localStorage.getItem(DB_KEY) || '').length; } catch (e) { /* ignore */ }
      const files = NS.supabase && NS.supabase.listFiles ? Object.keys(NS.supabase.listFiles()).length : 0;
      return {
        dbBytes,
        files,
        lastSavedAt: current.meta && current.meta.updatedAt ? current.meta.updatedAt : null,
        backup: !!localStorage.getItem(DB_BACKUP_KEY),
        schemaVersion: current.meta && current.meta.schemaVersion ? current.meta.schemaVersion : 0
      };
    },

    /* migración interna de esquema */
    migrateDatabase() {
      ensureSchema(current);
      return current.meta && current.meta.schemaVersion ? current.meta.schemaVersion : 0;
    },

    /* auditoría / bitácora */
    getCurrentUser() {
      try {
        const raw = sessionStorage.getItem('envia_session') || localStorage.getItem('envia_last_session');
        if (!raw) return null;
        const s = JSON.parse(raw);
        return s && s.usuario ? { usuario: s.usuario, nombre: s.nombre, rol: s.rol } : null;
      } catch (e) { return null; }
    },
    addAuditLog(accion, modulo, detalle, referencia) {
      const user = api.getCurrentUser();
      const ahora = new Date();
      const entrada = {
        id: uid('aud'),
        fecha: ahora.toISOString().slice(0, 10),
        hora: ahora.toTimeString().slice(0, 8),
        usuario: user ? user.usuario : 'sistema',
        nombre: user ? user.nombre : 'Sistema',
        rol: user ? user.rol : '—',
        accion, modulo, detalle: detalle || '', referencia: referencia || ''
      };
      current.auditLog.unshift(entrada);
      if (current.auditLog.length > 5000) current.auditLog.length = 5000;
      persist();
      return entrada;
    },
    getAuditLog() {
      return [...(current.auditLog || [])];
    },
    clearAuditLog() {
      current.auditLog = [];
      persist();
    }

  };

  NS.store = api;
})();
