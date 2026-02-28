const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Serve products from JSON file
app.get('/api/products', (req, res) => {
  const productsPath = path.join(__dirname, 'public', 'products.json');
  if (fs.existsSync(productsPath)) {
    const products = JSON.parse(fs.readFileSync(productsPath, 'utf8'));
    // Transform for frontend - use nipporigift URLs
    const transformed = products.map((p, i) => ({
      id: i + 1,
      product_code: p.code,
      name: p.name,
      price: parseInt(p.shopPrice?.replace(/[^\d]/g, '') || '0'),
      shopPrice: p.shopPrice,
      normalPrice: p.normalPrice,
      barcode: p.barcode,
      description: p.description,
      category: p.categories?.[0] || '',
      stock: p.stock === '有貨' ? 10 : 0,
      active: 1,
      // Use nipporigift URLs directly
      image_url: p.image_url || `http://www.nipporigift.net/upload/save_image/${p.code}_500.jpg`
    }));
    res.json(transformed);
  } else {
    res.json([]);
  }
});

app.get('/api/test', (req, res) => {
  res.json({ status: 'ok' });
});

// Root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

module.exports = app;
