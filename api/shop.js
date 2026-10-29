// GET /api/shop -> catálogo público (productos con su stock) y configuración de la tienda
const { redis } = require('../lib/store');

const pairs = (a) => { const o = {}; for (let i = 0; i < (a || []).length; i += 2) o[a[i]] = a[i + 1]; return o; };

module.exports = async (req, res) => {
  try {
    const [pf, sf, cfg] = await Promise.all([redis('HGETALL', 'products'), redis('HGETALL', 'stock'), redis('GET', 'config')]);
    const P = pairs(pf), S = pairs(sf);
    const products = Object.keys(P).map((id) => ({ ...JSON.parse(P[id]), stock: Number(S[id] || 0) }));
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ products, config: cfg ? JSON.parse(cfg) : null });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
