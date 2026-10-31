// Utilidades compartidas: Redis (Upstash, vía REST), sesión del administrador y límite de intentos.
const crypto = require('crypto');

const URL_ = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const TOKEN_ = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

// Credenciales del administrador. Si defines ADMIN_USER / ADMIN_PASSWORD en Vercel, esos valores tienen prioridad.
const ADMIN_USER = process.env.ADMIN_USER || 'MOKANA';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'MARIDILU18';

// Ejecuta un comando de Redis, por ejemplo redis('HGET', 'products', '1')
async function redis(...cmd) {
  if (!URL_ || !TOKEN_) throw new Error('Falta conectar la base de datos (Upstash Redis) en Vercel.');
  const r = await fetch(URL_, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + TOKEN_, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd.map(String)),
  });
  const j = await r.json();
  if (j.error) throw new Error(j.error);
  return j.result;
}

// ---- Sesión firmada (token = datos en base64 + firma HMAC) ----
const secret = () => process.env.SESSION_SECRET || ADMIN_PASSWORD;
const hmac = (s) => crypto.createHmac('sha256', secret()).update(s).digest('base64url');
const same = (a, b) => { a = Buffer.from(String(a)); b = Buffer.from(String(b)); return a.length === b.length && crypto.timingSafeEqual(a, b); };

function makeToken(payload, days) {
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Date.now() + days * 864e5 })).toString('base64url');
  return body + '.' + hmac(body);
}
function readToken(req) {
  const [body, sig] = (req.headers.authorization || '').replace('Bearer ', '').split('.');
  if (!body || !sig || !same(sig, hmac(body))) return null;
  try { const p = JSON.parse(Buffer.from(body, 'base64url').toString()); return p.exp > Date.now() ? p : null; } catch (e) { return null; }
}
const isAdmin = (req) => { const p = readToken(req); return !!p && p.r === 'admin'; };

// ---- Límite de intentos fallidos por IP (8 cada 15 minutos) ----
const ip = (req) => String(req.headers['x-forwarded-for'] || (req.socket && req.socket.remoteAddress) || 'x').split(',')[0].trim();
async function tooMany(req) { return (Number(await redis('GET', 'rl:' + ip(req))) || 0) >= 8; }
async function failed(req) { const k = 'rl:' + ip(req); if ((await redis('INCR', k)) === 1) await redis('EXPIRE', k, 900); }

module.exports = { redis, same, makeToken, readToken, isAdmin, tooMany, failed, ADMIN_USER, ADMIN_PASSWORD };
