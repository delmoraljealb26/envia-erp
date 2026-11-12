/* =========================================================================
   ENVIA ERP — services/chatbotService.js
   Asistente Inteligente ENVIA conectado a Google Gemini.

   - Widget flotante con sugerencias rápidas y Markdown seguro.
   - Credenciales guardadas únicamente en localStorage.
   - Contexto operativo filtrado por los módulos autorizados del usuario.
   - Sin dependencias externas, sin módulos ES: funciona con file://.
   ========================================================================= */
(function () {
  'use strict';

  const NS = (window.ENVIA = window.ENVIA || {});
  const CONFIG_KEY = 'envia_chatbot_v1';
  const DEFAULT_MODEL = 'gemini-1.5-pro';
  const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models/';
  const MAX_HISTORY_MESSAGES = 16;
  const FETCH_TIMEOUT_MS = 45000;
  const TEST_TIMEOUT_MS = 22000;

  const BASE_SYSTEM_PROMPT = "Eres el Asistente Inteligente corporativo de ENVIA ERP, un sistema en Venezuela. Tu propósito es ayudar al usuario a usar el sistema, entender cálculos SENIAT, retenciones, facturas, clientes, conductores y DolarAPI. Tienes PROHIBIDO responder preguntas sobre temas generales de la vida, política, clima, recetas o programación ajena al ERP. Si te preguntan algo fuera de ENVIA ERP, responde: 'Como asistente corporativo de ENVIA ERP, solo estoy autorizado para responder consultas sobre el funcionamiento de esta plataforma'.";

  const MODULES = {
    dashboard: {
      label: 'Dashboard', keywords: ['dashboard', 'panel principal', 'kpi', 'indicador', 'indicadores'],
      knowledge: 'Dashboard: ofrece la visión ejecutiva de la operación, ingresos, servicios recientes, cuentas por pagar, alertas documentales, stock y cartera de asociados.'
    },
    services: {
      label: 'Servicios', keywords: ['servicio', 'servicios', 'carrera', 'carreras', 'encomienda', 'encomiendas', 'delivery', 'viaje', 'viajes'],
      knowledge: 'Servicios: en Servicios → Nuevo servicio se registra una carrera o encomienda. Se captura la base en USD; el sistema calcula IVA, IGTF cuando aplica, comisión del conductor y genera el asiento automático. El listado permite buscar, exportar, imprimir y abrir Reportes.'
    },
    clients: {
      label: 'Clientes', keywords: ['cliente', 'clientes', 'cedula', 'cedulas', 'cédula', 'cédulas'],
      knowledge: 'Clientes: en Clientes → Nuevo cliente se usa la cédula/RIF como clave única con formato V-12345678, E-12345678 o J-123456789. Se pueden cargar documentos, consultar wallet y servicios. No se puede eliminar un cliente con servicios asociados.'
    },
    drivers: {
      label: 'Conductores y Flota', keywords: ['conductor', 'conductores', 'chofer', 'choferes', 'flota', 'vehiculo', 'vehículo', 'moto', 'wallet', 'liquidacion', 'liquidación', 'liquidaciones'],
      knowledge: 'Conductores y Flota: incluye expediente, documentos, vehículo, niveles Zafiro/Esmeralda/Diamante, wallet y liquidaciones. Los documentos tienen estado Pendiente, Aprobado o Rechazado. El conductor puede pasar a Activo / Disponible cuando sus documentos están aprobados.'
    },
    partners: {
      label: 'Negocios Asociados', keywords: ['negocio asociado', 'negocios asociados', 'aliado', 'aliados', 'comision', 'comisión', 'comisiones', 'recaudacion', 'recaudación'],
      knowledge: 'Negocios Asociados: administra comercios aliados, comisiones por cobrar, recaudaciones por pagar y movimientos de cartera. Los movimientos pueden ser comisión, cobro, recaudación, pago o ajuste.'
    },
    inventory: {
      label: 'Tienda & Inventario', keywords: ['inventario', 'tienda', 'producto', 'productos', 'stock', 'uniforme', 'uniformes', 'financiamiento', 'financiamientos'],
      knowledge: 'Tienda & Inventario: catálogo de uniformes y equipamiento, control de stock, asignación de productos a conductores y financiamiento por cuotas. Al asignar un producto se descuenta stock y se registra el movimiento del conductor.'
    },
    accounting: {
      label: 'Contabilidad', keywords: ['contabilidad', 'asiento', 'asientos', 'libro diario', 'libro mayor', 'balance', 'estado de resultados', 'partida doble', 'plan de cuentas', 'cuenta contable', 'cuentas contables'],
      knowledge: 'Contabilidad: trabaja con partida doble y exige DEBE = HABER con tolerancia máxima de 0,01 VES. Incluye plan de cuentas, reglas automáticas, asientos, libro diario, libro mayor, balance de comprobación, balance general, estado de resultados y libros de ventas/compras. Los reportes se imprimen o exportan a Excel.'
    },
    taxes: {
      label: 'Tributos & BCV', keywords: ['iva', 'igtf', 'islr', 'seniat', 'tributo', 'tributos', 'retencion', 'retenciones', 'retención', 'unidad tributaria', 'tasa bcv', 'bcv', 'dolarapi', 'dolarvzla'],
      knowledge: 'Tributos & BCV: IVA general 16 %, reducido 8 % y exento 0 %; IGTF 3 % cuando aplica; retención de IVA 75 % o 100 %; retención de ISLR según Decreto 1.808 (PN_RES 3 % con sustraendo de 10 UT, PJ_DOM 5 %, PN_NORES/PJ_NODOM 34 %). La UT y la tasa BCV son parámetros editables. La tasa oficial se consulta desde DolarVZLA/DolarAPI y se aplica al sistema.'
    },
    payables: {
      label: 'Cuentas por Pagar', keywords: ['cuentas por pagar', 'cxp', 'proveedor', 'proveedores', 'factura de compra', 'facturas de compra', 'pago a proveedor', 'pagos a proveedores', 'retencion de iva', 'retención de iva'],
      knowledge: 'Cuentas por Pagar: gestiona proveedores, facturas de compra, retenciones de IVA/ISLR, pagos y antigüedad de saldos. Al registrar una factura se calculan retenciones y se genera el asiento de compra. Los pagos actualizan el saldo pendiente y dejan trazabilidad.'
    },
    audit: {
      label: 'Bitácora de Auditoría', keywords: ['auditoria', 'auditoría', 'bitacora', 'bitácora', 'quien modifico', 'quién modificó'],
      knowledge: 'Bitácora de Auditoría: registra quién modificó qué, cuándo y con qué usuario. Sirve para trazabilidad y revisión de operaciones.'
    },
    users: {
      label: 'Usuarios del sistema', keywords: ['usuario', 'usuarios', 'rol', 'roles', 'permiso', 'permisos', 'rbac'],
      knowledge: 'Usuarios del sistema: administra usuarios, roles base o personalizados y permisos granulares por módulo, pestaña y acción. El usuario maestro ENVIA conserva el rol SuperAdmin y no puede eliminarse ni degradarse.'
    },
    settings: {
      label: 'Configuración del Sistema', keywords: ['configuracion', 'configuración', 'supabase', 'sincronizacion', 'sincronización', 'respaldo', 'restauracion', 'restauración', 'gemini', 'api key', 'asistente'],
      knowledge: 'Configuración del Sistema: permite ajustar parámetros, planes y eventos de conductores, integraciones de APIs, credenciales de Supabase, estado de conexión, mapa de sincronización y respaldos. Las credenciales de Gemini se guardan solo en el navegador del usuario.'
    }
  };

  const MODULE_ORDER = ['dashboard', 'services', 'clients', 'drivers', 'partners', 'inventory', 'accounting', 'taxes', 'payables', 'audit', 'users', 'settings'];

  let conversation = [];
  let widget = null;
  let el = {};
  let initialized = false;
  let closeTimer = null;
  let overlayObserver = null;

  function defaultConfig() {
    return { apiKey: '', model: DEFAULT_MODEL, updatedAt: null, lastTest: null };
  }

  function normalizeModel(value, strict) {
    let model = String(value || '').trim().replace(/^models\//i, '');
    if (!model) model = DEFAULT_MODEL;
    if (!/^[a-zA-Z0-9._-]+$/.test(model)) {
      if (strict) throw new Error('El modelo solo puede contener letras, números, puntos, guiones y guiones bajos.');
      return DEFAULT_MODEL;
    }
    return model;
  }

  function getConfig() {
    try {
      const raw = JSON.parse(localStorage.getItem(CONFIG_KEY)) || {};
      return {
        apiKey: String(raw.apiKey || '').trim(),
        model: normalizeModel(raw.model || DEFAULT_MODEL, false),
        updatedAt: raw.updatedAt || null,
        lastTest: raw.lastTest && typeof raw.lastTest === 'object' ? raw.lastTest : null
      };
    } catch (e) {
      return defaultConfig();
    }
  }

  function persistConfig(cfg) {
    try {
      localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));
    } catch (e) {
      throw new Error('No se pudo guardar la configuración en este navegador.');
    }
  }

  function saveConfig(data) {
    const apiKey = String((data && data.apiKey) || '').trim();
    if (!apiKey) throw new Error('Ingresa la API Key de Google Gemini.');
    if (/\s/.test(apiKey)) throw new Error('La API Key no debe contener espacios.');
    const model = normalizeModel(data && data.model, true);
    const current = getConfig();
    const cfg = {
      apiKey,
      model,
      updatedAt: new Date().toISOString(),
      lastTest: (apiKey === current.apiKey && model === current.model) ? (current.lastTest || null) : null
    };
    persistConfig(cfg);
    syncStatus();
    resetConversation();
    return cfg;
  }

  function clearConfig() {
    try {
      localStorage.removeItem(CONFIG_KEY);
    } catch (e) { /* almacenamiento no disponible */ }
    resetConversation();
    syncStatus();
  }

  function saveLastTest(result) {
    const cfg = getConfig();
    cfg.lastTest = {
      ok: !!(result && result.ok),
      message: String((result && result.message) || ''),
      model: (result && result.model) || cfg.model,
      at: new Date().toISOString()
    };
    persistConfig(cfg);
    syncStatus();
    return cfg.lastTest;
  }

  function isConfigured() {
    return !!getConfig().apiKey;
  }

  function normalizeText(value) {
    return String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function hasKeyword(text, keyword) {
    const k = normalizeText(keyword);
    if (!k) return false;
    const re = new RegExp('(^|[^a-z0-9])' + escapeRegExp(k) + '([^a-z0-9]|$)', 'i');
    return re.test(text);
  }

  function moduleLabel(key) {
    const meta = MODULES[key];
    return meta ? meta.label : key;
  }

  function allModules() {
    if (NS.router && NS.router.MODULES) {
      return Object.keys(NS.router.MODULES).filter((key) => !!MODULES[key] || key === 'reports');
    }
    return MODULE_ORDER.slice();
  }

  function moduleAllowed(key) {
    if (!NS.session || typeof NS.session.can !== 'function') return false;
    return !!NS.session.can(key);
  }

  function allowedModules() {
    return MODULE_ORDER.filter((key) => moduleAllowed(key));
  }

  function reportsAllowed() {
    if (!NS.session || typeof NS.session.canAction !== 'function') return false;
    return MODULE_ORDER.some((key) => moduleAllowed(key) && NS.session.canAction(key, 'reportes'));
  }

  function detectModules(message) {
    const text = normalizeText(message);
    const found = [];
    MODULE_ORDER.forEach((key) => {
      const meta = MODULES[key];
      if (!meta) return;
      if (meta.keywords.some((keyword) => hasKeyword(text, keyword))) found.push(key);
    });
    if (hasKeyword(text, 'reporte') || hasKeyword(text, 'reportes') || hasKeyword(text, 'informe') || hasKeyword(text, 'informes')) {
      found.push('reports');
    }
    return found.filter((key, index) => found.indexOf(key) === index);
  }

  function accessGuard(message) {
    const requested = detectModules(message);
    if (!requested.length) return { allowed: true, requested: requested };
    const blocked = requested.filter((key) => key !== 'reports' && !moduleAllowed(key));
    if (requested.includes('reports') && !reportsAllowed()) blocked.push('reports');
    if (!blocked.length) return { allowed: true, requested: requested };
    const blockedLabels = blocked.map((key) => key === 'reports' ? 'Reportes' : moduleLabel(key));
    const allowedLabels = allowedModules().map(moduleLabel);
    return {
      allowed: false,
      requested: requested,
      message: 'Tu rol no tiene acceso al módulo de ' + blockedLabels.join(', ') + '. Solo puedo ayudarte con: ' + (allowedLabels.length ? allowedLabels.join(', ') : 'los módulos habilitados para tu usuario') + '.'
    };
  }

  function fmtUsd(value) {
    const n = Number(value) || 0;
    return '$' + n.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function fmtVes(value) {
    const n = Number(value) || 0;
    return 'Bs ' + n.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function serviceLabel(service) {
    if (!service) return 'Servicio';
    return service.id || 'Servicio';
  }

  function buildKnowledge(allowed) {
    const lines = ['CONOCIMIENTO DEL ERP DISPONIBLE PARA ESTE USUARIO:'];
    allowed.forEach((key) => {
      if (MODULES[key]) lines.push('- ' + MODULES[key].knowledge);
    });
    if (reportsAllowed()) {
      const bits = ['- Reportes: el botón Reportes de cada módulo abre su catálogo y permite imprimir o exportar a Excel/CSV.'];
      if (allowed.includes('accounting')) bits.push('En Contabilidad incluye libro diario, libro mayor, balance de comprobación, estado de resultados y balance general.');
      if (allowed.includes('payables')) bits.push('En Cuentas por Pagar incluye antigüedad de saldos, retenciones y libro de compras.');
      if (allowed.includes('services')) bits.push('En Servicios incluye reportes de carreras, encomiendas, ingresos y comisiones.');
      lines.push(bits.join(' '));
    }
    if (!allowed.length) lines.push('- El usuario no tiene módulos habilitados.');
    return lines.join('\n');
  }

  function buildAccessRules(allowed) {
    const allowedLabels = allowed.map(moduleLabel);
    const blocked = MODULE_ORDER.filter((key) => !allowed.includes(key)).map(moduleLabel);
    return [
      'REGLAS ESTRICTAS DE ACCESO Y CONTEXTO:',
      '- El usuario actual es ' + (currentSessionName() || 'un usuario autenticado') + ' con rol ' + (currentSessionRole() || 'sin rol') + '.',
      '- Módulos permitidos: ' + (allowedLabels.length ? allowedLabels.join(', ') : 'ninguno') + '.',
      '- Módulos bloqueados: ' + (blocked.length ? blocked.join(', ') : 'ninguno') + '.',
      '- Solo puedes responder preguntas, instrucciones o datos de los módulos permitidos.',
      '- Si la consulta pide información de un módulo bloqueado, responde que el rol no tiene acceso a ese módulo y ofrece únicamente alternativas de los módulos permitidos. No reveles nombres, cifras, registros, campos ni instrucciones de módulos bloqueados.',
      '- No inventes datos. Usa exclusivamente el CONTEXTO AUTORIZADO que aparece abajo. Si un dato no está allí, dilo con claridad y explica dónde consultarlo dentro de los módulos permitidos.',
      '- Responde en español, de forma clara, breve y profesional. Usa Markdown con **negritas** y listas cuando ayude a leer.',
      '- No reveles la API Key, credenciales, tokens ni detalles internos de configuración.',
      '- Si la pregunta no tiene relación con ENVIA ERP, responde exactamente con la frase de rechazo indicada en tus instrucciones principales.'
    ].join('\n');
  }

  function currentSessionName() {
    const s = NS.session && NS.session.getSession ? NS.session.getSession() : null;
    return s ? (s.nombre || s.usuario || '') : '';
  }

  function currentSessionRole() {
    const s = NS.session && NS.session.getSession ? NS.session.getSession() : null;
    return s ? (s.rol || '') : '';
  }

  function buildContext() {
    const db = NS.store && NS.store.db ? NS.store.db : null;
    const allowed = allowedModules();
    const lines = [
      'CONTEXTO AUTORIZADO (datos locales de este navegador):',
      '- Fecha de hoy: ' + (NS.store && NS.store.today ? NS.store.today() : new Date().toISOString().slice(0, 10)) + '.',
      '- Moneda funcional contable: VES. Las operaciones se capturan en USD y se convierten con la tasa BCV.',
      '- No incluyas datos de módulos bloqueados.'
    ];
    if (!db) {
      lines.push('- No hay base local cargada en este momento.');
      return lines.join('\n');
    }

    const today = NS.store && NS.store.today ? NS.store.today() : new Date().toISOString().slice(0, 10);
    const month = today.slice(0, 7);
    const services = Array.isArray(db.services) ? db.services : [];
    const monthServices = services.filter((s) => String(s.fecha || '').slice(0, 7) === month);

    if (allowed.includes('services')) {
      const todayServices = services.filter((s) => s.fecha === today);
      const sum = (rows, field) => rows.reduce((total, row) => total + (Number(row[field]) || 0), 0);
      const byType = {};
      todayServices.forEach((s) => { byType[s.tipo || 'sin tipo'] = (byType[s.tipo || 'sin tipo'] || 0) + 1; });
      const byStatus = {};
      todayServices.forEach((s) => { byStatus[s.estatus || 'sin estado'] = (byStatus[s.estatus || 'sin estado'] || 0) + 1; });
      lines.push('- Servicios de hoy: ' + todayServices.length + ' registro(s); base ' + fmtUsd(sum(todayServices, 'base_usd')) + '; total facturado ' + fmtUsd(sum(todayServices, 'total_usd')) + '; comisión ENVIA ' + fmtUsd(sum(todayServices, 'comision_usd')) + '.');
      if (todayServices.length) {
        lines.push('- Servicios de hoy por tipo: ' + Object.keys(byType).map((k) => k + ': ' + byType[k]).join('; ') + '.');
        lines.push('- Servicios de hoy por estado: ' + Object.keys(byStatus).map((k) => k + ': ' + byStatus[k]).join('; ') + '.');
        const recent = todayServices.slice(0, 3).map((s) => {
          let item = serviceLabel(s) + ' (' + (s.tipo || 'servicio') + ', ' + (s.origen || 'origen') + ' → ' + (s.destino || 'destino') + ', ' + fmtUsd(s.base_usd) + ', ' + (s.estatus || 'sin estado') + ')';
          if (allowed.includes('drivers') && s.conductor_cedula_rif) {
            const driver = (db.drivers || []).find((d) => d.cedula_rif === s.conductor_cedula_rif);
            if (driver) item += ' — conductor: ' + driver.nombres + ' ' + driver.apellidos;
          }
          if (allowed.includes('clients') && s.cliente_cedula_rif) item += ' — cliente: ' + s.cliente_cedula_rif;
          return item;
        });
        lines.push('- Últimos servicios de hoy: ' + recent.join(' | ') + '.');
      } else {
        lines.push('- No hay servicios registrados con fecha de hoy.');
      }
    }

    if (allowed.includes('drivers')) {
      const drivers = Array.isArray(db.drivers) ? db.drivers : [];
      const stats = new Map();
      monthServices.forEach((s) => {
        const key = s.conductor_cedula_rif;
        if (!key) return;
        const row = stats.get(key) || { cedula: key, count: 0, base: 0, comision: 0, pago: 0 };
        row.count += 1;
        row.base += Number(s.base_usd) || 0;
        row.comision += Number(s.comision_usd) || 0;
        row.pago += Number(s.pago_conductor_usd) || 0;
        stats.set(key, row);
      });
      const ranking = Array.from(stats.values()).sort((a, b) => b.base - a.base || b.count - a.count).slice(0, 5);
      const rankingText = ranking.map((row) => {
        const driver = drivers.find((d) => d.cedula_rif === row.cedula);
        const name = driver ? driver.nombres + ' ' + driver.apellidos : row.cedula;
        return name + ': ' + row.count + ' servicio(s), base ' + fmtUsd(row.base) + ', comisión ' + fmtUsd(row.comision) + ', pago ' + fmtUsd(row.pago);
      });
      lines.push('- Ranking de conductores del mes por base generada: ' + (rankingText.length ? rankingText.join(' | ') : 'sin servicios este mes') + '.');
      lines.push('- Conductores registrados: ' + drivers.length + '; activos/disponibles: ' + drivers.filter((d) => String(d.estatus_conductor || '').includes('Activo')).length + '; saldo total por liquidar: ' + fmtUsd(drivers.reduce((t, d) => t + (Number(d.saldo_por_liquidar_usd) || 0), 0)) + '.');
    }

    if (allowed.includes('clients')) {
      const clients = Array.isArray(db.clients) ? db.clients : [];
      const nuevos = clients.filter((c) => String(c.fecha_registro || '').slice(0, 7) === month);
      lines.push('- Clientes: ' + clients.length + ' registrados; ' + clients.filter((c) => c.estatus === 'Activo').length + ' activos; ' + nuevos.length + ' nuevos este mes.');
    }

    if (allowed.includes('accounting')) {
      const entries = Array.isArray(db.entries) ? db.entries : [];
      let debe = 0;
      let haber = 0;
      entries.forEach((entry) => {
        (entry.lines || []).forEach((line) => {
          debe += Number(line.debe) || 0;
          haber += Number(line.haber) || 0;
        });
      });
      lines.push('- Contabilidad: ' + entries.length + ' asiento(s); DEBE ' + fmtVes(debe) + '; HABER ' + fmtVes(haber) + '; diferencia ' + fmtVes(debe - haber) + '.');
      const last = entries.slice(-2).map((e) => (e.numero || e.id || 'asiento') + ': ' + (e.descripcion || 'sin descripción') + ' (' + fmtVes((e.lines || []).reduce((t, l) => t + (Number(l.debe) || 0), 0)) + ')');
      if (last.length) lines.push('- Últimos asientos: ' + last.join(' | ') + '.');
    }

    if (allowed.includes('taxes')) {
      const t = db.taxParams || {};
      lines.push('- Parámetros fiscales: IVA general ' + (t.ivaGeneral ?? 16) + '%; IVA reducido ' + (t.ivaReducido ?? 8) + '%; IGTF ' + (t.igtf ?? 3) + '%; UT ' + fmtVes(t.ut || 0) + '; tasa BCV ' + fmtVes(t.bcvRate || 0) + ' por USD.');
    }

    if (allowed.includes('payables')) {
      const payables = Array.isArray(db.payables) ? db.payables : [];
      const pending = payables.filter((p) => p.estatus !== 'Pagado');
      const overdue = pending.filter((p) => p.fecha_vencimiento && p.fecha_vencimiento < today);
      const totalPending = pending.reduce((t, p) => t + (Number(p.neto_pagar_usd) || Number(p.total_usd) || 0), 0);
      lines.push('- Cuentas por pagar: ' + payables.length + ' factura(s); ' + pending.length + ' pendiente(s); ' + overdue.length + ' vencida(s); saldo pendiente ' + fmtUsd(totalPending) + '.');
    }

    if (allowed.includes('partners')) {
      const partners = Array.isArray(db.partners) ? db.partners : [];
      lines.push('- Negocios asociados: ' + partners.length + ' registrados; ' + partners.filter((p) => p.estatus === 'Activo').length + ' activos; por cobrar ' + fmtUsd(partners.reduce((t, p) => t + (Number(p.saldo_por_cobrar_usd) || 0), 0)) + '; por pagar ' + fmtUsd(partners.reduce((t, p) => t + (Number(p.saldo_por_pagar_usd) || 0), 0)) + '.');
    }

    if (allowed.includes('inventory')) {
      const products = Array.isArray(db.products) ? db.products : [];
      const low = products.filter((p) => Number(p.stock) <= Number(p.stock_min));
      const value = products.reduce((t, p) => t + (Number(p.stock) || 0) * (Number(p.costo_usd) || 0), 0);
      lines.push('- Inventario: ' + products.length + ' producto(s); ' + low.length + ' con stock bajo o en mínimo; valor a costo ' + fmtUsd(value) + '.');
    }

    if (allowed.includes('users')) {
      const users = Array.isArray(db.users) ? db.users : [];
      lines.push('- Usuarios del sistema: ' + users.length + ' registrados; ' + users.filter((u) => u.activo).length + ' activos.');
    }

    if (allowed.includes('audit')) {
      const logs = Array.isArray(db.auditLog) ? db.auditLog : (Array.isArray(db.auditLogs) ? db.auditLogs : []);
      lines.push('- Bitácora de auditoría: ' + logs.length + ' evento(s) registrados.');
    }

    if (allowed.includes('settings')) {
      const configured = !!(NS.supabase && typeof NS.supabase.isConfigured === 'function' && NS.supabase.isConfigured());
      lines.push('- Configuración: Supabase ' + (configured ? 'configurado' : 'no configurado (modo local)') + '; asistente Gemini ' + (isConfigured() ? 'con credenciales locales' : 'sin credenciales') + '.');
    }

    return lines.join('\n');
  }

  function buildSystemInstruction() {
    const allowed = allowedModules();
    return [
      BASE_SYSTEM_PROMPT,
      '',
      buildAccessRules(allowed),
      '',
      buildKnowledge(allowed),
      '',
      buildContext(),
      '',
      'INSTRUCCIÓN FINAL: responde solo con información del contexto autorizado y de los módulos permitidos. Si falta un dato, indícalo y sugiere el módulo o reporte donde consultarlo.'
    ].join('\n');
  }

  function buildContents(prompt) {
    const history = conversation.slice(-(MAX_HISTORY_MESSAGES - 1));
    while (history.length && history[0].role === 'model') history.shift();
    return history.concat([{ role: 'user', parts: [{ text: prompt }] }]);
  }

  function trimConversation() {
    if (conversation.length > MAX_HISTORY_MESSAGES) {
      conversation = conversation.slice(-MAX_HISTORY_MESSAGES);
    }
    while (conversation.length && conversation[0].role === 'model') conversation.shift();
  }

  function apiUrl(model, apiKey) {
    return API_BASE + encodeURIComponent(model) + ':generateContent?key=' + encodeURIComponent(apiKey);
  }

  async function readJson(response) {
    try { return await response.json(); } catch (e) { return null; }
  }

  function apiErrorMessage(status, data) {
    const google = data && data.error ? data.error : null;
    const detail = google && google.message ? String(google.message) : '';
    if (status === 400 && /API key|API_KEY|invalid/i.test(detail)) return 'La API Key de Gemini no es válida. Revísala en Configuración → Asistente ChatBot.';
    if (status === 400) return 'Gemini rechazó la solicitud' + (detail ? ': ' + detail : '. Revisa el modelo y la API Key.');
    if (status === 401 || status === 403) return 'La API Key no tiene permisos para usar este modelo. Verifica el acceso en Google AI Studio.';
    if (status === 404) return 'El modelo configurado no está disponible. Prueba con otro modelo de Gemini.';
    if (status === 429) return 'Se alcanzó el límite de cuota de Gemini. Espera un momento y vuelve a intentar.';
    if (status >= 500) return 'Gemini no está disponible en este momento. Intenta de nuevo en unos minutos.';
    return 'No se pudo completar la consulta con Gemini' + (detail ? ': ' + detail : ' (HTTP ' + status + ').');
  }

  function chatError(message, code) {
    const error = new Error(message);
    error.code = code || 'CHAT_ERROR';
    return error;
  }

  async function fetchWithTimeout(url, options, timeoutMs) {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
    try {
      return await fetch(url, Object.assign({}, options, controller ? { signal: controller.signal } : {}));
    } catch (e) {
      if (e && e.name === 'AbortError') throw chatError('La consulta tardó demasiado. Revisa tu conexión e intenta de nuevo.', 'TIMEOUT');
      throw chatError('No se pudo conectar con Gemini. Revisa tu conexión a internet y la API Key.', 'NETWORK');
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  async function enviarMensajeGemini(mensajeUsuario) {
    const prompt = String(mensajeUsuario || '').trim();
    if (!prompt) throw chatError('Escribe una consulta para el asistente.', 'EMPTY');
    if (prompt.length > 1600) throw chatError('La consulta es demasiado larga. Resúmela en menos de 1.600 caracteres.', 'TOO_LONG');

    const cfg = getConfig();
    if (!cfg.apiKey) {
      throw chatError('Para usar el Asistente ENVIA primero configura la API Key de Google Gemini en Configuración → Asistente ChatBot.', 'NO_API_KEY');
    }

    const guard = accessGuard(prompt);
    if (!guard.allowed) throw chatError(guard.message, 'FORBIDDEN');

    const payload = {
      system_instruction: { parts: [{ text: buildSystemInstruction() }] },
      contents: buildContents(prompt),
      generationConfig: {
        temperature: 0.25,
        topP: 0.9,
        maxOutputTokens: 1400
      }
    };

    const response = await fetchWithTimeout(apiUrl(cfg.model, cfg.apiKey), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }, FETCH_TIMEOUT_MS);

    const data = await readJson(response);
    if (!response.ok) throw chatError(apiErrorMessage(response.status, data), 'API_ERROR');

    const candidate = data && data.candidates && data.candidates[0];
    const parts = candidate && candidate.content && candidate.content.parts ? candidate.content.parts : [];
    const reply = parts.map((part) => part.text || '').join('\n').trim();
    if (!reply) {
      const reason = candidate && candidate.finishReason ? ' (' + candidate.finishReason + ')' : '';
      throw chatError('Gemini no devolvió una respuesta útil' + reason + '. Reformula la pregunta.', 'EMPTY_RESPONSE');
    }

    conversation.push({ role: 'user', parts: [{ text: prompt }] });
    conversation.push({ role: 'model', parts: [{ text: reply }] });
    trimConversation();

    return {
      text: reply,
      model: cfg.model,
      finishReason: (candidate && candidate.finishReason) || '',
      usage: (data && data.usageMetadata) || null
    };
  }

  async function probarConexion(apiKey, model) {
    const key = String(apiKey || getConfig().apiKey || '').trim();
    if (!key) return { ok: false, message: 'Falta la API Key de Google Gemini.' };
    let selected;
    try {
      selected = normalizeModel(model || getConfig().model, true);
    } catch (e) {
      return { ok: false, message: e.message };
    }
    const started = Date.now();
    try {
      const response = await fetchWithTimeout(apiUrl(selected, key), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: BASE_SYSTEM_PROMPT }] },
          contents: [{ role: 'user', parts: [{ text: 'Responde únicamente: conexión OK' }] }],
          generationConfig: { temperature: 0, maxOutputTokens: 24 }
        })
      }, TEST_TIMEOUT_MS);
      const data = await readJson(response);
      if (!response.ok) {
        const message = apiErrorMessage(response.status, data);
        saveLastTest({ ok: false, message, model: selected });
        return { ok: false, message, model: selected };
      }
      const candidate = data && data.candidates && data.candidates[0];
      const parts = candidate && candidate.content && candidate.content.parts ? candidate.content.parts : [];
      const text = parts.map((part) => part.text || '').join(' ').trim();
      const result = {
        ok: true,
        message: 'Conexión verificada con ' + selected + ' en ' + ((Date.now() - started) / 1000).toFixed(1) + ' s.',
        model: selected,
        response: text.slice(0, 120)
      };
      saveLastTest(result);
      return result;
    } catch (e) {
      const result = { ok: false, message: e.message || 'No se pudo verificar la conexión.', model: selected };
      saveLastTest(result);
      return result;
    }
  }

  /* --------------------------- Markdown seguro --------------------------- */
  function renderInline(text) {
    return String(text || '')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/__([^_]+)__/g, '<strong>$1</strong>')
      .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  }

  function renderMarkdown(text) {
    const esc = NS.ui && NS.ui.esc ? NS.ui.esc : (value) => String(value || '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    const lines = esc(String(text || '')).replace(/\r\n/g, '\n').split('\n');
    let html = '';
    let paragraph = [];
    let listType = null;

    const flushParagraph = () => {
      if (paragraph.length) {
        html += '<p>' + paragraph.map(renderInline).join('<br>') + '</p>';
        paragraph = [];
      }
    };
    const flushList = () => {
      if (listType) {
        html += '</' + listType + '>';
        listType = null;
      }
    };

    lines.forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed) {
        flushParagraph();
        flushList();
        return;
      }
      const heading = trimmed.match(/^(#{1,4})\s+(.*)$/);
      if (heading) {
        flushParagraph();
        flushList();
        const level = Math.min(4, heading[1].length + 2);
        html += '<h' + level + '>' + renderInline(heading[2]) + '</h' + level + '>';
        return;
      }
      const unordered = trimmed.match(/^[-*•]\s+(.*)$/);
      if (unordered) {
        flushParagraph();
        if (listType !== 'ul') { flushList(); html += '<ul>'; listType = 'ul'; }
        html += '<li>' + renderInline(unordered[1]) + '</li>';
        return;
      }
      const ordered = trimmed.match(/^\d+[.)]\s+(.*)$/);
      if (ordered) {
        flushParagraph();
        if (listType !== 'ol') { flushList(); html += '<ol>'; listType = 'ol'; }
        html += '<li>' + renderInline(ordered[1]) + '</li>';
        return;
      }
      flushList();
      paragraph.push(trimmed);
    });
    flushParagraph();
    flushList();
    return html || '<p></p>';
  }

  /* ------------------------------- Widget -------------------------------- */
  function widgetMarkup() {
    return `
      <button type="button" class="envia-chat-launcher" id="envia-chat-launcher" aria-expanded="false" aria-controls="envia-chat-window">
        <span class="envia-chat-launcher-ring" aria-hidden="true"></span>
        <span class="envia-chat-launcher-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.4 8.4 0 0 1-8.5 8.4 9.6 9.6 0 0 1-3.2-.6L4 21l1.7-4.9A8.2 8.2 0 0 1 3.5 11.5 8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5Z"/><path d="M8.5 12h.01M12 12h.01M15.5 12h.01"/></svg>
        </span>
        <span class="envia-chat-launcher-label"><strong>Asistente ENVIA</strong><small>Consultas del ERP</small></span>
        <span class="envia-chat-launcher-dot" id="envia-chat-launcher-dot" aria-hidden="true"></span>
      </button>
      <div class="envia-chat-window" id="envia-chat-window" role="dialog" aria-modal="false" aria-labelledby="envia-chat-title" hidden>
        <header class="envia-chat-head">
          <div class="envia-chat-identity">
            <span class="envia-chat-avatar" aria-hidden="true"><span>E</span><i></i></span>
            <div>
              <span class="envia-chat-eyebrow">Asistente inteligente</span>
              <h2 id="envia-chat-title">Asistente ENVIA</h2>
              <p id="envia-chat-status">Gemini · sin configurar</p>
            </div>
          </div>
          <div class="envia-chat-actions">
            <button type="button" class="envia-chat-icon-btn" id="envia-chat-reset" title="Nueva conversación" aria-label="Nueva conversación">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5"/></svg>
            </button>
            <button type="button" class="envia-chat-icon-btn" id="envia-chat-close" title="Cerrar" aria-label="Cerrar asistente">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          </div>
        </header>
        <div class="envia-chat-body">
          <div class="envia-chat-messages" id="envia-chat-messages" role="log" aria-live="polite" aria-relevant="additions"></div>
          <div class="envia-chat-quick" id="envia-chat-quick">
            <div class="envia-chat-quick-title"><span></span>Preguntas rápidas</div>
            <div class="envia-chat-quick-list">
              <button type="button" class="envia-chat-pill" data-chat-quick="¿Cómo registro un nuevo cliente?"><span>¿Cómo registro un nuevo cliente?</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg></button>
              <button type="button" class="envia-chat-pill" data-chat-quick="¿Cómo genero un reporte financiero?"><span>¿Cómo genero un reporte financiero?</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg></button>
              <button type="button" class="envia-chat-pill" data-chat-quick="¿Como van los servicios el dia de hoy?"><span>¿Como van los servicios el dia de hoy?</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg></button>
              <button type="button" class="envia-chat-pill" data-chat-quick="¿Que conductor tiene mejores estadisticas en el mes?"><span>¿Que conductor tiene mejores estadisticas en el mes?</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg></button>
            </div>
          </div>
        </div>
        <form class="envia-chat-composer" id="envia-chat-form" autocomplete="off">
          <label class="sr-only" for="envia-chat-input">Escribe tu consulta</label>
          <textarea id="envia-chat-input" rows="1" maxlength="1600" placeholder="Pregunta sobre clientes, servicios, contabilidad..." aria-label="Escribe tu consulta"></textarea>
          <button type="submit" class="envia-chat-send" id="envia-chat-send" aria-label="Enviar consulta" title="Enviar consulta">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7Z"/></svg>
          </button>
        </form>
        <p class="envia-chat-footnote">Asistente con IA · Verifica siempre cifras fiscales y contables.</p>
      </div>`;
  }

  function initWidget() {
    if (initialized) return;
    widget = document.getElementById('envia-chatbot');
    if (!widget) {
      widget = document.createElement('section');
      widget.id = 'envia-chatbot';
      widget.className = 'envia-chatbot';
      widget.setAttribute('aria-label', 'Asistente Inteligente ENVIA');
      document.body.appendChild(widget);
    }
    if (!widget.querySelector('#envia-chat-window')) widget.innerHTML = widgetMarkup();

    el = {
      launcher: document.getElementById('envia-chat-launcher'),
      window: document.getElementById('envia-chat-window'),
      close: document.getElementById('envia-chat-close'),
      reset: document.getElementById('envia-chat-reset'),
      form: document.getElementById('envia-chat-form'),
      input: document.getElementById('envia-chat-input'),
      send: document.getElementById('envia-chat-send'),
      messages: document.getElementById('envia-chat-messages'),
      quick: document.getElementById('envia-chat-quick'),
      status: document.getElementById('envia-chat-status'),
      dot: document.getElementById('envia-chat-launcher-dot')
    };
    if (!el.window) return;

    el.launcher.addEventListener('click', toggle);
    el.close.addEventListener('click', close);
    el.reset.addEventListener('click', resetConversation);
    el.form.addEventListener('submit', (event) => {
      event.preventDefault();
      const text = el.input.value.trim();
      if (!text) return;
      el.input.value = '';
      autoGrow();
      sendMessage(text);
    });
    el.input.addEventListener('input', autoGrow);
    el.input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        el.form.requestSubmit();
      }
    });
    widget.querySelectorAll('[data-chat-quick]').forEach((button) => {
      button.addEventListener('click', () => {
        const text = button.getAttribute('data-chat-quick') || '';
        hideQuickReplies();
        sendMessage(text);
      });
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !el.window.hidden) close();
    });
    document.addEventListener('click', (event) => {
      if (el.window.hidden) return;
      if (widget.contains(event.target)) return;
      if (event.target && event.target.closest && event.target.closest('[data-chat-open]')) return;
      close();
    });
    bindOverlayObserver();
    resetConversation();
    syncStatus();
    initialized = true;
  }

  function bindOverlayObserver() {
    if (overlayObserver || typeof MutationObserver === 'undefined') return;
    const modalRoot = document.getElementById('modal-root');
    const palette = document.getElementById('command-palette');
    const sync = () => {
      const modalOpen = !!(modalRoot && modalRoot.querySelector('.modal-overlay.open'));
      const paletteOpen = !!(palette && !palette.classList.contains('hidden'));
      document.body.classList.toggle('chat-obscured', modalOpen || paletteOpen);
    };
    overlayObserver = new MutationObserver(sync);
    if (modalRoot) overlayObserver.observe(modalRoot, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    if (palette) overlayObserver.observe(palette, { attributes: true, attributeFilter: ['class'] });
    sync();
  }

  function syncStatus() {
    if (!el.status) return;
    const cfg = getConfig();
    const status = cfg.apiKey ? ('Gemini · ' + cfg.model) : 'Gemini · sin configurar';
    el.status.textContent = status;
    if (el.dot) el.dot.classList.toggle('is-configured', !!cfg.apiKey);
    const launcherLabel = widget && widget.querySelector('.envia-chat-launcher-label small');
    if (launcherLabel) launcherLabel.textContent = cfg.apiKey ? 'Consultas del ERP' : 'Configura tu API Key';
  }

  function toggle() {
    if (el.window.hidden) open();
    else close();
  }

  function open() {
    if (!el.window) return;
    if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; }
    el.window.hidden = false;
    widget.classList.add('is-open');
    el.launcher.setAttribute('aria-expanded', 'true');
    requestAnimationFrame(() => el.window.classList.add('is-visible'));
    setTimeout(() => { if (el.input) el.input.focus(); }, 80);
  }

  function close() {
    if (!el.window || el.window.hidden) return;
    el.window.classList.remove('is-visible');
    widget.classList.remove('is-open');
    el.launcher.setAttribute('aria-expanded', 'false');
    closeTimer = setTimeout(() => {
      el.window.hidden = true;
      closeTimer = null;
    }, 180);
  }

  function autoGrow() {
    if (!el.input) return;
    el.input.style.height = 'auto';
    el.input.style.height = Math.min(120, el.input.scrollHeight) + 'px';
  }

  function hideQuickReplies() {
    if (el.quick) el.quick.classList.add('is-hidden');
  }

  function showQuickReplies() {
    if (el.quick) el.quick.classList.remove('is-hidden');
  }

  function addMessage(role, text, options) {
    if (!el.messages) return null;
    const wrap = document.createElement('div');
    wrap.className = 'envia-chat-message envia-chat-message-' + role;
    const avatar = document.createElement('span');
    avatar.className = 'envia-chat-msg-avatar';
    avatar.setAttribute('aria-hidden', 'true');
    avatar.textContent = role === 'user' ? 'Tú' : 'E';
    const bubble = document.createElement('div');
    bubble.className = 'envia-chat-bubble';
    if (role === 'assistant') {
      bubble.innerHTML = renderMarkdown(text);
    } else {
      bubble.textContent = text;
    }
    if (options && options.error) bubble.classList.add('is-error');
    if (options && options.notice) bubble.classList.add('is-notice');
    const meta = document.createElement('span');
    meta.className = 'envia-chat-msg-time';
    meta.textContent = new Date().toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' });
    const inner = document.createElement('div');
    inner.className = 'envia-chat-msg-inner';
    inner.appendChild(bubble);
    inner.appendChild(meta);
    wrap.appendChild(avatar);
    wrap.appendChild(inner);
    el.messages.appendChild(wrap);
    el.messages.scrollTop = el.messages.scrollHeight;
    return wrap;
  }

  function addTyping() {
    if (!el.messages) return null;
    const wrap = document.createElement('div');
    wrap.className = 'envia-chat-message envia-chat-message-assistant envia-chat-typing';
    wrap.setAttribute('role', 'status');
    wrap.setAttribute('aria-label', 'Pensando');
    wrap.innerHTML = `<span class="envia-chat-msg-avatar" aria-hidden="true">E</span><div class="envia-chat-msg-inner"><div class="envia-chat-bubble envia-chat-typing-bubble"><span class="envia-chat-typing-dots" aria-hidden="true"><i></i><i></i><i></i></span><span>Pensando...</span></div></div>`;
    el.messages.appendChild(wrap);
    el.messages.scrollTop = el.messages.scrollHeight;
    return wrap;
  }

  function openSettings() {
    close();
    try {
      if (NS.router && typeof NS.router.navigate === 'function') {
        NS.router.navigate('settings?sub=settings-chatbot&action=ver');
      }
    } catch (e) {
      if (NS.ui && NS.ui.toast) NS.ui.toast('Abre Configuración → Asistente ChatBot.', 'info');
    }
  }

  function addNoKeyNotice() {
    const wrap = addMessage('assistant', 'Para usar el Asistente ENVIA necesito que primero configures la **API Key de Google Gemini**. Si tienes acceso, ve a **Configuración → Asistente ChatBot**; si no, pide a un SuperAdmin que la configure en este navegador. La clave se guarda solo aquí.', { notice: true });
    if (!wrap) return;
    const inner = wrap.querySelector('.envia-chat-msg-inner');
    if (!inner) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'envia-chat-link-btn';
    button.textContent = 'Abrir configuración';
    button.addEventListener('click', openSettings);
    inner.appendChild(button);
  }

  async function sendMessage(text) {
    if (!el.messages) return;
    hideQuickReplies();
    addMessage('user', text);
    if (!getConfig().apiKey) {
      addNoKeyNotice();
      return;
    }
    if (el.send) el.send.disabled = true;
    if (el.input) el.input.disabled = true;
    const typing = addTyping();
    try {
      const result = await enviarMensajeGemini(text);
      if (typing) typing.remove();
      addMessage('assistant', result.text);
    } catch (error) {
      if (typing) typing.remove();
      const message = error && error.message ? error.message : 'No se pudo completar la consulta.';
      addMessage('assistant', message, { error: true });
      if (error && error.code === 'NO_API_KEY') addNoKeyNotice();
    } finally {
      if (el.send) el.send.disabled = false;
      if (el.input) {
        el.input.disabled = false;
        el.input.focus();
      }
    }
  }

  function resetConversation() {
    conversation = [];
    if (!el.messages) return;
    el.messages.innerHTML = '';
    const cfg = getConfig();
    const greeting = cfg.apiKey
      ? 'Hola, soy el **Asistente ENVIA**. Puedo ayudarte con clientes, servicios, conductores, contabilidad, tributos y cuentas por pagar, siempre dentro de los módulos autorizados para tu rol.'
      : 'Hola, soy el **Asistente ENVIA**. Para empezar, configura tu **API Key de Google Gemini** en Configuración → Asistente ChatBot. Mientras tanto puedo mostrarte las preguntas rápidas disponibles.';
    addMessage('assistant', greeting);
    showQuickReplies();
    syncStatus();
  }

  /* ------------------------------ Arranque ------------------------------- */
  document.addEventListener('DOMContentLoaded', initWidget);
  if (document.readyState !== 'loading') initWidget();

  NS.chatbot = {
    init: initWidget,
    enviarMensajeGemini,
    probarConexion,
    getConfig,
    saveConfig,
    clearConfig,
    saveLastTest,
    isConfigured,
    resetConversation,
    open,
    close,
    toggle,
    renderMarkdown,
    buildContext,
    buildSystemInstruction,
    allowedModules,
    moduleLabel,
    accessGuard,
    defaultModel: DEFAULT_MODEL,
    configKey: CONFIG_KEY
  };
})();
