// POST /api/auth -> acceso oculto del administrador (acción adminLogin)
const { same, makeToken, tooMany, failed, ADMIN_USER, ADMIN_PASSWORD } = require('../lib/store');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });
  try {
    const b = req.body || {};
    if (b.action !== 'adminLogin') return res.status(400).json({ error: 'Acción desconocida' });
    if (await tooMany(req)) return res.status(429).json({ error: 'Demasiados intentos. Espera unos minutos.' });

    // El usuario no distingue mayúsculas (los teléfonos suelen poner la primera en mayúscula); la contraseña sí.
    const user = String(b.user || '').trim().toLowerCase();
    const ok = same(user, ADMIN_USER.toLowerCase()) & same(String(b.password || ''), ADMIN_PASSWORD);
    if (!ok) { await failed(req); return res.status(401).json({ error: 'Datos incorrectos' }); }
    res.status(200).json({ token: makeToken({ r: 'admin' }, 1) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
