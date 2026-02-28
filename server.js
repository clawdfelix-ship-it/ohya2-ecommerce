const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Load products from nipporigift downloads
function loadProducts() {
  const productsDir = '/Users/sallychan/Desktop/Clawd Felix/downloads/nippori';
  const allProducts = [];
  
  // Try to load from various category folders
  const categories = ['category_101', 'category_102', 'category_70', 'category_71', 'category_72', 'category_73', 'category_103'];
  
  for (const cat of categories) {
    const jsonPath = path.join(productsDir, cat, 'products.json');
    if (fs.existsSync(jsonPath)) {
      try {
        const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
        allProducts.push(...data);
      } catch (e) {
        console.log('Error loading', cat, e.message);
      }
    }
  }
  
  return allProducts;
}

// API Routes
app.get('/api/products', (req, res) => {
  const products = loadProducts();
  res.json(products);
});

app.get('/api/test', (req, res) => {
  res.json({ status: 'ok', products: loadProducts().length });
});

// Root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

module.exports = app;
