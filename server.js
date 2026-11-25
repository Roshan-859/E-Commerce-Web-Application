const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const DATA_FILE = path.join(DATA_DIR, 'store.json');
const sessions = new Map();
const image = (id, w = 760) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=85`;
const initial = {
  users: [
    { id: 'u_admin', name: 'Store Admin', email: 'admin@atelier.shop', salt: 'atelier-demo-salt', passwordHash: crypto.scryptSync('admin123', 'atelier-demo-salt', 64).toString('hex'), role: 'admin' },
    { id: 'u_guest', name: 'Demo Customer', email: 'hello@example.com', salt: 'customer-demo-salt', passwordHash: crypto.scryptSync('shop1234', 'customer-demo-salt', 64).toString('hex'), role: 'user' }
  ],
  products: [
    { id: 'p01', name: 'Everyday Carry Tote', category: 'Accessories', price: 48, color: 'Natural canvas', description: 'A sturdy, easygoing canvas tote made for the everyday essentials.', image: image('photo-1544816155-12df9643f363'), featured: true, stock: 18 },
    { id: 'p02', name: 'Cloud Knit Sweater', category: 'Apparel', price: 96, color: 'Oat milk', description: 'A soft, relaxed knit to layer through the changing seasons.', image: image('photo-1576566588028-4147f3842f27'), featured: true, stock: 12 },
    { id: 'p03', name: 'Studio Ceramic Cup', category: 'Home', price: 32, color: 'Warm white', description: 'Hand-finished stoneware with a comfortable, generous handle.', image: image('photo-1514228742587-6b1558fcca3d'), featured: false, stock: 24 },
    { id: 'p04', name: 'Weekend Field Watch', category: 'Accessories', price: 138, color: 'Olive / steel', description: 'A clean, dependable timepiece with a brushed steel case.', image: image('photo-1523275335684-37898b6baf30'), featured: true, stock: 8 },
    { id: 'p05', name: 'Ribbed Lounge Set', category: 'Apparel', price: 84, color: 'Soft sage', description: 'A breathable cotton blend for slow mornings and long evenings.', image: image('photo-1551488831-00ddcb6c6bd3'), featured: false, stock: 15 },
    { id: 'p06', name: 'Sunday Pour-over Set', category: 'Home', price: 56, color: 'Sandstone', description: 'A thoughtful little ritual: ceramic dripper and serving carafe.', image: image('photo-1495474472287-4d71bcdd2085'), featured: true, stock: 11 },
    { id: 'p07', name: 'Soft Form Crossbody', category: 'Accessories', price: 72, color: 'Chocolate', description: 'Just enough room for the things you carry, with hands-free ease.', image: image('photo-1548036328-c9fa89d128fa'), featured: false, stock: 9 },
    { id: 'p08', name: 'Linen Table Runner', category: 'Home', price: 44, color: 'Natural flax', description: 'Washed linen brings a quiet, lived-in feel to the table.', image: image('photo-1603199506016-b9a594b593c0'), featured: false, stock: 20 }
  ], orders: []
};
function readStore() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, JSON.stringify(initial, null, 2));
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}
function saveStore(db) { fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2)); }
const safeUser = u => ({ id: u.id, name: u.name, email: u.email, role: u.role });
const respond = (res, status, body, headers = {}) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers }); res.end(JSON.stringify(body)); };
function bodyOf(req) { return new Promise((resolve, reject) => { let raw = ''; req.on('data', c => { raw += c; if (raw.length > 1e6) reject(new Error('Request too large')); }); req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch { reject(new Error('Invalid JSON')); } }); }); }
function currentUser(req, db) { const token = (req.headers.cookie || '').split(';').map(x => x.trim()).find(x => x.startsWith('atelier_session='))?.slice('atelier_session='.length); const uid = sessions.get(token); return db.users.find(u => u.id === uid); }
function requireRole(user, role) { return user && (role === 'user' || user.role === 'admin'); }
function publicProduct(p) { return { id: p.id, name: p.name, category: p.category, price: p.price, color: p.color, description: p.description, image: p.image, featured: p.featured, stock: p.stock }; }
async function handleApi(req, res, db, url) {
  const route = url.pathname;
  if (req.method === 'GET' && route === '/api/products') return respond(res, 200, db.products.map(publicProduct));
  if (req.method === 'GET' && route === '/api/me') { const user = currentUser(req, db); return respond(res, 200, { user: user ? safeUser(user) : null }); }
  if (req.method === 'POST' && route === '/api/login') {
    const { email = '', password = '' } = await bodyOf(req); const user = db.users.find(u => u.email.toLowerCase() === String(email).trim().toLowerCase());
    const candidate = user && crypto.scryptSync(String(password), user.salt, 64).toString('hex');
    if (!user || !crypto.timingSafeEqual(Buffer.from(candidate, 'hex'), Buffer.from(user.passwordHash, 'hex'))) return respond(res, 401, { error: 'That email and password do not match.' });
    const token = crypto.randomBytes(32).toString('hex'); sessions.set(token, user.id);
    return respond(res, 200, { user: safeUser(user) }, { 'Set-Cookie': `atelier_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800` });
  }
  if (req.method === 'POST' && route === '/api/logout') { const token = (req.headers.cookie || '').split(';').map(x => x.trim()).find(x => x.startsWith('atelier_session='))?.slice('atelier_session='.length); sessions.delete(token); return respond(res, 200, { ok: true }, { 'Set-Cookie': 'atelier_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0' }); }
  const user = currentUser(req, db);
  if (route === '/api/orders' && req.method === 'GET') { if (!requireRole(user, 'user')) return respond(res, 401, { error: 'Please sign in to view orders.' }); return respond(res, 200, db.orders.filter(o => user.role === 'admin' || o.userId === user.id).sort((a,b) => b.createdAt.localeCompare(a.createdAt))); }
  if (route === '/api/orders' && req.method === 'POST') {
    if (!requireRole(user, 'user')) return respond(res, 401, { error: 'Please sign in before checkout.' });
    const body = await bodyOf(req); if (!Array.isArray(body.items) || !body.items.length) return respond(res, 400, { error: 'Your bag is empty.' });
    const items = [];
    for (const row of body.items) { const p = db.products.find(x => x.id === row.id); const qty = Math.floor(Number(row.quantity)); if (!p || !Number.isFinite(qty) || qty < 1 || qty > p.stock) return respond(res, 400, { error: 'One or more items are unavailable. Please refresh your bag.' }); items.push({ productId: p.id, name: p.name, image: p.image, price: p.price, quantity: qty }); }
    for (const item of items) db.products.find(p => p.id === item.productId).stock -= item.quantity;
    const order = { id: `AT-${crypto.randomBytes(3).toString('hex').toUpperCase()}`, userId: user.id, customer: user.name, items, total: items.reduce((n, x) => n + x.price * x.quantity, 0), status: 'Processing', createdAt: new Date().toISOString() };
    db.orders.push(order); saveStore(db); return respond(res, 201, order);
  }
  if (route.startsWith('/api/orders/') && req.method === 'PATCH') {
    if (!user || user.role !== 'admin') return respond(res, 403, { error: 'Admin access is required.' });
    const order = db.orders.find(o => o.id === route.split('/')[3]); if (!order) return respond(res, 404, { error: 'Order not found.' });
    const { status } = await bodyOf(req); if (!['Processing', 'Packed', 'Shipped', 'Delivered'].includes(status)) return respond(res, 400, { error: 'Choose a valid order status.' }); order.status = status; saveStore(db); return respond(res, 200, order);
  }
  if (route === '/api/products' && req.method === 'POST') {
    if (!user || user.role !== 'admin') return respond(res, 403, { error: 'Admin access is required.' }); const b = await bodyOf(req);
    if (!b.name || !b.category || !Number.isFinite(Number(b.price)) || Number(b.price) < 0 || !Number.isInteger(Number(b.stock)) || Number(b.stock) < 0) return respond(res, 400, { error: 'Add a name, category, valid price, and whole number for stock.' });
    const product = { id: `p_${crypto.randomBytes(4).toString('hex')}`, name: String(b.name).slice(0,80), category: String(b.category).slice(0,40), price: Number(b.price), color: String(b.color || 'Natural').slice(0,50), description: String(b.description || '').slice(0,240), image: String(b.image || image('photo-1542291026-7eec264c27ff')).slice(0,500), featured: Boolean(b.featured), stock: Number(b.stock) };
    db.products.unshift(product); saveStore(db); return respond(res, 201, publicProduct(product));
  }
  const match = route.match(/^\/api\/products\/([^/]+)$/);
  if (match && req.method === 'DELETE') { if (!user || user.role !== 'admin') return respond(res, 403, { error: 'Admin access is required.' }); if (db.orders.some(o => o.items.some(i => i.productId === match[1]))) return respond(res, 409, { error: 'This item is part of an order and can’t be removed.' }); db.products = db.products.filter(p => p.id !== match[1]); saveStore(db); return respond(res, 200, { ok: true }); }
  return respond(res, 404, { error: 'Not found.' });
}
const types = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.svg':'image/svg+xml', '.png':'image/png', '.ico':'image/x-icon' };
http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    if (url.pathname.startsWith('/api/')) return await handleApi(req, res, readStore(), url);
    const filePath = url.pathname === '/' ? path.join(ROOT, 'public', 'index.html') : path.resolve(ROOT, 'public', `.${decodeURIComponent(url.pathname)}`);
    const publicRoot = path.join(ROOT, 'public') + path.sep;
    if (!filePath.startsWith(publicRoot)) return respond(res, 403, { error: 'Forbidden' });
    fs.readFile(filePath, (err, data) => { if (err) return respond(res, 404, { error: 'Not found' }); res.writeHead(200, { 'Content-Type': types[path.extname(filePath)] || 'application/octet-stream' }); res.end(data); });
  } catch (err) { respond(res, 500, { error: 'Something went wrong. Please try again.' }); }
}).listen(PORT, () => console.log(`Atelier is ready at http://localhost:${PORT}`));
