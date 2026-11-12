/* =========================================================================
   ENVIA ERP · supabaseService.js
   Cliente REST + Storage para Supabase, con fallback local (DataURL/Base64)
   para que la carga y previsualización de documentos funcione sin conexión.
   ========================================================================= */
(function () {
  'use strict';

  const NS = (window.ENVIA = window.ENVIA || {});
  const CONFIG_KEY = 'envia_supabase';
  const FILES_KEY = 'envia_files_v1';
  const FILES_DB = 'envia_files_db';
  const FILES_STORE = 'files';
  // El proyecto de Supabase (plan gratuito) se suspende tras un tiempo de
  // inactividad y puede tardar en despertar. Por eso cada petición reintenta
  // con espera creciente antes de declararse fallida.
  const REQUEST_TIMEOUT_MS = 30000;
  const RETRY_DELAYS_MS = [2000, 5000, 12000];

  function getConfig() {
    try {
      return JSON.parse(localStorage.getItem(CONFIG_KEY)) || { url: '', anonKey: '', lastTest: null, lastSync: null };
    } catch (e) {
      return { url: '', anonKey: '', lastTest: null, lastSync: null };
    }
  }

  function saveConfig(cfg) {
    localStorage.setItem(CONFIG_KEY, JSON.stringify({ ...getConfig(), ...cfg }));
    return getConfig();
  }

  function isConfigured() {
    const c = getConfig();
    return !!(c.url && c.anonKey);
  }

  function baseUrl() {
    return getConfig().url.replace(/\/+$/, '');
  }

  function headers(extra) {
    const c = getConfig();
    return {
      apikey: c.anonKey,
      Authorization: 'Bearer ' + c.anonKey,
      'Content-Type': 'application/json',
      ...(extra || {})
    };
  }

  async function withTimeout(run, timeoutMs, label) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs || REQUEST_TIMEOUT_MS);
    try {
      return await run(controller.signal);
    } catch (err) {
      if (err && (err.name === 'AbortError' || /aborted|abort/i.test(String(err.message || '')))) {
        throw new Error('Tiempo de espera agotado al conectar con Supabase' + (label ? ' (' + label + ')' : '') + '. Revisa la URL, la red o las políticas RLS.');
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  function isNetworkFailure(err) {
    const msg = String((err && err.message) || err || '').toLowerCase();
    return /tiempo de espera|failed to fetch|networkerror|load failed|fetch failed|network request failed|aborted/.test(msg);
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function rest(path, options) {
    if (!isConfigured()) throw new Error('Supabase no está configurado.');
    let lastError = null;
    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
      try {
        return await withTimeout(async (signal) => {
          const res = await fetch(baseUrl() + '/rest/v1/' + path, {
            ...(options || {}),
            signal,
            headers: headers((options && options.headers) || {})
          });
          const text = await res.text();
          let body = null;
          try { body = text ? JSON.parse(text) : null; } catch (e) { body = text; }
          if (!res.ok) {
            const msg = body && (body.message || body.hint || body.error_description) ? (body.message || body.hint || body.error_description) : ('HTTP ' + res.status);
            throw new Error(msg);
          }
          return body;
        }, REQUEST_TIMEOUT_MS, 'REST');
      } catch (err) {
        lastError = err;
        // Solo se reintenta un fallo de red o de tiempo de espera; los errores
        // del servidor (HTTP 4xx/5xx con mensaje) se devuelven de inmediato.
        if (!isNetworkFailure(err) || attempt === RETRY_DELAYS_MS.length) throw err;
        await sleep(RETRY_DELAYS_MS[attempt]);
      }
    }
    throw lastError;
  }

  async function testConnection(url, anonKey) {
    const cfg = {
      url: (url || getConfig().url || '').trim().replace(/\/+$/, ''),
      anonKey: (anonKey || getConfig().anonKey || '').trim()
    };
    if (!cfg.url || !cfg.anonKey) throw new Error('Debes indicar SUPABASE_URL y SUPABASE_ANON_KEY.');
    if (!/^https:\/\/[a-z0-9-]+\.supabase\.co/i.test(cfg.url) && !/^http:\/\/localhost/i.test(cfg.url)) {
      // Se permite cualquier URL válida, solo advertimos por el formato típico.
    }
    const { res, text } = await withTimeout(async (signal) => {
      const response = await fetch(cfg.url + '/rest/v1/clients?select=cedula_rif&limit=1', {
        headers: { apikey: cfg.anonKey, Authorization: 'Bearer ' + cfg.anonKey },
        signal
      });
      return { res: response, text: await response.text() };
    }, REQUEST_TIMEOUT_MS, 'prueba de conexión');
    let body = null;
    try { body = text ? JSON.parse(text) : null; } catch (e) { body = text; }
    if (res.ok) {
      saveConfig({ ...cfg, lastTest: new Date().toISOString() });
      return { ok: true, status: res.status, message: 'Conexión exitosa. Esquema ENVIA detectado.', body };
    }
    if (res.status === 404 || (body && String(body.code) === 'PGRST205')) {
      saveConfig({ ...cfg, lastTest: new Date().toISOString() });
      return { ok: false, status: res.status, message: 'Credenciales válidas, pero el esquema no existe. Ejecuta /sql/supabase_schema.sql en el SQL Editor.', body };
    }
    throw new Error('No se pudo conectar (' + res.status + '): ' + ((body && (body.message || body.hint)) || 'verifica URL y anon key'));
  }

  /* ---------------------------- Archivos ---------------------------- */
  // Los documentos viven en IndexedDB para no consumir el cupo de localStorage
  // (que se reserva para la base de datos). La caché en memoria mantiene la API
  // síncrona que usan las vistas.
  let filesCache = {};
  let fileDb = null;
  let fileDbReady = false;

  function openFileDb() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) return reject(new Error('IndexedDB no disponible.'));
      const req = indexedDB.open(FILES_DB, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(FILES_STORE)) db.createObjectStore(FILES_STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error('No se pudo abrir IndexedDB.'));
    });
  }

  function idbGetAll(db) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(FILES_STORE, 'readonly');
      const store = tx.objectStore(FILES_STORE);
      const out = {};
      const req = store.openCursor();
      req.onsuccess = () => {
        const cursor = req.result;
        if (cursor) { out[cursor.key] = cursor.value; cursor.continue(); }
        else resolve(out);
      };
      req.onerror = () => reject(req.error || new Error('No se pudieron leer los archivos locales.'));
    });
  }

  function idbPut(key, value) {
    return new Promise((resolve, reject) => {
      if (!fileDb) return reject(new Error('IndexedDB no disponible.'));
      const tx = fileDb.transaction(FILES_STORE, 'readwrite');
      tx.objectStore(FILES_STORE).put(value, key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error || new Error('No se pudo guardar el archivo.'));
    });
  }

  function idbDelete(key) {
    return new Promise((resolve, reject) => {
      if (!fileDb) return reject(new Error('IndexedDB no disponible.'));
      const tx = fileDb.transaction(FILES_STORE, 'readwrite');
      tx.objectStore(FILES_STORE).delete(key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error || new Error('No se pudo eliminar el archivo.'));
    });
  }

  function saveLegacyFiles() {
    try {
      localStorage.setItem(FILES_KEY, JSON.stringify(filesCache));
    } catch (e) {
      throw new Error('El almacenamiento local está lleno. Conecta Supabase Storage o elimina documentos antiguos.');
    }
  }

  async function initFiles() {
    try {
      fileDb = await openFileDb();
      filesCache = await idbGetAll(fileDb);
      fileDbReady = true;
    } catch (e) {
      console.warn('ENVIA: IndexedDB no disponible; se usa localStorage para archivos.', e);
      fileDb = null;
    }
    // Migración transparente de documentos que aún estaban en localStorage.
    try {
      const raw = localStorage.getItem(FILES_KEY);
      if (raw) {
        const legacy = JSON.parse(raw) || {};
        filesCache = { ...filesCache, ...legacy };
        if (fileDbReady) {
          for (const key of Object.keys(legacy)) await idbPut(key, legacy[key]);
          localStorage.removeItem(FILES_KEY);
        }
      }
    } catch (e) {
      console.warn('ENVIA: no se pudieron migrar los archivos locales.', e);
    }
  }

  const filesReady = initFiles();

  function getFiles() { return filesCache; }

  async function saveFile(key, dataUrl) {
    filesCache[key] = dataUrl;
    if (fileDbReady) {
      try { await idbPut(key, dataUrl); return; } catch (e) { console.warn('ENVIA: fallback de archivo a localStorage', e); }
    }
    saveLegacyFiles();
  }

  async function removeFile(key) {
    delete filesCache[key];
    if (fileDbReady) {
      try { await idbDelete(key); return; } catch (e) { console.warn('ENVIA: fallback al eliminar archivo', e); }
    }
    saveLegacyFiles();
  }

  async function importFiles(files) {
    if (!files || typeof files !== 'object') return false;
    Object.keys(files).forEach((key) => { filesCache[key] = files[key]; });
    if (fileDbReady) {
      for (const key of Object.keys(files)) await idbPut(key, files[key]);
      return true;
    }
    saveLegacyFiles();
    return true;
  }

  function fileToDataUrl(file, compress) {
    return new Promise((resolve, reject) => {
      if (!file) return reject(new Error('No se seleccionó ningún archivo.'));
      if (file.size > 10 * 1024 * 1024) return reject(new Error('El archivo supera el límite de 10 MB.'));
      const isPdf = /pdf/i.test(file.type) || /\.pdf$/i.test(file.name);
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('No se pudo leer el archivo.'));
      reader.onload = () => {
        const raw = reader.result;
        if (isPdf || !compress) return resolve(raw);
        const img = new Image();
        img.onerror = () => resolve(raw);
        img.onload = () => {
          try {
            const max = 1400;
            let { width, height } = img;
            const scale = Math.min(1, max / Math.max(width, height));
            width = Math.round(width * scale);
            height = Math.round(height * scale);
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', 0.72));
          } catch (e) {
            resolve(raw);
          }
        };
        img.src = raw;
      };
      reader.readAsDataURL(file);
    });
  }

  function extOf(file) {
    const fromName = (file.name || '').split('.').pop();
    if (fromName && fromName.length <= 5 && fromName !== file.name) return fromName.toLowerCase();
    if (/pdf/i.test(file.type)) return 'pdf';
    if (/png/i.test(file.type)) return 'png';
    if (/webp/i.test(file.type)) return 'webp';
    return 'jpg';
  }

  function publicStorageUrl(bucket, path) {
    return baseUrl() + '/storage/v1/object/public/' + bucket + '/' + path.split('/').map(encodeURIComponent).join('/');
  }

  /**
   * Sube un documento a Supabase Storage o, si no hay conexión, lo guarda
   * localmente como DataURL. Ruta: /{bucket}/{cedula_rif}/{tipo}_{timestamp}.{ext}
   */
  async function uploadDocument(bucket, cedula_rif, tipoDocumento, file) {
    const cedula = String(cedula_rif || 'SIN-CEDULA').trim().toUpperCase();
    const tipo = String(tipoDocumento || 'documento').replace(/[^a-zA-Z0-9_-]/g, '-');
    const ext = extOf(file);
    const path = cedula + '/' + tipo + '_' + Date.now() + '.' + ext;

    if (isConfigured()) {
      try {
        const res = await fetch(baseUrl() + '/storage/v1/object/' + bucket + '/' + path.split('/').map(encodeURIComponent).join('/'), {
          method: 'POST',
          headers: {
            apikey: getConfig().anonKey,
            Authorization: 'Bearer ' + getConfig().anonKey,
            'x-upsert': 'true',
            'Content-Type': file.type || 'application/octet-stream',
            'cache-control': '3600'
          },
          body: file
        });
        if (res.ok) {
          return {
            bucket, path, ref: 'supabase://' + bucket + '/' + path,
            url: publicStorageUrl(bucket, path), local: false, fallback: false
          };
        }
        const txt = await res.text();
        console.warn('ENVIA Storage: fallback local por error', res.status, txt);
      } catch (err) {
        console.warn('ENVIA Storage: fallback local por excepción', err);
      }
    }

    const dataUrl = await fileToDataUrl(file, !/pdf/i.test(file.type));
    const key = bucket + '/' + path;
    await saveFile(key, dataUrl);
    return {
      bucket, path, key, ref: 'local://' + key, url: dataUrl, local: true, fallback: true,
      error: isConfigured() ? 'No se pudo subir a Supabase Storage. Se guardó localmente.' : ''
    };
  }

  function getDocumentUrl(bucket, path) {
    if (!path) return '';
    if (/^(data:|blob:|https?:)/i.test(path)) return path;
    if (path.startsWith('demo://')) return demoDoc(path);
    if (path.startsWith('local://')) {
      const key = path.slice(8);
      return getFiles()[key] || '';
    }
    if (path.startsWith('supabase://')) {
      const restPath = path.slice(11);
      const idx = restPath.indexOf('/');
      const b = restPath.slice(0, idx);
      const p = restPath.slice(idx + 1);
      return publicStorageUrl(b, p);
    }
    const files = getFiles();
    return files[bucket + '/' + path] || publicStorageUrl(bucket, path);
  }

  /** Resuelve cualquier referencia guardada en la base (dataURL, demo, local o Storage). */
  function resolve(ref) {
    if (!ref) return '';
    if (Array.isArray(ref)) return ref;
    if (typeof ref !== 'string') return '';
    if (/^(data:|blob:|https?:)/i.test(ref)) return ref;
    if (ref.startsWith('demo://')) return demoDoc(ref);
    if (ref.startsWith('local://')) return getFiles()[ref.slice(8)] || '';
    if (ref.startsWith('supabase://')) {
      const raw = ref.slice(11);
      const i = raw.indexOf('/');
      return publicStorageUrl(raw.slice(0, i), raw.slice(i + 1));
    }
    return ref;
  }

  async function deleteDocument(ref) {
    if (!ref) return;
    if (ref.startsWith('local://')) return removeFile(ref.slice(8));
    if (ref.startsWith('supabase://') && isConfigured()) {
      const raw = ref.slice(11);
      const i = raw.indexOf('/');
      const bucket = raw.slice(0, i);
      const path = raw.slice(i + 1);
      const res = await fetch(baseUrl() + '/storage/v1/object/' + bucket + '/' + path, {
        method: 'DELETE',
        headers: { apikey: getConfig().anonKey, Authorization: 'Bearer ' + getConfig().anonKey }
      });
      if (!res.ok) throw new Error('No se pudo eliminar el archivo en Supabase.');
    }
  }

  /* Marcador visual de documentos demo (SVG en DataURL, sin peso en la BD) */
  function demoDoc(ref) {
    const parts = ref.replace('demo://', '').split('/');
    const grupo = parts[0] || 'documento';
    const owner = parts[1] || '';
    const tipo = parts[2] || 'documento';
    const titles = {
      cedula: 'CÉDULA DE IDENTIDAD',
      rif: 'RIF PERSONAL DIGITAL',
      licencia: 'LICENCIA DE CONDUCIR',
      circulacion: 'CARNET DE CIRCULACIÓN',
      frontal: 'VEHÍCULO · VISTA FRONTAL',
      lateral: 'VEHÍCULO · VISTA LATERAL',
      placa: 'VEHÍCULO · PLACA'
    };
    const title = titles[tipo] || 'DOCUMENTO DIGITAL';
    const subtitle = grupo === 'vehiculo' ? ('PLACA ' + owner) : owner;
    const icon = tipo === 'cedula' || tipo === 'rif' ? 'ID' : (tipo === 'licencia' ? 'LIC' : (tipo === 'circulacion' ? 'CIRC' : 'VEH'));
    const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="760" viewBox="0 0 1200 760">
  <rect width="1200" height="760" fill="#0F1E36"/>
  <circle cx="1050" cy="120" r="210" fill="#F05A24" opacity="0.16"/>
  <circle cx="140" cy="690" r="240" fill="#005FFF" opacity="0.14"/>
  <rect x="48" y="48" width="1104" height="664" rx="28" fill="#132644" stroke="#2A4166" stroke-width="2"/>
  <path d="M80 116 h250" stroke="#FF9900" stroke-width="6" stroke-linecap="round"/>
  <text x="80" y="104" font-family="Arial, Helvetica, sans-serif" font-size="34" font-weight="bold" fill="#FFFFFF" font-style="italic">EnV<tspan fill="#FF9900">ia</tspan></text>
  <text x="1120" y="104" text-anchor="end" font-family="Arial, sans-serif" font-size="18" fill="#8FA6C7" letter-spacing="3">DOCUMENTO DEMO · ERP</text>
  <rect x="80" y="160" width="250" height="170" rx="18" fill="#1B3154" stroke="#35507A"/>
  <text x="205" y="250" text-anchor="middle" font-family="Arial, sans-serif" font-size="52" font-weight="bold" fill="#FF9900">${icon}</text>
  <text x="205" y="292" text-anchor="middle" font-family="Arial, sans-serif" font-size="17" fill="#8FA6C7">ARCHIVO SIMULADO</text>
  <text x="370" y="215" font-family="Arial, sans-serif" font-size="46" font-weight="bold" fill="#FFFFFF">${title}</text>
  <text x="370" y="270" font-family="Arial, sans-serif" font-size="28" fill="#FFB15C">${subtitle}</text>
  <text x="370" y="316" font-family="Arial, sans-serif" font-size="19" fill="#8FA6C7">Cargado en el expediente digital de ${grupo === 'vehiculo' ? 'la flota' : 'el aliado operativo'}</text>
  <rect x="80" y="380" width="1040" height="2" fill="#2A4166"/>
  <text x="80" y="450" font-family="Arial, sans-serif" font-size="20" fill="#8FA6C7">Este marcador sustituye la imagen real en el entorno de demostración.</text>
  <text x="80" y="486" font-family="Arial, sans-serif" font-size="20" fill="#8FA6C7">Al subir un archivo, ENVIA ERP lo guarda en Supabase Storage o localmente.</text>
  <rect x="80" y="540" width="380" height="70" rx="12" fill="#0E3B2E" stroke="#1E7A5A"/>
  <text x="110" y="584" font-family="Arial, sans-serif" font-size="22" font-weight="bold" fill="#5CE0B0">✓ DOCUMENTO VERIFICADO</text>
  <text x="1120" y="650" text-anchor="end" font-family="Arial, sans-serif" font-size="17" fill="#64809F">ENVIA ERP · ${new Date().getFullYear()} · Documento generado automáticamente</text>
</svg>`;
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  /* ------------------------- Sincronización ------------------------- */
  const TABLE_MAP = {
    clients: { table: 'clients', conflict: 'cedula_rif' },
    drivers: { table: 'drivers', conflict: 'cedula_rif' },
    suppliers: { table: 'suppliers', conflict: 'rif' },
    partners: { table: 'partners', conflict: 'rif' },
    products: { table: 'products', conflict: 'sku' },
    driverCharges: { table: 'driver_charges', conflict: 'id' },
    driverMovements: { table: 'driver_movements', conflict: 'id' },
    partnerMovements: { table: 'partner_movements', conflict: 'id' },
    systemParams: { table: 'system_params', conflict: 'key' },
    driverPlans: { table: 'driver_plans', conflict: 'key' },
    driverEvents: { table: 'driver_events', conflict: 'key' },
    customReports: { table: 'custom_reports', conflict: 'id' },
    services: { table: 'services_orders', conflict: 'id' },
    payables: { table: 'accounts_payable', conflict: 'id' },
    withholdings: { table: 'withholding_vouchers', conflict: 'numero_comprobante' },
    accounts: { table: 'chart_of_accounts', conflict: 'codigo' },
    accountingRules: { table: 'accounting_rules', conflict: 'evento' },
    roles: { table: 'erp_roles', conflict: 'nombre' },
    users: { table: 'erp_users', conflict: 'usuario' }
  };

  const IDENTITY_FIELDS = ['cedula_rif', 'cliente_cedula_rif', 'conductor_cedula_rif', 'proveedor_rif', 'rif'];
  const IDENTITY_RE = /^([VEJ])-?(\d{7,9})$/;

  function normalizeIdentity(value) {
    if (typeof value !== 'string') return value;
    const raw = value.trim().toUpperCase().replace(/[\s.]/g, '');
    const match = raw.match(IDENTITY_RE);
    return match ? match[1] + '-' + match[2] : value;
  }

  /* Normaliza claves de identidad y homogeneiza las columnas de cada lote.
     PostgREST exige que todos los objetos de un mismo upsert tengan las mismas
     claves; las filas antiguas pueden omitir campos opcionales. */
  function prepareRows(rows) {
    const list = (rows || []).map((row) => {
      const out = { ...(row || {}) };
      IDENTITY_FIELDS.forEach((field) => {
        if (out[field]) out[field] = normalizeIdentity(out[field]);
      });
      return out;
    });
    const keys = [];
    list.forEach((row) => {
      Object.keys(row).forEach((key) => {
        if (keys.indexOf(key) === -1) keys.push(key);
      });
    });
    return list.map((row) => {
      const out = {};
      keys.forEach((key) => {
        out[key] = Object.prototype.hasOwnProperty.call(row, key) ? row[key] : null;
      });
      return out;
    });
  }

  async function upsert(table, conflict, rows) {
    if (!rows || !rows.length) return 0;
    // Supabase limita el payload; se envía en lotes de 200.
    let count = 0;
    for (let i = 0; i < rows.length; i += 200) {
      const chunk = rows.slice(i, i + 200);
      await rest(table + '?on_conflict=' + encodeURIComponent(conflict), {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(chunk)
      });
      count += chunk.length;
    }
    return count;
  }

  /* Sanea los asientos que arrastran líneas de sincronizaciones anteriores.
     Cuando un asiento conserva su número pero cambia su id local, la clave
     foránea "on update cascade" reasigna las líneas antiguas al asiento nuevo
     conservando su id viejo: quedan dos juegos de líneas y los reportes
     duplican los importes. Para evitarlo se vacían por completo los asientos
     afectados (el asiento sin líneas es un estado válido para el trigger
     diferido de partida doble) y la sincronización vuelve a enviar su juego
     completo de líneas con el id estable. */
  async function cleanupStaleEntryLines(entries, remoteIdByNumero) {
    const ids = [];
    (entries || []).forEach((e) => {
      const entryId = remoteIdByNumero.get(e.numero) || e.id;
      if (entryId && ids.indexOf(entryId) === -1) ids.push(entryId);
    });
    if (!ids.length) return 0;
    const affected = [];
    for (let i = 0; i < ids.length; i += 100) {
      const chunk = ids.slice(i, i + 100);
      const filter = 'entry_id=in.(' + chunk.map((id) => encodeURIComponent(id)).join(',') + ')&select=id,entry_id';
      const rows = await rest('accounting_entry_lines?' + filter);
      (rows || []).forEach((row) => {
        const entryId = row.entry_id;
        if (String(row.id || '').indexOf(String(entryId) + '_') === 0) return;
        if (affected.indexOf(entryId) === -1) affected.push(entryId);
      });
    }
    if (!affected.length) return 0;
    for (let i = 0; i < affected.length; i += 40) {
      const chunk = affected.slice(i, i + 40);
      await rest('accounting_entry_lines?entry_id=in.(' + chunk.map((id) => encodeURIComponent(id)).join(',') + ')', { method: 'DELETE' });
    }
    return affected.length;
  }

  async function syncAll() {
    if (!isConfigured()) throw new Error('Configura y prueba la conexión a Supabase antes de sincronizar.');
    const db = NS.store.db;
    const report = [];
    let fatal = null;
    for (const key of Object.keys(TABLE_MAP)) {
      const map = TABLE_MAP[key];
      if (fatal) {
        report.push({ key, table: map.table, ok: false, error: 'No ejecutado: ' + fatal });
        continue;
      }
      if (key === 'withholdings') {
        const rows = prepareRows((db.withholdings || []).map((v) => ({ ...v, proveedor_rif: v.proveedor_rif || null })));
        try {
          const n = await upsert(map.table, map.conflict, rows);
          report.push({ key, table: map.table, ok: true, count: n });
        } catch (err) {
          report.push({ key, table: map.table, ok: false, error: err.message });
          if (isNetworkFailure(err)) fatal = err.message;
        }
        continue;
      }
      if (key === 'driverEvents') {
        // Las fechas vacías del formulario se envían como NULL para PostgreSQL.
        const rows = prepareRows((db.driverEvents || []).map((e) => ({
          ...e,
          nivel_aplicar: e.nivel_aplicar || null,
          fecha_inicio: e.fecha_inicio || null,
          fecha_fin: e.fecha_fin || null
        })));
        try {
          const n = await upsert(map.table, map.conflict, rows);
          report.push({ key, table: map.table, ok: true, count: n });
        } catch (err) {
          report.push({ key, table: map.table, ok: false, error: err.message });
          if (isNetworkFailure(err)) fatal = err.message;
        }
        continue;
      }
      try {
        const rows = prepareRows(db[key] || []);
        if (key === 'clients' || key === 'drivers') {
          rows.forEach((row) => {
            if (!row.fecha_registro) {
              row.fecha_registro = row.created_at
                ? String(row.created_at).slice(0, 10)
                : new Date().toISOString().slice(0, 10);
            }
          });
        }
        const n = await upsert(map.table, map.conflict, rows);
        report.push({ key, table: map.table, ok: true, count: n });
      } catch (err) {
        report.push({ key, table: map.table, ok: false, error: err.message });
        if (isNetworkFailure(err)) fatal = err.message;
      }
    }
    if (fatal) return report;

    // Asientos + líneas
    try {
      const localEntries = db.entries || [];
      // El número de asiento es la clave de negocio; el id remoto puede diferir
      // del local. Usar el id remoto evita que el upsert cambie la PK y arrastre
      // las líneas antiguas a un estado duplicado.
      const remoteEntries = await rest('accounting_entries?select=id,numero');
      const remoteIdByNumero = new Map((remoteEntries || []).map((e) => [e.numero, e.id]));
      const entries = prepareRows(localEntries.map((e) => ({
        id: remoteIdByNumero.get(e.numero) || e.id,
        numero: e.numero, fecha: e.fecha, descripcion: e.descripcion,
        referencia: e.referencia, origen: e.origen, tasa_bcv: e.tasa_bcv, created_at: e.created_at
      })));
      const n = await upsert('accounting_entries', 'numero', entries);
      // Saneamiento previo: los asientos que arrastran líneas de una
      // sincronización anterior se vacían por completo (el trigger de partida
      // doble acepta el asiento sin líneas) y se vuelven a enviar completas.
      const cleaned = await cleanupStaleEntryLines(localEntries, remoteIdByNumero);
      // Las líneas se envían por asiento completo: el trigger diferido de
      // partida doble valida al cierre de cada transacción y no debe recibir
      // un asiento partido entre dos lotes.
      const groups = localEntries.map((e) => {
        const entryId = remoteIdByNumero.get(e.numero) || e.id;
        return e.lines.map((l, i) => ({
          id: entryId + '_' + i, entry_id: entryId, cuenta: l.cuenta, debe: l.debe, haber: l.haber, orden: i
        }));
      });
      let chunk = [];
      let nl = 0;
      const flush = async () => {
        if (!chunk.length) return;
        nl += await upsert('accounting_entry_lines', 'id', chunk);
        chunk = [];
      };
      for (const group of groups) {
        if (chunk.length && chunk.length + group.length > 200) await flush();
        chunk.push(...group);
      }
      await flush();
      report.push({ key: 'entries', table: 'accounting_entries + lines', ok: true, count: n + nl, cleaned });
    } catch (err) {
      report.push({ key: 'entries', table: 'accounting_entries', ok: false, error: err.message });
    }

    // Parámetros fiscales
    try {
      await upsert('tax_parameters', 'id', [{
        id: 1,
        bcv_rate: db.taxParams.bcvRate,
        iva_general: db.taxParams.ivaGeneral,
        iva_reducido: db.taxParams.ivaReducido,
        igtf: db.taxParams.igtf,
        unidad_tributaria: db.taxParams.ut,
        islr_tariffs: db.taxParams.islrTariffs,
        updated_at: new Date().toISOString()
      }]);
      report.push({ key: 'tax_parameters', table: 'tax_parameters', ok: true, count: 1 });
    } catch (err) {
      report.push({ key: 'tax_parameters', table: 'tax_parameters', ok: false, error: err.message });
    }

    saveConfig({ lastSync: new Date().toISOString() });
    if (NS.store && NS.store.db) {
      NS.store.db.meta.supabaseLastSync = new Date().toISOString();
      NS.store.save();
    }
    return report;
  }

  async function pullClientsDrivers() {
    if (!isConfigured()) throw new Error('Supabase no está configurado.');
    const [clients, drivers] = await Promise.all([
      rest('clients?select=*&order=cedula_rif'),
      rest('drivers?select=*&order=cedula_rif')
    ]);
    let n = 0;
    (clients || []).forEach((c) => {
      try { NS.store.upsertClient(c); n++; } catch (e) { /* registro inválido */ }
    });
    (drivers || []).forEach((d) => {
      try { NS.store.upsertDriver(d); n++; } catch (e) { /* registro inválido */ }
    });
    return n;
  }

  NS.supabase = {
    getConfig, saveConfig, isConfigured, testConnection,
    uploadDocument, getDocumentUrl, resolve, deleteDocument, fileToDataUrl,
    syncAll, pullClientsDrivers,
    filesReady, importFiles,
    listFiles: getFiles
  };
})();
