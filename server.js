const express = require('express');
const path = require('path');
const { initDatabase, sql } = require('./database');

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Initialize database on startup
initDatabase().catch(console.error);

// --- Exchange Rate API ---
let exchangeRate = 0.053; // Default: 1 JPY = 0.053 HKD (approx 1:19)

// Get current exchange rate
app.get('/api/exchange-rate', (req, res) => {
  res.json({ rate: exchangeRate, updated: 'manual' });
});

// Update exchange rate from external API
app.post('/api/exchange-rate/update', async (req, res) => {
  try {
    // Try to fetch live rate
    const response = await fetch('https://api.exchangerate-api.com/v4/latest/JPY');
    const data = await response.json();
    exchangeRate = data.rates.HKD || 0.053;
    res.json({ success: true, rate: exchangeRate, source: 'live' });
  } catch (e) {
    // Fallback to default rate
    exchangeRate = 0.053;
    res.json({ success: true, rate: exchangeRate, source: 'fallback', error: e.message });
  }
});

// Cron job endpoint (for Vercel Cron)
app.get('/api/cron/exchange-rate', async (req, res) => {
  try {
    const response = await fetch('https://api.exchangerate-api.com/v4/latest/JPY');
    const data = await response.json();
    exchangeRate = data.rates.HKD || 0.053;
    console.log('Exchange rate updated:', exchangeRate);
    res.json({ success: true, rate: exchangeRate });
  } catch (e) {
    console.error('Exchange rate update failed:', e);
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/products', async (req, res) => {
  try {
    const products = await sql`SELECT * FROM products WHERE active = 1 ORDER BY id DESC`;
    // Convert JPY to HKD (approx 1 HKD = 19 JPY)
    const exchangeRate = 0.053;
    res.json(products.map(p => ({
      id: p.id,
      product_code: p.product_code,
      name: p.name,
      price: Math.round(p.price * exchangeRate), // Convert JPY to HKD
      stock: p.stock,
      category: p.category,
      description: p.description,
      image_url: p.image_url,
      price_jpy: p.price // Keep original JPY price for reference
    })));
  } catch (e) {
    console.error('Error fetching products:', e);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/products', async (req, res) => {
  try {
    const { product_code, name, price, stock, category, description, image_url } = req.body;
    await sql`
      INSERT INTO products (product_code, name, price, stock, category, description, image_url)
      VALUES (${product_code}, ${name}, ${price}, ${stock}, ${category}, ${description}, ${image_url})
    `;
    res.json({ success: true });
  } catch (e) {
    console.error('Error creating product:', e);
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/products/:id', async (req, res) => {
  try {
    const { product_code, name, price, stock, category, description, image_url } = req.body;
    await sql`
      UPDATE products 
      SET product_code = ${product_code}, name = ${name}, price = ${price}, 
          stock = ${stock}, category = ${category}, description = ${description}, 
          image_url = ${image_url}
      WHERE id = ${req.params.id}
    `;
    res.json({ success: true });
  } catch (e) {
    console.error('Error updating product:', e);
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/products/:id', async (req, res) => {
  try {
    // Soft delete - set active = 0
    await sql`UPDATE products SET active = 0 WHERE id = ${req.params.id}`;
    res.json({ success: true });
  } catch (e) {
    console.error('Error deleting product:', e);
    res.status(500).json({ error: e.message });
  }
});

// --- Orders API ---

app.get('/api/orders', async (req, res) => {
  try {
    const orders = await sql`
      SELECT o.*, u.name as customer_name, u.email as customer_email
      FROM orders o 
      LEFT JOIN users u ON o.user_id = u.id 
      ORDER BY o.id DESC
    `;
    
    // Get items for each order
    const ordersWithItems = await Promise.all(orders.map(async (order) => {
      const items = await sql`
        SELECT oi.*, p.name as product_name, p.product_code
        FROM order_items oi
        LEFT JOIN products p ON oi.product_id = p.id
        WHERE oi.order_id = ${order.id}
      `;
      console.log('Order', order.id, 'has', items.length, 'items');
      return { ...order, items };
    }));
    
    res.json(ordersWithItems);
  } catch (e) {
    console.error('Error fetching orders:', e);
    res.status(500).json({ error: e.message });
  }
});

// Get single order with items
app.get('/api/orders/:id', async (req, res) => {
  try {
    const orders = await sql`
      SELECT o.*, u.name as customer_name, u.email as customer_email
      FROM orders o 
      LEFT JOIN users u ON o.user_id = u.id 
      WHERE o.id = ${req.params.id}
    `;
    if (orders.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }
    const order = orders[0];
    
    // Get order items
    const items = await sql`
      SELECT oi.*, p.name as product_name, p.product_code
      FROM order_items oi
      LEFT JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = ${req.params.id}
    `;
    
    res.json({ ...order, items: items });
  } catch (e) {
    console.error('Error fetching order:', e);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/orders', async (req, res) => {
  try {
    const { user_id, total, items } = req.body;
    const result = await sql`
      INSERT INTO orders (user_id, total, status)
      VALUES (${user_id}, ${total}, 'pending')
      RETURNING id
    `;
    const orderId = result[0]?.id;
    
    console.log('Created order:', orderId, 'items:', items?.length);
    
    if (!orderId) {
      throw new Error('Failed to get order ID: ' + JSON.stringify(result));
    }
    
    // Insert order items
    if (items && items.length > 0) {
      for (const item of items) {
        await sql`
          INSERT INTO order_items (order_id, product_id, quantity, price)
          VALUES (${orderId}, ${item.product_id}, ${item.quantity}, ${item.price})
        `;
      }
    }
    
    res.json({ success: true, order_id: orderId });
  } catch (e) {
    console.error('Error creating order:', e);
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/orders/:id', async (req, res) => {
  try {
    const { status } = req.body;
    await sql`UPDATE orders SET status = ${status} WHERE id = ${req.params.id}`;
    res.json({ success: true });
  } catch (e) {
    console.error('Error updating order:', e);
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/orders/:id', async (req, res) => {
  try {
    // Delete order items first
    await sql`DELETE FROM order_items WHERE order_id = ${req.params.id}`;
    // Then delete order
    await sql`DELETE FROM orders WHERE id = ${req.params.id}`;
    res.json({ success: true });
  } catch (e) {
    console.error('Error deleting order:', e);
    res.status(500).json({ error: e.message });
  }
});

// --- Customers API ---

app.get('/api/customers', async (req, res) => {
  try {
    const customers = await sql`
      SELECT u.*, 
             COUNT(o.id) as orders, 
             COALESCE(SUM(o.total), 0) as total
      FROM users u
      LEFT JOIN orders o ON u.id = o.user_id
      WHERE u.is_admin = 0
      GROUP BY u.id
      ORDER BY u.id DESC
    `;
    res.json(customers);
  } catch (e) {
    console.error('Error fetching customers:', e);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/customers', async (req, res) => {
  try {
    const { email, password, name, phone, address } = req.body;
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash(password || 'password123', 10);
    
    await sql`
      INSERT INTO users (email, password, name, phone, address, is_admin)
      VALUES (${email}, ${hashedPassword}, ${name}, ${phone}, ${address}, 0)
    `;
    res.json({ success: true });
  } catch (e) {
    console.error('Error creating customer:', e);
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/customers/:id', async (req, res) => {
  try {
    const { name, phone, address, membership_level } = req.body;
    await sql`
      UPDATE users SET name = ${name}, phone = ${phone}, address = ${address}
      WHERE id = ${req.params.id}
    `;
    res.json({ success: true });
  } catch (e) {
    console.error('Error updating customer:', e);
    res.status(500).json({ error: e.message });
  }
});

// --- Categories API ---

app.get('/api/categories', async (req, res) => {
  try {
    // Get unique categories from products
    const products = await sql`SELECT DISTINCT category FROM products WHERE active = 1`;
    const categories = products.map(p => ({ name: p.category, count: 0 }));
    
    // Get count for each category
    for (const cat of categories) {
      const result = await sql`SELECT COUNT(*) as count FROM products WHERE category = ${cat.name} AND active = 1`;
      cat.count = result[0].count;
    }
    
    res.json(categories);
  } catch (e) {
    console.error('Error fetching categories:', e);
    res.status(500).json({ error: e.message });
  }
});

// --- Coupons API ---

app.get('/api/coupons', async (req, res) => {
  // For now, return empty array (coupons stored locally in admin)
  res.json([]);
});

app.post('/api/coupons', async (req, res) => {
  // Coupons stored locally
  res.json({ success: true, message: 'Coupon stored locally' });
});

// --- Analytics API ---

app.get('/api/analytics', async (req, res) => {
  try {
    const totalProducts = await sql`SELECT COUNT(*) as count FROM products WHERE active = 1`;
    const totalOrders = await sql`SELECT COUNT(*) as count FROM orders`;
    const totalCustomers = await sql`SELECT COUNT(*) as count FROM users WHERE is_admin = 0`;
    const totalRevenue = await sql`SELECT COALESCE(SUM(total), 0) as sum FROM orders WHERE status = 'completed'`;
    
    // Orders by status
    const ordersByStatus = await sql`
      SELECT status, COUNT(*) as count FROM orders GROUP BY status
    `;
    
    // Recent orders
    const recentOrders = await sql`
      SELECT o.*, u.name as customer_name
      FROM orders o 
      LEFT JOIN users u ON o.user_id = u.id
      ORDER BY o.id DESC LIMIT 10
    `;
    
    res.json({
      totalProducts: totalProducts[0].count,
      totalOrders: totalOrders[0].count,
      totalCustomers: totalCustomers[0].count,
      totalRevenue: totalRevenue[0].sum,
      ordersByStatus: ordersByStatus,
      recentOrders: recentOrders
    });
  } catch (e) {
    console.error('Error fetching analytics:', e);
    res.status(500).json({ error: e.message });
  }
});

// --- Auth API ---

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const bcrypt = require('bcryptjs');
    const users = await sql`SELECT * FROM users WHERE email = ${email}`;
    
    if (users.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }
    
    const user = users[0];
    const valid = await bcrypt.compare(password, user.password);
    
    if (!valid) {
      return res.status(401).json({ error: 'Invalid password' });
    }
    
    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      is_admin: user.is_admin
    });
  } catch (e) {
    console.error('Error logging in:', e);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/register', async (req, res) => {
  try {
    const { email, password, name, phone } = req.body;
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash(password, 10);
    
    await sql`
      INSERT INTO users (email, password, name, phone)
      VALUES (${email}, ${hashedPassword}, ${name}, ${phone})
    `;
    
    res.json({ success: true });
  } catch (e) {
    console.error('Error registering:', e);
    res.status(500).json({ error: e.message });
  }
});

// --- Test API ---

app.get('/api/test', (req, res) => {
  res.json({ status: 'ok' });
});

// --- Import API ---

app.post('/api/admin/import-products', async (req, res) => {
  try {
    const fs = require('fs');
    const productsPath = path.join(__dirname, 'public', 'products.json');
    const productsData = JSON.parse(fs.readFileSync(productsPath, 'utf8'));
    
    let imported = 0;
    for (const p of productsData) {
      try {
        const price = typeof p.shopPrice === 'number' ? p.shopPrice : 
          parseInt((p.shopPrice || '0').replace(/[^\d]/g, ''));
        const stock = p.stock === '有貨' ? 10 : (parseInt(p.stock) || 0);
        
        await sql`
          INSERT INTO products (product_code, name, price, stock, category, description, image_url, active)
          VALUES (${p.code}, ${p.name}, ${price}, ${stock}, ${p.category || 'オナホール'}, ${p.description || ''}, ${p.image_url}, 1)
        `;
        imported++;
      } catch (e) {
        // Skip duplicates
      }
    }
    
    res.json({ success: true, imported });
  } catch (e) {
    console.error('Import error:', e);
    res.status(500).json({ error: e.message });
  }
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
