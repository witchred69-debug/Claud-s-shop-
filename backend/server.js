import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createClient } from '@supabase/supabase-js';

const requiredEnv = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'ADMIN_EMAILS'];
const missingEnv = requiredEnv.filter((key) => !process.env[key]);
if (missingEnv.length) {
  console.error(`Missing required environment variables: ${missingEnv.join(', ')}`);
  process.exit(1);
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});
const adminEmails = new Set(process.env.ADMIN_EMAILS.split(',').map((email) => email.trim().toLowerCase()).filter(Boolean));
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').map((origin) => origin.trim()).filter(Boolean);
const app = express();
const port = Number(process.env.PORT) || 3000;

app.disable('x-powered-by');
app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    // Allow non-browser health checks; browser requests must match configured origins.
    if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Origin is not allowed by CORS'));
  }
}));
app.use(express.json({ limit: '100kb' }));
app.use('/api', rateLimit({ windowMs: 60_000, limit: 100, standardHeaders: 'draft-7', legacyHeaders: false }));
app.use('/api/orders', rateLimit({ windowMs: 60_000, limit: 10, standardHeaders: 'draft-7', legacyHeaders: false }));

const categories = new Set(['Odjeća', 'Obuća', 'Kućanske stvari', 'Alati', 'Knjige', 'Antikviteti', 'Igračke', 'Stvari za djecu']);
const publicProduct = (row) => ({
  id: row.id,
  category: row.category,
  title: row.title,
  condition: row.condition,
  price: Number(row.price),
  desc: row.description,
  img: row.image_url
});
const fail = (res, status, message) => res.status(status).json({ error: message });

async function requireAdmin(req, res, next) {
  const match = /^Bearer\s+(.+)$/i.exec(req.get('authorization') || '');
  if (!match) return fail(res, 401, 'Prijava je potrebna.');
  const { data, error } = await supabase.auth.getUser(match[1]);
  if (error || !data.user?.email || !adminEmails.has(data.user.email.toLowerCase())) {
    return fail(res, 403, 'Nemate dozvolu za ovu radnju.');
  }
  req.admin = data.user;
  return next();
}

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.get('/api/products', async (_req, res) => {
  const { data, error } = await supabase.from('products')
    .select('id,category,title,condition,price,description,image_url')
    .eq('active', true).order('created_at', { ascending: false });
  if (error) return fail(res, 500, 'Proizvode trenutno nije moguće učitati.');
  return res.json(data.map(publicProduct));
});

app.post('/api/orders', async (req, res) => {
  const { items, paymentMethod, customerName = null, customerContact = null } = req.body || {};
  if (!Array.isArray(items) || items.length < 1 || items.length > 30) return fail(res, 400, 'Narudžba mora sadržavati od 1 do 30 artikala.');
  if (!['Uplata na račun', 'Aircash uplata'].includes(paymentMethod)) return fail(res, 400, 'Način plaćanja nije valjan.');

  const ids = [...new Set(items.map((item) => Number(item?.productId)))];
  if (ids.length !== items.length || ids.some((id) => !Number.isSafeInteger(id) || id < 1)) return fail(res, 400, 'Popis artikala nije valjan.');

  const { data: products, error: productError } = await supabase.from('products')
    .select('id,title,price,active').in('id', ids).eq('active', true);
  if (productError) return fail(res, 500, 'Narudžbu trenutno nije moguće provjeriti.');
  if (!products || products.length !== ids.length) return fail(res, 409, 'Jedan ili više artikala više nisu dostupni.');

  const byId = new Map(products.map((product) => [Number(product.id), product]));
  const orderItems = ids.map((id) => {
    const product = byId.get(id);
    return { productId: id, title: product.title, price: Number(product.price), quantity: 1 };
  });
  const total = orderItems.reduce((sum, item) => sum + item.price, 0);
  const cleanName = typeof customerName === 'string' ? customerName.trim().slice(0, 120) : null;
  const cleanContact = typeof customerContact === 'string' ? customerContact.trim().slice(0, 200) : null;

  const { data: order, error } = await supabase.from('orders').insert({
    items: orderItems,
    total,
    payment_method: paymentMethod,
    customer_name: cleanName || null,
    customer_contact: cleanContact || null
  }).select('id,total,status,created_at').single();
  if (error) return fail(res, 500, 'Narudžbu trenutno nije moguće spremiti.');
  return res.status(201).json(order);
});

app.get('/api/admin/products', requireAdmin, async (_req, res) => {
  const { data, error } = await supabase.from('products').select('*').order('created_at', { ascending: false });
  if (error) return fail(res, 500, 'Proizvode trenutno nije moguće učitati.');
  return res.json(data);
});

app.post('/api/admin/products', requireAdmin, async (req, res) => {
  const body = req.body || {};
  const { category, title, condition = 'Očuvano', price, desc = '', img = '' } = body;
  const numericPrice = Number(price);
  if (!categories.has(category) || typeof title !== 'string' || !title.trim() || title.trim().length > 120 || !Number.isFinite(numericPrice) || numericPrice < 0) {
    return fail(res, 400, 'Provjerite kategoriju, naziv i cijenu proizvoda.');
  }
  if (typeof img !== 'string' || (img && !/^https:\/\//i.test(img))) return fail(res, 400, 'Slika mora biti sigurna HTTPS poveznica.');
  const { data, error } = await supabase.from('products').insert({
    category,
    title: title.trim(),
    condition: typeof condition === 'string' ? condition.trim().slice(0, 80) : 'Očuvano',
    price: numericPrice,
    description: typeof desc === 'string' ? desc.trim().slice(0, 1000) : '',
    image_url: img
  }).select('*').single();
  if (error) return fail(res, 500, 'Proizvod nije moguće spremiti.');
  return res.status(201).json(data);
});

app.patch('/api/admin/products/:id', requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) return fail(res, 400, 'ID proizvoda nije valjan.');
  const body = req.body || {};
  const updates = {};
  if (body.active !== undefined) {
    if (typeof body.active !== 'boolean') return fail(res, 400, 'Status proizvoda nije valjan.');
    updates.active = body.active;
  }
  if (Object.keys(updates).length === 0) return fail(res, 400, 'Nema valjanih izmjena.');
  updates.updated_at = new Date().toISOString();
  const { data, error } = await supabase.from('products').update(updates).eq('id', id).select('*').maybeSingle();
  if (error) return fail(res, 500, 'Proizvod nije moguće ažurirati.');
  if (!data) return fail(res, 404, 'Proizvod nije pronađen.');
  return res.json(data);
});

app.get('/api/admin/orders', requireAdmin, async (_req, res) => {
  const { data, error } = await supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(100);
  if (error) return fail(res, 500, 'Narudžbe trenutno nije moguće učitati.');
  return res.json(data);
});

app.use((error, _req, res, _next) => {
  if (error.message === 'Origin is not allowed by CORS') return fail(res, 403, 'Origin nije dozvoljen.');
  console.error(error);
  return fail(res, 500, 'Dogodila se neočekivana greška.');
});

app.listen(port, '0.0.0.0', () => console.log(`Claud's Shop API listening on port ${port}`));
