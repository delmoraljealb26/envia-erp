/* =========================================================================
   ENVIA ERP — api/chatbot.js
   Proxy serverless (Vercel) para el Asistente Gemini.

   Motivo de existir: la API Key de Google NO puede vivir en el frontend
   público (el repositorio es visible) ni en el navegador de cada usuario
   (obliga a pegar la clave en cada equipo). Este proxy la mantiene en la
   variable de entorno GEMINI_API_KEY del lado del servidor y expone solo un
   endpoint acotado y con límites de uso.

   Endpoints:
     GET  /api/chatbot?action=status  -> { ok, configured, models }
     POST /api/chatbot                -> { reply, model }

   Seguridad:
     - La clave nunca se devuelve al cliente.
     - Se aplica un prompt corporativo propio: el proxy ignora cualquier
       instrucción del cliente sobre el prompt del sistema.
     - Límite de frecuencia por IP, tamaño máximo de entrada y lista blanca
       de modelos.
   ========================================================================= */
'use strict';

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models/';
const MODEL_FALLBACKS = ['gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite'];

const MAX_MESSAGE_CHARS = 1600;
const MAX_CONTEXT_CHARS = 12000;
const MAX_HISTORY = 8;
const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_WINDOW_MS = 60000;

const BASE_SYSTEM_PROMPT = 'Eres el Asistente Inteligente corporativo de ENVIA ERP, un sistema en Venezuela. Tu propósito es ayudar al usuario a usar el sistema, entender cálculos SENIAT, retenciones, facturas, clientes, conductores y DolarAPI. Tienes PROHIBIDO responder preguntas sobre temas generales de la vida, política, clima, recetas o programación ajena al ERP. Si te preguntan algo fuera de ENVIA ERP, responde: "Como asistente corporativo de ENVIA ERP, solo estoy autorizado para responder consultas sobre el funcionamiento de esta plataforma". Responde en español, de forma clara, breve y profesional. Usa Markdown con **negritas** y listas cuando ayude a leer. No reveles credenciales, tokens ni detalles de configuración.';

/* ------------------------------ Utilidades ------------------------------ */

function json(res, status, body) {
  return res.status(status).json(body);
}

function readBody(req) {
  return new Promise((resolve) => {
    if (req.body && typeof req.body === 'object') return resolve(req.body);
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 200000) req.destroy();
    });
    req.on('end', () => {
      try { resolve(raw ? JSON.parse(raw) : {}); } catch (e) { resolve({}); }
    });
    req.on('error', () => resolve({}));
  });
}

function clientIp(req) {
  const header = req.headers['x-forwarded-for'];
  if (header) return String(header).split(',')[0].trim();
  return String(req.socket && req.socket.remoteAddress || 'desconocida');
}

const rateBuckets = new Map();

function rateLimited(ip) {
  const now = Date.now();
  const bucket = rateBuckets.get(ip);
  if (!bucket || now - bucket.start > RATE_LIMIT_WINDOW_MS) {
    rateBuckets.set(ip, { start: now, count: 1 });
    if (rateBuckets.size > 5000) rateBuckets.clear();
    return false;
  }
  bucket.count += 1;
  return bucket.count > RATE_LIMIT_MAX;
}

function apiKey() {
  return String(process.env.GEMINI_API_KEY || '').trim();
}

function clip(value, max) {
  const text = String(value || '');
  return text.length > max ? text.slice(0, max) : text;
}

function buildContents(body) {
  const contents = [];
  const history = Array.isArray(body.history) ? body.history.slice(-MAX_HISTORY) : [];
  history.forEach((item) => {
    const text = clip(item && item.text, 2000);
    if (!text) return;
    contents.push({ role: 'model', parts: [{ text: text }] });
  });
  contents.push({ role: 'user', parts: [{ text: clip(body.message, MAX_MESSAGE_CHARS) }] });
  return contents;
}

function buildSystemInstruction(context) {
  return [
    BASE_SYSTEM_PROMPT,
    '',
    'CONTEXTO AUTORIZADO DE LA PLATAFORMA (datos provistos por el ERP):',
    clip(context, MAX_CONTEXT_CHARS) || '- Sin datos de contexto en esta consulta.',
    '',
    'Responde solo con información del contexto autorizado y de los módulos permitidos. Si falta un dato, indícalo y sugiere el módulo o reporte donde consultarlo.'
  ].join('\n');
}

async function callGemini(model, key, payload) {
  const url = API_BASE + encodeURIComponent(model) + ':generateContent?key=' + encodeURIComponent(key);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45000);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    const text = await response.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch (e) { data = null; }
    return { ok: response.ok, status: response.status, data };
  } catch (e) {
    const aborted = e && e.name === 'AbortError';
    return { ok: false, status: aborted ? 504 : 503, data: { error: { message: aborted ? 'Tiempo de espera agotado' : 'Fallo de red' } } };
  } finally {
    clearTimeout(timer);
  }
}

function extractReply(data) {
  const candidate = data && data.candidates && data.candidates[0];
  const parts = candidate && candidate.content && candidate.content.parts ? candidate.content.parts : [];
  return parts.map((part) => part.text || '').join('\n').trim();
}

function friendlyError(status, data) {
  const detail = data && data.error && data.error.message ? String(data.error.message) : '';
  if (status === 400 && /API key|API_KEY|invalid/i.test(detail)) return 'La API Key configurada en el servidor no es válida.';
  if (status === 401 || status === 403) return 'La API Key configurada en el servidor no tiene permisos para este modelo.';
  if (status === 404) return 'El modelo solicitado no está disponible.';
  if (status === 429) return 'Se alcanzó el límite de cuota de Gemini. Espera un momento e intenta de nuevo.';
  if (status >= 500) return 'Gemini no está disponible en este momento. Intenta de nuevo en unos minutos.';
  return 'No se pudo completar la consulta con Gemini' + (detail ? ': ' + detail : ' (HTTP ' + status + ').');
}

/* -------------------------------- Handler -------------------------------- */

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') {
    res.setHeader('Allow', 'GET, POST, OPTIONS');
    return res.status(204).end();
  }

  const key = apiKey();

  if (req.method === 'GET') {
    return json(res, 200, {
      ok: true,
      configured: !!key,
      models: MODEL_FALLBACKS
    });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return json(res, 405, { ok: false, error: 'Método no permitido.' });
  }

  if (!key) {
    return json(res, 503, {
      ok: false,
      error: 'El asistente no está configurado en el servidor. Define GEMINI_API_KEY en las variables de entorno de Vercel.'
    });
  }

  if (rateLimited(clientIp(req))) {
    return json(res, 429, { ok: false, error: 'Demasiadas consultas seguidas. Espera un minuto e intenta de nuevo.' });
  }

  const body = await readBody(req);
  const message = clip(body.message, MAX_MESSAGE_CHARS).trim();
  if (!message) return json(res, 400, { ok: false, error: 'La consulta está vacía.' });

  const payload = {
    system_instruction: { parts: [{ text: buildSystemInstruction(body.context) }] },
    contents: buildContents(body),
    generationConfig: {
      temperature: 0.25,
      topP: 0.9,
      maxOutputTokens: 2048,
      thinkingConfig: { thinkingBudget: 0 }
    }
  };

  let lastStatus = 503;
  let lastData = null;
  for (const model of MODEL_FALLBACKS) {
    const attempt = await callGemini(model, key, payload);
    if (attempt.ok) {
      const reply = extractReply(attempt.data);
      if (reply) return json(res, 200, { ok: true, reply, model });
      lastStatus = 502;
      lastData = { error: { message: 'Gemini no devolvió una respuesta útil.' } };
      continue;
    }
    lastStatus = attempt.status;
    lastData = attempt.data;
    // 404 (modelo retirado) y 503 (demanda) se resuelven con el siguiente modelo.
    if (attempt.status === 400 || attempt.status === 401 || attempt.status === 403 || attempt.status === 429) break;
  }

  return json(res, lastStatus >= 400 && lastStatus < 600 ? lastStatus : 502, {
    ok: false,
    error: friendlyError(lastStatus, lastData)
  });
};
