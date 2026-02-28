const express = require('express');
const session = require('express-session');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const { parse } = require('csv-parse/sync');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

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
    if (req.uploadType === 'product') {
      dest = productImgDir;
    } else if (req.uploadType === 'proof') {
      dest = proofDir;
    }
    cb(null, dest);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error('Only image files are allowed'));
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

// Custom middleware to track upload type
app.use((req, res, next) => {
  if (req.path.startsWith('/api/products') && req.method === 'POST') {
    req.uploadType = 'product';
  } else if (req.path.startsWith('/api/orders') && req.method === 'POST') {
    req.uploadType = 'proof';
  } else {
    req.uploadType = 'general';
  }
  next();
});

let db = null;

// Auth middleware
function requireAuth(req, res, next) {
  if (req.session.userId) {
    next();
  } else {
    res.status(401).json({ error: 'Authentication required' });
  }
}

function requireAdmin(req, res, next) {
  if (req.session.isAdmin) {
    next();
  } else {
    res.status(403).json({ error: 'Admin access required' });
  }
}

// ============ AUTH ROUTES ============

// Register
app.post('/api/auth/register', (req, res) => {
  try {
    const { email, password, name, phone } = req.body;
    
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, password, and name are required' });
    }

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);
    const result = db.prepare('INSERT INTO users (email, password, name, phone) VALUES (?, ?, ?, ?)').run(
      email, hashedPassword, name, phone || ''
    );

    res.json({ success: true, message: 'Registration successful' });
  } catch (error) {
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login
app.post('/api/auth/login', (req, res) => {
  try {
    const { email, password } = req.body;
    
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const validPassword = bcrypt.compareSync(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    req.session.userId = user.id;
    req.session.isAdmin = user.is_admin === 1;
    req.session.userName = user.name;

    res.json({ 
      success: true, 
      user: { 
        id: user.id, 
        email: user.email, 
        name: user.name, 
        isAdmin: user.is_admin === 1 
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Login failed' });
  }
});

// Logout
app.post('/api/auth/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

// Get current user
app.get('/api/auth/me', (req, res) => {
  if (!req.session.userId) {
    return res.json({ user: null });
  }
  const user = db.prepare('SELECT id, email, name, phone, is_admin FROM users WHERE id = ?').get(req.session.userId);
  res.json({ user: user ? { id: user.id, email: user.email, name: user.name, isAdmin: user.is_admin === 1 } : null });
});

// ============ PRODUCT ROUTES ============

// Get all products
app.get('/api/products', (req, res) => {
  const { category, active } = req.query;
  let query = 'SELECT * FROM products WHERE 1=1';
  const params = [];

  if (category) {
    query += ' AND category = ?';
    params.push(category);
  }
  if (active !== 'false') {
    query += ' AND active = 1';
  }

  query += ' ORDER BY created_at DESC';
  const products = db.prepare(query).all(...params);
  res.json(products);
});

// Get single product
app.get('/api/products/:id', (req, res) => {
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }
  res.json(product);
});

// Get categories
app.get('/api/categories', (req, res) => {
  const categories = db.prepare('SELECT DISTINCT category FROM products WHERE category IS NOT NULL AND active = 1').all();
  res.json(categories.map(c => c.category));
});

// Admin: Add product
app.post('/api/products', requireAdmin, upload.single('image'), (req, res) => {
  try {
    const { name, description, price, category, stock } = req.body;
    
    if (!name || !price) {
      return res.status(400).json({ error: 'Name and price are required' });
    }

    const image = req.file ? `/uploads/products/${req.file.filename}` : null;
    
    const result = db.prepare(
      'INSERT INTO products (name, description, price, category, image, stock) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(name, description || '', parseFloat(price), category || 'General', image, parseInt(stock) || 0);

    res.json({ success: true, id: result.lastInsertRowid });
  } catch (error) {
    res.status(500).json({ error: 'Failed to add product' });
  }
});

// Admin: Update product
app.put('/api/products/:id', requireAdmin, upload.single('image'), (req, res) => {
  try {
    const { name, description, price, category, stock, active } = req.body;
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
    
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const image = req.file ? `/uploads/products/${req.file.filename}` : product.image;

    db.prepare(`
      UPDATE products 
      SET name = ?, description = ?, price = ?, category = ?, image = ?, stock = ?, active = ?
      WHERE id = ?
    `).run(
      name || product.name,
      description || product.description,
      price ? parseFloat(price) : product.price,
      category || product.category,
      image,
      stock !== undefined ? parseInt(stock) : product.stock,
      active !== undefined ? (active === '1' || active === true ? 1 : 0) : product.active,
      req.params.id
    );

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update product' });
  }
});

// Admin: Delete product
app.delete('/api/products/:id', requireAdmin, (req, res) => {
  try {
    db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

// ============ CSV IMPORT/EXPORT ROUTES ============

// Export all products to CSV
app.get('/api/products/export', requireAdmin, (req, res) => {
  try {
    const products = db.prepare('SELECT * FROM products ORDER BY id DESC').all();
    
    const csvData = products.map(p => ({
      product_code: p.product_code || '',
      name: p.name || '',
      price: p.price || 0,
      description: p.description || '',
      barcode: p.barcode || '',
      category: p.category || '',
      stock: p.stock || 0,
      active: p.active === 1 ? 'TRUE' : 'FALSE',
      image_url: p.image || ''
    }));

    const csvWriter = createCsvWriter({
      path: res,
      header: [
        { id: 'product_code', title: 'product_code' },
        { id: 'name', title: 'name' },
        { id: 'price', title: 'price' },
        { id: 'description', title: 'description' },
        { id: 'barcode', title: 'barcode' },
        { id: 'category', title: 'category' },
        { id: 'stock', title: 'stock' },
        { id: 'active', title: 'active' },
        { id: 'image_url', title: 'image_url' }
      ]
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=ohya2-products-' + Date.now() + '.csv');
    
    csvWriter.writeRecords(csvData).then(() => {
      res.end();
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to export products' });
  }
});

// Import products from CSV
app.post('/api/products/import', requireAdmin, upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const fileContent = fs.readFileSync(req.file.path, 'utf-8');
    const records = parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true
    });

    let imported = 0;
    let updated = 0;
    let errors = [];

    const insertStmt = db.prepare(`
      INSERT INTO products (product_code, name, description, price, barcode, category, stock, active, image)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const updateStmt = db.prepare(`
      UPDATE products SET name = ?, description = ?, price = ?, barcode = ?, category = ?, stock = ?, active = ?, image = ?
      WHERE product_code = ?
    `);

    const selectByCode = db.prepare('SELECT * FROM products WHERE product_code = ?');

    for (let i = 0; i < records.length; i++) {
      const row = records[i];
      
      // Validate required fields
      if (!row.name || !row.price) {
        errors.push(`Row ${i + 1}: Missing name or price`);
        continue;
      }

      const productCode = row.product_code || `PROD-${Date.now()}-${i}`;
      const price = parseFloat(row.price) || 0;
      const stock = parseInt(row.stock) || 0;
      const active = row.active?.toUpperCase() === 'TRUE' || row.active === '1' ? 1 : 0;
      const image = row.image_url || null;

      // Check if product with same code exists
      const existing = selectByCode.get(productCode);

      if (existing) {
        // Update existing
        updateStmt.run(
          row.name,
          row.description || '',
          price,
          row.barcode || '',
          row.category || 'General',
          stock,
          active,
          image,
          productCode
        );
        updated++;
      } else {
        // Insert new
        insertStmt.run(
          productCode,
          row.name,
          row.description || '',
          price,
          row.barcode || '',
          row.category || 'General',
          stock,
          active,
          image
        );
        imported++;
      }
    }

    // Clean up uploaded file
    fs.unlinkSync(req.file.path);

    res.json({ 
      success: true, 
      message: `Import complete: ${imported} new products, ${updated} updated`,
      imported,
      updated,
      errors: errors.length > 0 ? errors : null
    });
  } catch (error) {
    console.error('Import error:', error);
    res.status(500).json({ error: 'Failed to import products: ' + error.message });
  }
});

// ============ ORDER ROUTES ============

// Create order
app.post('/api/orders', requireAuth, upload.single('bankProof'), (req, res) => {
  try {
    const { items, total, shippingName, shippingPhone, shippingAddress } = req.body;

    if (!items || !total || !shippingName || !shippingPhone || !shippingAddress) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const orderNumber = `OHYA-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    const bankProof = req.file ? `/uploads/proofs/${req.file.filename}` : null;

    const result = db.prepare(`
      INSERT INTO orders (user_id, order_number, total, bank_proof, shipping_name, shipping_phone, shipping_address)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(req.session.userId, orderNumber, parseFloat(total), bankProof, shippingName, shippingPhone, shippingAddress);

    const orderId = result.lastInsertRowid;

    // Add order items
    const orderItems = JSON.parse(items);
    const itemStmt = db.prepare('INSERT INTO order_items (order_id, product_id, product_name, price, quantity) VALUES (?, ?, ?, ?, ?)');
    
    for (const item of orderItems) {
      itemStmt.run(orderId, item.id, item.name, item.price, item.quantity);
    }

    res.json({ success: true, orderNumber });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create order' });
  }
});

// Get user orders
app.get('/api/orders', requireAuth, (req, res) => {
  let orders;
  if (req.session.isAdmin) {
    orders = db.prepare(`
      SELECT o.*, u.name as user_name, u.email as user_email 
      FROM orders o 
      LEFT JOIN users u ON o.user_id = u.id
      ORDER BY o.created_at DESC
    `).all();
  } else {
    orders = db.prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC').all(req.session.userId);
  }

  // Get items for each order
  for (const order of orders) {
    order.items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);
  }

  res.json(orders);
});

// Admin: Update order status
app.put('/api/orders/:id/status', requireAdmin, (req, res) => {
  try {
    const { status } = req.body;
    db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update order' });
  }
});

// ============ ADMIN ROUTES ============

// Get admin stats
app.get('/api/admin/stats', requireAdmin, (req, res) => {
  const totalProducts = db.prepare('SELECT COUNT(*) as count FROM products').get().count;
  const totalOrders = db.prepare('SELECT COUNT(*) as count FROM orders').get().count;
  const totalRevenue = db.prepare('SELECT SUM(total) as sum FROM orders WHERE status != ?').get('cancelled');
  const pendingOrders = db.prepare('SELECT COUNT(*) as count FROM orders WHERE status = ?').get('pending');

  res.json({
    totalProducts,
    totalOrders,
    totalRevenue: totalRevenue.sum || 0,
    pendingOrders: pendingOrders.count
  });
});

// ============ INIT & START ============

async function startServer() {
  const { initDatabase, db: database } = require('./database');
  db = database;
  
  await initDatabase();

  app.listen(PORT, () => {
    console.log(`OHYA2.0 E-Commerce Server running on http://localhost:${PORT}`);
  });
}

startServer().catch(console.error);
