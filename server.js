const express = require('express');
const session = require('express-session');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const { initDatabase, sql } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure directories exist
const uploadDir = path.join(__dirname, 'public', 'uploads');
const productImgDir = path.join(uploadDir, 'products');
const proofDir = path.join(uploadDir, 'proofs');

[uploadDir, productImgDir, proofDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Multer configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let dest = uploadDir;
    if (req.uploadType === 'product') dest = productImgDir;
    else if (req.uploadType === 'proof') dest = proofDir;
    cb(null, dest);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${uuidv4()}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype);
    if (ext && mime) cb(null, true);
    else cb(new Error('Only images allowed'));
  }
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: 'ohya2-secret-key-2024',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }
}));

app.use((req, res, next) => {
  if (req.path.startsWith('/api/products') && req.method === 'POST') req.uploadType = 'product';
  else if (req.path.startsWith('/api/orders') && req.method === 'POST') req.uploadType = 'proof';
  else req.uploadType = 'general';
  next();
});

// Auth middleware
function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Login required' });
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session.isAdmin) return res.status(403).json({ error: 'Admin only' });
  next();
}

// ============ AUTH ROUTES ============

app.post('/api/register', async (req, res) => {
  try {
    const { email, password, name, phone, address } = req.body;
    const hashed = await bcrypt.hash(password, 10);
    await sql`
      INSERT INTO users (email, password, name, phone, address)
      VALUES (${email}, ${hashed}, ${name}, ${phone}, ${address})
    `;
    res.json({ success: true });
  } catch (e) {
    res.status(400).json({ error: 'Email already exists' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const [user] = await sql`SELECT * FROM users WHERE email = ${email}`;
    if (!user) return res.status(400).json({ error: 'Invalid credentials' });
    
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ error: 'Invalid credentials' });
    
    req.session.userId = user.id;
    req.session.isAdmin = user.is_admin === 1;
    req.session.userName = user.name;
    
    res.json({ success: true, isAdmin: user.is_admin === 1, name: user.name });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

app.get('/api/me', (req, res) => {
  if (!req.session.userId) return res.json({ loggedIn: false });
  res.json({ loggedIn: true, isAdmin: req.session.isAdmin, name: req.session.userName });
});

// ============ PRODUCTS ============

app.get('/api/products', async (req, res) => {
  try {
    const products = await sql`SELECT * FROM products WHERE active = 1 ORDER BY id`;
    res.json(products);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/products/:id', async (req, res) => {
  try {
    const [product] = await sql`SELECT * FROM products WHERE id = ${req.params.id}`;
    if (!product) return res.status(404).json({ error: 'Not found' });
    res.json(product);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/products', requireAdmin, upload.single('image'), async (req, res) => {
  try {
    const { product_code, name, price, description, barcode, category, stock, active } = req.body;
    const image_url = req.file ? `/uploads/products/${req.file.filename}` : '';
    
    await sql`
      INSERT INTO products (product_code, name, price, description, barcode, category, stock, active, image_url)
      VALUES (${product_code}, ${name}, ${price}, ${description}, ${barcode}, ${category}, ${stock}, ${active}, ${image_url})
    `;
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/products/:id', requireAdmin, async (req, res) => {
  try {
    const { product_code, name, price, description, barcode, category, stock, active } = req.body;
    await sql`
      UPDATE products SET product_code = ${product_code}, name = ${name}, price = ${price},
      description = ${description}, barcode = ${barcode}, category = ${category},
      stock = ${stock}, active = ${active} WHERE id = ${req.params.id}
    `;
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/products/:id', requireAdmin, async (req, res) => {
  try {
    await sql`DELETE FROM products WHERE id = ${req.params.id}`;
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// CSV Import/Export
app.get('/api/products/export', requireAdmin, async (req, res) => {
  try {
    const products = await sql`SELECT * FROM products ORDER BY id`;
    const csv = ['product_code,name,price,description,barcode,category,stock,active,image_url'];
    products.forEach(p => {
      csv.push(`${p.product_code},${p.name},${p.price},${p.description||''},${p.barcode||''},${p.category||''},${p.stock},${p.active},${p.image_url||''}`);
    });
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=products.csv');
    res.send(csv.join('\n'));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/products/import', requireAdmin, upload.single('file'), async (req, res) => {
  try {
    const csv = req.file.buffer.toString();
    const lines = csv.split('\n').slice(1);
    let imported = 0;
    
    for (const line of lines) {
      if (!line.trim()) continue;
      const [product_code, name, price, description, barcode, category, stock, active] = line.split(',');
      if (name && price) {
        try {
          await sql`
            INSERT INTO products (product_code, name, price, description, barcode, category, stock, active)
            VALUES (${product_code}, ${name}, ${parseInt(price)}, ${description}, ${barcode}, ${category}, ${parseInt(stock)||0}, ${active==='TRUE'})
          `;
          imported++;
        } catch(e) {}
      }
    }
    res.json({ success: true, imported });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============ CART ============

app.post('/api/cart', (req, res) => {
  if (!req.session.cart) req.session.cart = [];
  const { productId, name, price, quantity, image_url } = req.body;
  const existing = req.session.cart.find(item => item.productId === productId);
  if (existing) existing.quantity += quantity;
  else req.session.cart.push({ productId, name, price, quantity, image_url });
  res.json({ success: true, cart: req.session.cart });
});

app.get('/api/cart', (req, res) => {
  res.json(req.session.cart || []);
});

app.post('/api/cart/clear', (req, res) => {
  req.session.cart = [];
  res.json({ success: true });
});

// ============ ORDERS ============

app.post('/api/orders', requireAuth, upload.single('proof'), async (req, res) => {
  try {
    const { items, total } = req.body;
    const proof = req.file ? `/uploads/proofs/${req.file.filename}` : '';
    
    const [order] = await sql`
      INSERT INTO orders (user_id, total, bank_transfer_proof, status)
      VALUES (${req.session.userId}, ${total}, ${proof}, 'pending')
      RETURNING id
    `;
    
    for (const item of items) {
      await sql`
        INSERT INTO order_items (order_id, product_id, quantity, price)
        VALUES (${order.id}, ${item.productId}, ${item.quantity}, ${item.price})
      `;
    }
    
    req.session.cart = [];
    res.json({ success: true, orderId: order.id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/orders', requireAuth, async (req, res) => {
  try {
    let orders;
    if (req.session.isAdmin) {
      orders = await sql`SELECT o.*, u.name as user_name FROM orders o JOIN users u ON o.user_id = u.id ORDER BY o.created_at DESC`;
    } else {
      orders = await sql`SELECT * FROM orders WHERE user_id = ${req.session.userId} ORDER BY created_at DESC`;
    }
    res.json(orders);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/orders/:id/status', requireAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    await sql`UPDATE orders SET status = ${status} WHERE id = ${req.params.id}`;
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============ INIT & START ============

async function start() {
  try {
    await initDatabase();
    console.log('Server ready!');
  } catch (e) {
    console.error('Init error:', e);
  }
}

start();

module.exports = app;
