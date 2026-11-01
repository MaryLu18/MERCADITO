// POST /api/admin -> acciones del administrador (exigen sesión con rol admin): check, saveProduct, deleteProduct, saveConfig, orders
const { redis, isAdmin, saveAdmin, checkAdminPassword, tooMany, failed } = require('../lib/store');

const str = (v, n) => String(v == null ? '' : v).slice(0, n);

function cleanProduct(p) {
  const id = Math.floor(Number(p && p.id));
  if (!id) throw new Error('Producto no válido');
  const imgs = (Array.isArray(p.imgs) ? p.imgs : p.img ? [p.img] : []).filter((s) => typeof s === 'string' && s.length < 400000).slice(0, 4);
  return {
    id,
    stock: Math.max(0, Math.floor(Number(p.stock) || 0)),
    data: { id, title: str(p.title, 120), price: Math.max(0, Number(p.price) || 0), cat: str(p.cat, 40), desc: str(p.desc, 1000), seller: str(p.seller || 'Tienda', 60), img: imgs[0] || '', imgs },
  };
}

function cleanConfig(c = {}) {
  const cats = (Array.isArray(c.cats) ? c.cats : []).map((x) => str(x, 40)).filter((x) => x && x.toLowerCase() !== 'todo').slice(0, 30);
  const catimg = {};
  for (const k of Object.keys(c.catimg || {})) if ((cats.includes(k) || k === 'Todo') && typeof c.catimg[k] === 'string' && c.catimg[k].length < 200000) catimg[k] = c.catimg[k];
  const hero = c.hero && c.hero.t ? { t: str(c.hero.t, 90), d: str(c.hero.d, 220) } : null;
  const qr = typeof c.qr === 'string' && c.qr.length < 600000 ? c.qr : '';
  return { cats, catimg, hero, qr };
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });
  try {
    const b = req.body || {};
    if (!(await isAdmin(req))) return res.status(401).json({ error: 'Sesión vencida. Inicia sesión de nuevo.' });

    switch (b.action) {
      case 'check':
        return res.status(200).json({ ok: true });
      case 'saveProduct': {
        const p = cleanProduct(b.product);
        await redis('HSET', 'products', p.id, JSON.stringify(p.data));
        await redis('HSET', 'stock', p.id, p.stock);
        return res.status(200).json({ ok: true });
      }
      case 'deleteProduct': {
        const id = Math.floor(Number(b.id));
        await redis('HDEL', 'products', id); await redis('HDEL', 'stock', id);
        return res.status(200).json({ ok: true });
      }
      case 'saveConfig':
        const json = JSON.stringify(cleanConfig(b.config));
        if (json.length > 900000) return res.status(400).json({ error: 'Las imágenes pesan demasiado. Quita alguna o usa fotos más pequeñas.' });
        await redis('SET', 'config', json);
        return res.status(200).json({ ok: true });
      case 'orders': {
        const rows = await redis('LRANGE', 'orders', 0, 49);
        return res.status(200).json({ orders: (rows || []).map((r) => JSON.parse(r)) });
      }
      case 'changeCredentials': {   // cambia usuario y contraseña (se guardan cifrados en la base de datos)
        if (await tooMany(req)) return res.status(429).json({ error: 'Demasiados intentos. Espera unos minutos.' });
        if (!(await checkAdminPassword(b.current))) { await failed(req); return res.status(403).json({ error: 'La contraseña actual no es correcta' }); }
        const user = str(b.user, 40).trim(), pw = String(b.password || '');
        if (user.length < 3) return res.status(400).json({ error: 'El usuario debe tener al menos 3 caracteres' });
        if (pw.length < 8 || pw.length > 100) return res.status(400).json({ error: 'La contraseña debe tener entre 8 y 100 caracteres' });
        await saveAdmin(user, pw);
        return res.status(200).json({ ok: true });
      }
      default:
        return res.status(400).json({ error: 'Acción desconocida' });
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
