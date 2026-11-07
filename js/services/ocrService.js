/* =========================================================================
   ENVIA ERP · services/ocrService.js
   Lectura asistida de documentos (fechas de emisión y vencimiento).
   Es un servicio OPCIONAL: si no hay un endpoint de visión configurado,
   devuelve un error controlado y la UI permite capturar las fechas a mano.
   No se ejecuta en segundo plano ni bloquea la carga de documentos.
   ========================================================================= */
(function () {
  'use strict';

  const NS = (window.ENVIA = window.ENVIA || {});
  const CONFIG_KEY = 'envia_ai_config_v1';

  function getConfig() {
    try {
      const raw = localStorage.getItem(CONFIG_KEY);
      const c = raw ? JSON.parse(raw) : null;
      return c && typeof c === 'object' ? c : { endpoint: '', token: '', model: '' };
    } catch (e) {
      return { endpoint: '', token: '', model: '' };
    }
  }

  function saveConfig(cfg) {
    const clean = {
      endpoint: String((cfg && cfg.endpoint) || '').trim(),
      token: String((cfg && cfg.token) || '').trim(),
      model: String((cfg && cfg.model) || '').trim()
    };
    try {
      localStorage.setItem(CONFIG_KEY, JSON.stringify(clean));
      return clean;
    } catch (e) {
      throw new Error('No se pudo guardar la configuración de lectura IA en este navegador.');
    }
  }

  function isConfigured() {
    return !!getConfig().endpoint;
  }

  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      if (!file) return reject(new Error('No se recibió ningún archivo.'));
      if (file.size > 10 * 1024 * 1024) return reject(new Error('El archivo supera el límite de 10 MB.'));
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('No se pudo leer el archivo para el análisis.'));
      reader.readAsDataURL(file);
    });
  }

  function extractDates(text) {
    const out = { emision: '', vencimiento: '' };
    if (!text) return out;
    const iso = String(text).match(/(\d{4}-\d{2}-\d{2})/g) || [];
    if (iso.length) {
      out.emision = iso[0];
      out.vencimiento = iso[1] || '';
      return out;
    }
    const dmy = String(text).match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/g) || [];
    const toIso = (s) => {
      const p = s.split(/[\/\-.]/);
      if (p.length !== 3) return '';
      let [d, m, y] = p;
      if (y.length === 2) y = '20' + y;
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    };
    if (dmy.length) {
      out.emision = toIso(dmy[0]);
      out.vencimiento = dmy[1] ? toIso(dmy[1]) : '';
    }
    return out;
  }

  async function readDocument(file) {
    const cfg = getConfig();
    if (!cfg.endpoint) {
      return { ok: false, error: 'La lectura automática con IA no está configurada. Captura las fechas manualmente o configura un endpoint de visión.' };
    }
    try {
      const dataUrl = await fileToDataUrl(file);
      const body = {
        model: cfg.model || 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'Eres un asistente que extrae fechas de documentos venezolanos (cédula, RIF, licencia, carnet de circulación, seguro RCV). Responde SOLO un JSON válido con las claves "emision" y "vencimiento" en formato YYYY-MM-DD. Si no puedes determinarlas, usa cadena vacía.'
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Extrae la fecha de emisión y la fecha de vencimiento de este documento. Devuelve solo JSON.' },
              { type: 'image_url', image_url: { url: dataUrl } }
            ]
          }
        ],
        temperature: 0
      };
      const headers = { 'Content-Type': 'application/json' };
      if (cfg.token) headers.Authorization = 'Bearer ' + cfg.token;
      const res = await fetch(cfg.endpoint, { method: 'POST', headers, body: JSON.stringify(body) });
      if (!res.ok) throw new Error('El servicio de lectura IA respondió con estado ' + res.status + '.');
      const json = await res.json();
      let content = '';
      if (json && json.choices && json.choices[0] && json.choices[0].message) {
        content = json.choices[0].message.content;
      } else if (json && (json.emision || json.vencimiento)) {
        content = JSON.stringify(json);
      } else if (typeof json === 'string') {
        content = json;
      }
      let parsed = {};
      try {
        const match = String(content).match(/\{[\s\S]*\}/);
        parsed = match ? JSON.parse(match[0]) : {};
      } catch (e) {
        parsed = extractDates(content);
      }
      const dates = extractDates(JSON.stringify(parsed));
      const emision = parsed.emision || dates.emision;
      const vencimiento = parsed.vencimiento || dates.vencimiento;
      if (!emision && !vencimiento) {
        return { ok: false, error: 'La IA no pudo identificar las fechas. Captúralas manualmente.' };
      }
      return { ok: true, emision: emision || '', vencimiento: vencimiento || '', raw: content };
    } catch (e) {
      return { ok: false, error: (e && e.message) || 'La lectura automática falló. Captura las fechas manualmente.' };
    }
  }

  NS.ocr = { getConfig, saveConfig, isConfigured, fileToDataUrl, readDocument, extractDates };
})();
