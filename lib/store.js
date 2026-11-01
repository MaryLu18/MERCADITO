// Utilidades compartidas: Redis (Upstash, vía REST), credenciales del administrador, sesiones y límite de intentos.
const crypto = require('crypto');

const URL_ = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const TOKEN_ = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

// Credenciales INICIALES. Se usan solo hasta el primer ingreso: ahí quedan guardadas (cifradas) en la base de datos
// y desde el portal puedes cambiarlas. Si defines ADMIN_USER / ADMIN_PASSWORD en Vercel, esos valores tienen prioridad.
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

const same = (a, b) => { a = Buffer.from(String(a)); b = Buffer.from(String(b)); return a.length === b.length && crypto.timingSafeEqual(a, b); };

// ---- Contraseñas: scrypt con sal (nunca se guarda la contraseña en texto) ----
const hashPw = (pw) => { const salt = crypto.randomBytes(16).toString('hex'); return { salt, hash: crypto.scryptSync(pw, salt, 64).toString('hex') }; };
const checkPw = (pw, rec) => same(crypto.scryptSync(pw, rec.salt, 64).toString('hex'), rec.hash);

// ---- Credenciales del administrador, en la clave "admin" de la base de datos ----
const saveAdmin = (user, pw) => redis('SET', 'admin', JSON.stringify({ user: String(user).trim().toLowerCase(), ...hashPw(pw) }));
async function checkAdminPassword(pw) {
  const raw = await redis('GET', 'admin');
  return raw ? checkPw(String(pw || ''), JSON.parse(raw)) : same(String(pw || ''), ADMIN_PASSWORD);
}
async function verifyAdmin(user, password) {   // el usuario no distingue mayúsculas; la contraseña sí
  user = String(user || '').trim().toLowerCase(); password = String(password || '');
  const raw = await redis('GET', 'admin');
  if (raw) { const a = JSON.parse(raw); const u = same(user, a.user), p = checkPw(password, a); return u && p; }
  const u = same(user, ADMIN_USER.toLowerCase()), p = same(password, ADMIN_PASSWORD);   // primer ingreso
  if (u && p) { await saveAdmin(ADMIN_USER, ADMIN_PASSWORD); return true; }
  return false;
}

// ---- Sesión firmada. La clave de firma es un valor aleatorio guardado en la base de datos ("secret") ----
let cachedSecret = '';
async function secret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  if (cachedSecret) return cachedSecret;
  let s = await redis('GET', 'secret');
  if (!s) { await redis('SET', 'secret', crypto.randomBytes(32).toString('hex'), 'NX'); s = await redis('GET', 'secret'); }
  return (cachedSecret = s);
}
const hmac = async (s) => crypto.createHmac('sha256', await secret()).update(s).digest('base64url');

async function makeToken(payload, days) {
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Date.now() + days * 864e5 })).toString('base64url');
  return body + '.' + (await hmac(body));
}
async function readToken(req) {
  const [body, sig] = (req.headers.authorization || '').replace('Bearer ', '').split('.');
  if (!body || !sig || !same(sig, await hmac(body))) return null;
  try { const p = JSON.parse(Buffer.from(body, 'base64url').toString()); return p.exp > Date.now() ? p : null; } catch (e) { return null; }
}
const isAdmin = async (req) => { const p = await readToken(req); return !!p && p.r === 'admin'; };

// ---- Límite de intentos fallidos por IP (8 cada 15 minutos) ----
const ip = (req) => String(req.headers['x-forwarded-for'] || (req.socket && req.socket.remoteAddress) || 'x').split(',')[0].trim();
async function tooMany(req) { return (Number(await redis('GET', 'rl:' + ip(req))) || 0) >= 8; }
async function failed(req) { const k = 'rl:' + ip(req); if ((await redis('INCR', k)) === 1) await redis('EXPIRE', k, 900); }

module.exports = { redis, same, makeToken, readToken, isAdmin, verifyAdmin, saveAdmin, checkAdminPassword, tooMany, failed };
