const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Helper to read/write JSON
const readJson = (file) => {
  const filePath = path.join(__dirname, 'public', file);
  if (fs.existsSync(filePath)) {
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (e) {
      console.error(`Error reading ${file}:`, e);
      return [];
    }
  }
  return [];
};

const writeJson = (file, data) => {
  const filePath = path.join(__dirname, 'public', file);
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.error(`Error writing ${file}:`, e);
  }
};

// --- Products API ---

app.get('/api/products', (req, res) => {
  const products = readJson('products.json');
  // Transform for frontend
  const transformed = products.map((p, i) => ({
    id: p.id || p.product_id || i + 1, // Prefer existing ID, fallback to index
    product_code: p.code || p.product_code,
    name: p.name,
    price: typeof p.shopPrice === 'number' ? p.shopPrice : parseInt((p.shopPrice || '0').replace(/[^\d]/g, '')),
    shopPrice: p.shopPrice, // Keep original string
    stock: p.stock === '有貨' ? 10 : (parseInt(p.stock) || 0),
    category: p.category || (p.categories?.[0]) || 'オナホール',
    description: p.description || '',
    image_url: p.image_url || `http://www.nipporigift.net/upload/save_image/${p.code}_500.jpg`
  }));
  res.json(transformed);
});

app.post('/api/products', (req, res) => {
  const products = readJson('products.json');
  const newProduct = {
    product_id: Date.now(),
    code: req.body.product_code,
    name: req.body.name,
    shopPrice: req.body.price,
    stock: req.body.stock,
    category: req.body.category,
    description: req.body.description,
    image_url: req.body.image_url
  };
  products.push(newProduct);
  writeJson('products.json', products);
  res.json({ success: true, product: newProduct });
});

app.put('/api/products/:id', (req, res) => {
  const products = readJson('products.json');
  const id = req.params.id;
  const index = products.findIndex(p => (p.id || p.product_id || -1) == id);
  
  if (index !== -1) {
    // Merge updates
    const updated = { ...products[index], ...req.body };
    // Map frontend fields back to storage fields
    if (req.body.product_code) updated.code = req.body.product_code;
    if (req.body.price) updated.shopPrice = req.body.price;
    if (req.body.category) updated.category = req.body.category; // Ensure category is saved
    
    products[index] = updated;
    writeJson('products.json', products);
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Product not found' });
  }
});

app.delete('/api/products/:id', (req, res) => {
  let products = readJson('products.json');
  const id = req.params.id;
  const initialLength = products.length;
  products = products.filter(p => (p.id || p.product_id || -1) != id);
  
  if (products.length < initialLength) {
    writeJson('products.json', products);
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Product not found' });
  }
});

// --- Orders API ---

app.get('/api/orders', (req, res) => {
  res.json(readJson('orders.json'));
});

app.put('/api/orders/:id', (req, res) => {
  const orders = readJson('orders.json');
  const index = orders.findIndex(o => o.id == req.params.id);
  if (index !== -1) {
    orders[index] = { ...orders[index], ...req.body };
    writeJson('orders.json', orders);
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Order not found' });
  }
});

// --- Customers API ---

app.get('/api/customers', (req, res) => {
  res.json(readJson('customers.json'));
});

app.get('/api/test', (req, res) => {
  res.json({ status: 'ok' });
});

// Root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server if run directly
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = app;
