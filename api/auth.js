// POST /api/auth -> cuentas. Acciones: register, login (clientes), adminLogin (oculto), me, myOrders
const { redis, same, makeToken, readToken, hashPw, checkPw, tooMany, failed } = require('../lib/store');

const clean = (s, n) => String(s == null ? '' : s).trim().slice(0, n);

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });
  try {
    const b = req.body || {};

    if (b.action === 'me') {
      const p = readToken(req);
      return res.status(200).json({ user: p && p.r === 'client' ? { name: p.name, email: p.email, role: 'client' } : null });
    }
    if (b.action === 'myOrders') {
      const p = readToken(req);
      if (!p || p.r !== 'client') return res.status(401).json({ error: 'Inicia sesión para ver tus pedidos' });
      const rows = await redis('LRANGE', 'uorders:' + p.email, 0, 29);
      return res.status(200).json({ orders: (rows || []).map((r) => JSON.parse(r)) });
    }

    if (await tooMany(req)) return res.status(429).json({ error: 'Demasiados intentos. Espera unos minutos.' });

    // Acceso del administrador: usuario y contraseña definidos en las variables de entorno de Vercel
    if (b.action === 'adminLogin') {
      const U = process.env.ADMIN_USER, P = process.env.ADMIN_PASSWORD;
      if (!U || !P) return res.status(500).json({ error: 'Falta configurar ADMIN_USER y ADMIN_PASSWORD en Vercel.' });
      const ok = same(clean(b.user, 80), U) & same(String(b.password || ''), P);
      if (!ok) { await failed(req); return res.status(401).json({ error: 'Datos incorrectos' }); }
      return res.status(200).json({ token: makeToken({ r: 'admin', name: 'Administrador' }, 1) });
    }

    const email = clean(b.email, 120).toLowerCase(), password = String(b.password || '');
    if (b.action === 'register') {
      const name = clean(b.name, 60);
      if (!name) return res.status(400).json({ error: 'Escribe tu nombre' });
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Correo no válido' });
      if (password.length < 6) return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
      if (await redis('HEXISTS', 'users', email)) return res.status(409).json({ error: 'Ese correo ya tiene una cuenta' });
      await failed(req);   // también frena el registro masivo
      await redis('HSET', 'users', email, JSON.stringify({ name, email, ...hashPw(password), created: Date.now() }));
      return res.status(200).json({ token: makeToken({ r: 'client', name, email }, 30), user: { name, email, role: 'client' } });
    }
    if (b.action === 'login') {
      const raw = await redis('HGET', 'users', email);
      const u = raw && JSON.parse(raw);
      if (!u || !checkPw(password, u)) { await failed(req); return res.status(401).json({ error: 'Correo o contraseña incorrectos' }); }
      return res.status(200).json({ token: makeToken({ r: 'client', name: u.name, email }, 30), user: { name: u.name, email, role: 'client' } });
    }
    res.status(400).json({ error: 'Acción desconocida' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
