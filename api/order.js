// POST /api/order -> registra un pedido y descuenta el stock en el servidor (nadie puede comprar más de lo disponible)
const { redis } = require('../lib/store');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });
  const done = [];   // descuentos ya aplicados, por si hay que deshacerlos
  const undo = () => Promise.all(done.map((d) => redis('HINCRBY', 'stock', d.id, d.qty)));
  try {
    const { items, name, phone } = req.body || {};
    if (!Array.isArray(items) || !items.length || items.length > 50) return res.status(400).json({ error: 'El carrito está vacío' });
    if (!String(name || '').trim() || !String(phone || '').trim()) return res.status(400).json({ error: 'Falta tu nombre o teléfono' });

    const lines = [];
    for (const it of items) {
      const id = String(Math.floor(Number(it.id))), qty = Math.floor(Number(it.qty));
      if (!(qty > 0 && qty <= 1000)) { await undo(); return res.status(400).json({ error: 'Cantidad no válida' }); }
      const raw = await redis('HGET', 'products', id);
      if (!raw) { await undo(); return res.status(404).json({ error: 'Un producto del carrito ya no existe' }); }
      const p = JSON.parse(raw);
      const left = await redis('HINCRBY', 'stock', id, -qty);   // operación atómica
      if (left < 0) {
        await redis('HINCRBY', 'stock', id, qty); await undo();
        return res.status(409).json({ error: 'No hay suficiente stock de "' + p.title + '"' });
      }
      done.push({ id, qty });
      lines.push({ id: p.id, title: p.title, qty, price: p.price });
    }
    const order = {
      time: Date.now(), name: String(name).trim().slice(0, 60), phone: String(phone).trim().slice(0, 30),
      items: lines, total: lines.reduce((s, l) => s + l.price * l.qty, 0),
    };
    await redis('LPUSH', 'orders', JSON.stringify(order));
    await redis('LTRIM', 'orders', 0, 199);
    res.status(200).json({ ok: true });
  } catch (e) {
    await undo().catch(() => {});
    res.status(500).json({ error: e.message });
  }
};
