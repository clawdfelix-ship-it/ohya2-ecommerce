const express = require('express');
const path = require('path');
const bcrypt = require('bcryptjs');
const { initDatabase, sql, pool } = require('./database');

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Initialize database on startup
initDatabase().then(async () => {
  console.log('✅ Database initialized');
  
  // Run migrations for new columns
  try {
    await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_method TEXT DEFAULT 'sf_cod'`;
    console.log('✅ Migration: shipping_method column added');
  } catch (e) {
    // Ignore if already exists (SQL.js might not support IF NOT EXISTS)
    console.log('ℹ️ shipping_method column check done');
  }
  
  // Migration: Add missing products columns
  const productColumns = ['jan_code', 'price_jpy', 'seo_title', 'seo_description', 'seo_keywords'];
  for (const col of productColumns) {
    try {
      await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS ${sql(col)} TEXT`;
      console.log(`✅ Migration: ${col} column added`);
    } catch (e) {
      console.log(`ℹ️ ${col} column check done`);
    }
  }
  
  // Initialize Telegram Bot (if token configured)
  try {
    const telegramBot = require('./telegram-bot');
    telegramBot.initBot(sql);
    console.log('🤖 Telegram Bot loaded');
  } catch (e) {
    console.log('⚠️ Telegram Bot not available:', e.message);
  }
}).catch(console.error);

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
      jan_code: p.jan_code,
      name: p.name,
      price: Math.round((p.price_retail || p.price) * exchangeRate),
      price_retail: Math.round((p.price_retail || p.price) * exchangeRate),
      price_cost: Math.round((p.price_cost || 0) * exchangeRate),
      price_jpy: p.price_cost || p.price,
      stock: p.stock,
      category: p.category,
      description: p.description,
      image_url: p.image_url,
      image_urls: p.image_urls ? JSON.parse(p.image_urls) : [],
      seo_title: p.seo_title || '',
      seo_description: p.seo_description || '',
      seo_keywords: p.seo_keywords || '',
      active: p.active
    })));
  } catch (e) {
    console.error('Error fetching products:', e);
    res.status(500).json({ error: e.message });
  }
});

// Get single product
app.get('/api/products/:id', async (req, res) => {
  try {
    const products = await sql`SELECT * FROM products WHERE id = ${req.params.id}`;
    if (products.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    const p = products[0];
    
    // Get variants
    const variants = await sql`SELECT * FROM product_variants WHERE product_id = ${req.params.id} AND active = 1`;
    
    res.json({
      id: p.id,
      product_code: p.product_code,
      jan_code: p.jan_code,
      name: p.name,
      price: p.price_retail || p.price,
      price_retail: p.price_retail || p.price,
      price_cost: p.price_cost || 0,
      price_wholesale: p.price_wholesale || 0,
      price_jpy: p.price_cost || p.price,
      stock: p.stock,
      category: p.category,
      description: p.description,
      image_url: p.image_url,
      image_urls: p.image_urls ? JSON.parse(p.image_urls) : [],
      seo_title: p.seo_title || '',
      seo_description: p.seo_description || '',
      seo_keywords: p.seo_keywords || '',
      variants: variants,
      active: p.active
    });
  } catch (e) {
    console.error('Error fetching product:', e);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/products', async (req, res) => {
  try {
    const { product_code, name, price, stock, category, description, image_url, image_urls, seo_title, seo_description, seo_keywords } = req.body;
    const imageUrlsJson = JSON.stringify(image_urls || []);
    await sql`
      INSERT INTO products (product_code, name, price, stock, category, description, image_url, image_urls, seo_title, seo_description, seo_keywords)
      VALUES (${product_code}, ${name}, ${price}, ${stock}, ${category}, ${description}, ${image_url}, ${imageUrlsJson}, ${seo_title || ''}, ${seo_description || ''}, ${seo_keywords || ''})
    `;
    res.json({ success: true });
  } catch (e) {
    console.error('Error creating product:', e);
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/products/:id', async (req, res) => {
  try {
    const { product_code, jan_code, name, price, price_retail, price_cost, price_wholesale, stock, category, description, image_url, image_urls, seo_title, seo_description, seo_keywords, variants } = req.body;
    const imageUrlsJson = JSON.stringify(image_urls || []);
    await sql`
      UPDATE products 
      SET product_code = ${product_code}, 
          jan_code = ${jan_code},
          name = ${name}, 
          price = ${price_retail || price || 0},
          price_retail = ${price_retail || price || 0},
          price_cost = ${price_cost || 0},
          price_wholesale = ${price_wholesale || 0},
          stock = ${stock}, 
          category = ${category}, 
          description = ${description}, 
          image_url = ${image_url},
          image_urls = ${imageUrlsJson},
          seo_title = ${seo_title || ''},
          seo_description = ${seo_description || ''},
          seo_keywords = ${seo_keywords || ''}
      WHERE id = ${req.params.id}
    `;
    
    // Handle variants
    if (variants && Array.isArray(variants)) {
      // Delete existing variants
      await sql`DELETE FROM product_variants WHERE product_id = ${req.params.id}`;
      // Insert new variants
      for (const v of variants) {
        if (v.variant_name && v.variant_value) {
          await sql`
            INSERT INTO product_variants (product_id, variant_name, variant_value, price_modifier, stock, sku, active)
            VALUES (${req.params.id}, ${v.variant_name}, ${v.variant_value}, ${v.price_modifier || 0}, ${v.stock || 0}, ${v.sku || ''}, ${v.active !== false ? 1 : 0})
          `;
        }
      }
    }
    
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

// Product Variants API
app.get('/api/products/:id/variants', async (req, res) => {
  try {
    const variants = await sql`SELECT * FROM product_variants WHERE product_id = ${req.params.id} AND active = 1`;
    res.json(variants);
  } catch (e) {
    console.error('Error fetching variants:', e);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/products/:id/variants', async (req, res) => {
  try {
    const { variant_name, variant_value, price_modifier, stock, sku } = req.body;
    await sql`
      INSERT INTO product_variants (product_id, variant_name, variant_value, price_modifier, stock, sku)
      VALUES (${req.params.id}, ${variant_name}, ${variant_value}, ${price_modifier || 0}, ${stock || 0}, ${sku || ''})
    `;
    res.json({ success: true });
  } catch (e) {
    console.error('Error creating variant:', e);
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/variants/:id', async (req, res) => {
  try {
    await sql`UPDATE product_variants SET active = 0 WHERE id = ${req.params.id}`;
    res.json({ success: true });
  } catch (e) {
    console.error('Error deleting variant:', e);
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
    const { user_id, total, items, shipping_method } = req.body;
    const shippingMethod = shipping_method || 'sf_cod';
    const result = await sql`
      INSERT INTO orders (user_id, total, status, shipping_method)
      VALUES (${user_id}, ${total}, 'pending', ${shippingMethod})
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
    const { status, user_id, shipping_method, tracking_number, internal_notes } = req.body;
    await sql`UPDATE orders SET status = ${status}, user_id = ${user_id}, shipping_method = ${shipping_method}, tracking_number = ${tracking_number}, internal_notes = ${internal_notes} WHERE id = ${req.params.id}`;
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

// ============================================
// Privacy Features - Order Sanitization
// ============================================

// Adult categories that need sanitization on shipping labels
const ADULT_CATEGORIES = ['オナホール', 'ダッチワイフ', 'おっぱいグッズ', '性感クッション', '成人用品'];
const SANITIZED_NAMES = ['禮品', '日用品', '精品', '飾物', '禮物'];

function sanitizeProductName(productName, category) {
  if (ADULT_CATEGORIES.some(cat => category && category.includes(cat))) {
    return SANITIZED_NAMES[Math.floor(Math.random() * SANITIZED_NAMES.length)];
  }
  return productName;
}

// Get sanitized shipping label data
app.get('/api/orders/:id/shipping-label', async (req, res) => {
  try {
    const orderId = req.params.id;
    
    // Get order with user info
    const orders = await sql`
      SELECT o.*, u.name as customer_name, u.phone, u.address
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      WHERE o.id = ${orderId}
    `;
    
    if (orders.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    const order = orders[0];
    
    // Get order items with sanitized product names
    const items = await sql`
      SELECT oi.*, p.name as product_name, p.category
      FROM order_items oi
      LEFT JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = ${orderId}
    `;
    
    // Sanitize product names
    const sanitizedItems = items.map(item => ({
      ...item,
      product_name: sanitizeProductName(item.product_name, item.category)
    }));
    
    res.json({
      order_id: order.id,
      customer_name: order.customer_name || 'Guest',
      phone: order.phone,
      address: order.address,
      items: sanitizedItems,
      total: order.total,
      status: order.status,
      is_sanitized: true
    });
  } catch (e) {
    console.error('Error generating shipping label:', e);
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

// Get customer tags
app.get('/api/customers/:id/tags', async (req, res) => {
  try {
    const tags = await sql`
      SELECT * FROM customer_tags WHERE user_id = ${req.params.id} ORDER BY tag
    `;
    res.json(tags.map(t => t.tag));
  } catch (e) {
    console.error('Error fetching customer tags:', e);
    res.status(500).json({ error: e.message });
  }
});

// Add customer tag
app.post('/api/customers/:id/tags', async (req, res) => {
  try {
    const { tag } = req.body;
    if (!tag) {
      return res.status(400).json({ error: 'Tag is required' });
    }
    await sql`
      INSERT INTO customer_tags (user_id, tag) VALUES (${req.params.id}, ${tag})
      ON CONFLICT (user_id, tag) DO NOTHING
    `;
    res.json({ success: true });
  } catch (e) {
    console.error('Error adding customer tag:', e);
    res.status(500).json({ error: e.message });
  }
});

// Delete customer tag
app.delete('/api/customers/:id/tags/:tag', async (req, res) => {
  try {
    await sql`
      DELETE FROM customer_tags WHERE user_id = ${req.params.id} AND tag = ${req.params.tag}
    `;
    res.json({ success: true });
  } catch (e) {
    console.error('Error deleting customer tag:', e);
    res.status(500).json({ error: e.message });
  }
});

// Get customer with orders (purchase history)
app.get('/api/customers/:id', async (req, res) => {
  try {
    const users = await sql`SELECT * FROM users WHERE id = ${req.params.id} AND is_admin = 0`;
    if (users.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    const customer = users[0];
    
    // Get orders
    const orders = await sql`
      SELECT o.*, u.name as customer_name
      FROM orders o 
      LEFT JOIN users u ON o.user_id = u.id
      WHERE o.user_id = ${req.params.id}
      ORDER BY o.id DESC
    `;
    
    // Get order items for each order
    const ordersWithItems = await Promise.all(orders.map(async (order) => {
      const items = await sql`
        SELECT oi.*, p.name as product_name, p.product_code
        FROM order_items oi
        LEFT JOIN products p ON oi.product_id = p.id
        WHERE oi.order_id = ${order.id}
      `;
      return { ...order, items };
    }));
    
    // Get tags
    const tags = await sql`SELECT tag FROM customer_tags WHERE user_id = ${req.params.id}`;
    
    // Calculate membership level based on total spending
    const totalSpent = ordersWithItems.reduce((sum, o) => sum + (o.total || 0), 0);
    let membership_level = 'Bronze';
    if (totalSpent >= 50000) membership_level = 'Diamond';
    else if (totalSpent >= 30000) membership_level = 'Platinum';
    else if (totalSpent >= 15000) membership_level = 'Gold';
    else if (totalSpent >= 5000) membership_level = 'Silver';
    
    // Calculate next level
    let next_level = null, amount_to_next = 0;
    if (totalSpent < 5000) { next_level = 'Silver'; amount_to_next = 5000 - totalSpent; }
    else if (totalSpent < 15000) { next_level = 'Gold'; amount_to_next = 15000 - totalSpent; }
    else if (totalSpent < 30000) { next_level = 'Platinum'; amount_to_next = 30000 - totalSpent; }
    else if (totalSpent < 50000) { next_level = 'Diamond'; amount_to_next = 50000 - totalSpent; }
    
    res.json({
      ...customer,
      orders: ordersWithItems,
      tags: tags.map(t => t.tag),
      total_spent: totalSpent,
      membership_level: membership_level,
      next_level: next_level,
      amount_to_next: amount_to_next
    });
  } catch (e) {
    console.error('Error fetching customer:', e);
    res.status(500).json({ error: e.message });
  }
});

// --- Categories API ---

app.get('/api/categories', async (req, res) => {
  try {
    const categories = await sql`SELECT * FROM categories WHERE active = 1 ORDER BY sort_order, name`;
    res.json(categories);
  } catch (e) {
    console.error('Error fetching categories:', e);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/categories', async (req, res) => {
  try {
    const { name, parent_id, sort_order } = req.body;
    const result = await sql`
      INSERT INTO categories (name, parent_id, sort_order)
      VALUES (${name}, ${parent_id || null}, ${sort_order || 0})
      RETURNING id
    `;
    res.json({ success: true, id: result[0].id });
  } catch (e) {
    console.error('Error creating category:', e);
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/categories/:id', async (req, res) => {
  try {
    const { name, parent_id, sort_order, active } = req.body;
    await sql`
      UPDATE categories 
      SET name = ${name}, parent_id = ${parent_id || null}, sort_order = ${sort_order || 0}, active = ${active || 1}
      WHERE id = ${req.params.id}
    `;
    res.json({ success: true });
  } catch (e) {
    console.error('Error updating category:', e);
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/categories/:id', async (req, res) => {
  try {
    await sql`UPDATE categories SET active = 0 WHERE id = ${req.params.id}`;
    res.json({ success: true });
  } catch (e) {
    console.error('Error deleting category:', e);
    res.status(500).json({ error: e.message });
  }
});

// --- Coupons API ---

app.get('/api/coupons', async (req, res) => {
  try {
    const coupons = await sql`SELECT * FROM coupons ORDER BY id DESC`;
    res.json(coupons);
  } catch (e) {
    console.error('Error fetching coupons:', e);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/coupons', async (req, res) => {
  try {
    const { code, type, value, min_spend, max_uses, starts_at, expires_at, applicable_type, applicable_ids } = req.body;
    
    // Validate required fields
    if (!code || !type || value === undefined) {
      return res.status(400).json({ error: '缺少必要欄位' });
    }
    
    const codeUpper = code.toUpperCase();
    const applicableIdsJson = JSON.stringify(applicable_ids || []);
    
    await sql`
      INSERT INTO coupons (code, type, value, min_spend, max_uses, starts_at, expires_at, applicable_type, applicable_ids)
      VALUES (${codeUpper}, ${type}, ${value}, ${min_spend || 0}, ${max_uses || 1}, ${starts_at || null}, ${expires_at || null}, ${applicable_type || 'all'}, ${applicableIdsJson})
    `;
    
    res.json({ success: true });
  } catch (e) {
    console.error('Error creating coupon:', e);
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/coupons/:id', async (req, res) => {
  try {
    const { code, type, value, min_spend, max_uses, starts_at, expires_at, applicable_type, applicable_ids, active } = req.body;
    const applicableIdsJson = JSON.stringify(applicable_ids || []);
    
    await sql`
      UPDATE coupons 
      SET code = ${code.toUpperCase()}, 
          type = ${type}, 
          value = ${value},
          min_spend = ${min_spend || 0},
          max_uses = ${max_uses || 1},
          starts_at = ${starts_at || null},
          expires_at = ${expires_at || null},
          applicable_type = ${applicable_type || 'all'},
          applicable_ids = ${applicableIdsJson},
          active = ${active !== false ? 1 : 0}
      WHERE id = ${req.params.id}
    `;
    
    res.json({ success: true });
  } catch (e) {
    console.error('Error updating coupon:', e);
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/coupons/:id', async (req, res) => {
  try {
    await sql`DELETE FROM coupons WHERE id = ${req.params.id}`;
    res.json({ success: true });
  } catch (e) {
    console.error('Error deleting coupon:', e);
    res.status(500).json({ error: e.message });
  }
});

// Validate coupon for checkout
app.post('/api/coupons/validate', async (req, res) => {
  try {
    const { code, cartTotal } = req.body;
    const codeUpper = code.toUpperCase();
    
    const coupons = await sql`
      SELECT * FROM coupons WHERE code = ${codeUpper} AND active = 1
    `;
    
    if (coupons.length === 0) {
      return res.json({ valid: false, error: '優惠碼不存在' });
    }
    
    const coupon = coupons[0];
    
    // Check if expired
    if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
      return res.json({ valid: false, error: '優惠碼已過期' });
    }
    
    // Check if not started yet
    if (coupon.starts_at && new Date(coupon.starts_at) > new Date()) {
      return res.json({ valid: false, error: '優惠碼尚未生效' });
    }
    
    // Check usage limit
    if (coupon.used_count >= coupon.max_uses) {
      return res.json({ valid: false, error: '優惠碼已使用完畢' });
    }
    
    // Check minimum spend
    if (cartTotal < coupon.min_spend) {
      return res.json({ valid: false, error: `最低消費 HK$ ${coupon.min_spend} 才能使用此優惠碼` });
    }
    
    // Calculate discount
    let discount = 0;
    if (coupon.type === 'percentage') {
      discount = Math.round(cartTotal * coupon.value / 100);
    } else if (coupon.type === 'fixed') {
      discount = coupon.value;
    } else if (coupon.type === 'free_shipping') {
      discount = 'free_shipping';
    }
    
    res.json({ 
      valid: true, 
      coupon: coupon,
      discount: discount,
      type: coupon.type
    });
  } catch (e) {
    console.error('Error validating coupon:', e);
    res.status(500).json({ error: e.message });
  }
});

// Use coupon (increment usage count)
app.post('/api/coupons/:code/use', async (req, res) => {
  try {
    const codeUpper = req.params.code.toUpperCase();
    await sql`
      UPDATE coupons SET used_count = used_count + 1 WHERE code = ${codeUpper}
    `;
    res.json({ success: true });
  } catch (e) {
    console.error('Error using coupon:', e);
    res.status(500).json({ error: e.message });
  }
});

// --- Flash Sales API ---

app.get('/api/flash-sales', async (req, res) => {
  try {
    const sales = await sql`
      SELECT fs.*, p.name as product_name, p.product_code, p.image_url
      FROM flash_sales fs
      LEFT JOIN products p ON fs.product_id = p.id
      WHERE fs.active = 1 AND (fs.ends_at IS NULL OR fs.ends_at > NOW())
      ORDER BY fs.id DESC
    `;
    res.json(sales);
  } catch (e) {
    console.error('Error fetching flash sales:', e);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/flash-sales', async (req, res) => {
  try {
    const { product_id, special_price, original_price, starts_at, ends_at } = req.body;
    
    if (!product_id || !special_price) {
      return res.status(400).json({ error: '缺少必要欄位' });
    }
    
    await sql`
      INSERT INTO flash_sales (product_id, special_price, original_price, starts_at, ends_at)
      VALUES (${product_id}, ${special_price}, ${original_price || 0}, ${starts_at || null}, ${ends_at || null})
    `;
    
    res.json({ success: true });
  } catch (e) {
    console.error('Error creating flash sale:', e);
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/flash-sales/:id', async (req, res) => {
  try {
    const { product_id, special_price, original_price, starts_at, ends_at, active } = req.body;
    
    await sql`
      UPDATE flash_sales 
      SET product_id = ${product_id}, 
          special_price = ${special_price},
          original_price = ${original_price || 0},
          starts_at = ${starts_at || null},
          ends_at = ${ends_at || null},
          active = ${active !== false ? 1 : 0}
      WHERE id = ${req.params.id}
    `;
    
    res.json({ success: true });
  } catch (e) {
    console.error('Error updating flash sale:', e);
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/flash-sales/:id', async (req, res) => {
  try {
    await sql`DELETE FROM flash_sales WHERE id = ${req.params.id}`;
    res.json({ success: true });
  } catch (e) {
    console.error('Error deleting flash sale:', e);
    res.status(500).json({ error: e.message });
  }
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

// === Phase 5: Data Analytics ===

// Sales trend data (last 7 or 30 days)
app.get('/api/analytics/sales-trend', async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const salesByDate = await sql`
      SELECT DATE(created_at) as date, COUNT(*) as orders, COALESCE(SUM(total), 0) as revenue
      FROM orders 
      WHERE created_at >= ${startDate.toISOString().split('T')[0]}
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `;
    
    res.json(salesByDate);
  } catch (e) {
    console.error('Error fetching sales trend:', e);
    res.status(500).json({ error: e.message });
  }
});

// Hot products ranking (TOP 10)
app.get('/api/analytics/top-products', async (req, res) => {
  try {
    const topProducts = await sql`
      SELECT p.id, p.name, p.category, p.image_url,
             SUM(oi.quantity) as total_sold, 
             COUNT(DISTINCT oi.order_id) as order_count,
             SUM(oi.quantity * oi.price) as revenue
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      GROUP BY p.id, p.name, p.category, p.image_url
      ORDER BY total_sold DESC
      LIMIT 10
    `;
    
    res.json(topProducts);
  } catch (e) {
    console.error('Error fetching top products:', e);
    res.status(500).json({ error: e.message });
  }
});

// Dashboard stats: today vs yesterday, top categories, customer growth
app.get('/api/analytics/dashboard', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    
    // Today's orders
    const todayOrders = await sql`
      SELECT COUNT(*) as count, COALESCE(SUM(total), 0) as revenue
      FROM orders 
      WHERE DATE(created_at) = ${today}
    `;
    
    // Yesterday's orders
    const yesterdayOrders = await sql`
      SELECT COUNT(*) as count, COALESCE(SUM(total), 0) as revenue
      FROM orders 
      WHERE DATE(created_at) = ${yesterdayStr}
    `;
    
    // This month vs last month
    const thisMonth = new Date();
    thisMonth.setDate(1);
    const lastMonth = new Date(thisMonth);
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    
    const thisMonthOrders = await sql`
      SELECT COUNT(*) as count, COALESCE(SUM(total), 0) as revenue
      FROM orders 
      WHERE created_at >= ${thisMonth.toISOString().split('T')[0]}
    `;
    
    const lastMonthOrders = await sql`
      SELECT COUNT(*) as count, COALESCE(SUM(total), 0) as revenue
      FROM orders 
      WHERE created_at >= ${lastMonth.toISOString().split('T')[0]} AND created_at < ${thisMonth.toISOString().split('T')[0]}
    `;
    
    // Top categories
    const topCategories = await sql`
      SELECT p.category, SUM(oi.quantity) as total_sold
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      WHERE p.category IS NOT NULL AND p.category != ''
      GROUP BY p.category
      ORDER BY total_sold DESC
      LIMIT 5
    `;
    
    // Customer growth (new customers this month vs last month)
    const newCustomersThisMonth = await sql`
      SELECT COUNT(*) as count FROM users 
      WHERE is_admin = 0 AND created_at >= ${thisMonth.toISOString().split('T')[0]}
    `;
    
    const newCustomersLastMonth = await sql`
      SELECT COUNT(*) as count FROM users 
      WHERE is_admin = 0 AND created_at >= ${lastMonth.toISOString().split('T')[0]} AND created_at < ${thisMonth.toISOString().split('T')[0]}
    `;
    
    // Total customers
    const totalCustomers = await sql`SELECT COUNT(*) as count FROM users WHERE is_admin = 0`;
    
    res.json({
      today: {
        orders: todayOrders[0].count,
        revenue: todayOrders[0].revenue
      },
      yesterday: {
        orders: yesterdayOrders[0].count,
        revenue: yesterdayOrders[0].revenue
      },
      thisMonth: {
        orders: thisMonthOrders[0].count,
        revenue: thisMonthOrders[0].revenue
      },
      lastMonth: {
        orders: lastMonthOrders[0].count,
        revenue: lastMonthOrders[0].revenue
      },
      topCategories: topCategories,
      customerGrowth: {
        thisMonth: newCustomersThisMonth[0].count,
        lastMonth: newCustomersLastMonth[0].count,
        total: totalCustomers[0].count
      }
    });
  } catch (e) {
    console.error('Error fetching dashboard:', e);
    res.status(500).json({ error: e.message });
  }
});

// --- Auth API ---

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
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

// ==================== PHASE 6: CSV Import/Export ====================

// CSV Export - Products
app.get('/api/admin/export/products', async (req, res) => {
  try {
    const products = await sql`SELECT * FROM products ORDER BY id DESC`;
    
    // Create CSV header
    const headers = ['id', 'product_code', 'jan_code', 'name', 'price', 'price_retail', 'price_cost', 'stock', 'category', 'description', 'active'];
    const csvRows = [headers.join(',')];
    
    // Add data rows
    for (const p of products) {
      const row = [
        p.id,
        `"${(p.product_code || '').replace(/"/g, '""')}"`,
        `"${(p.jan_code || '').replace(/"/g, '""')}"`,
        `"${(p.name || '').replace(/"/g, '""')}"`,
        p.price || 0,
        p.price_retail || 0,
        p.price_cost || 0,
        p.stock || 0,
        `"${(p.category || '').replace(/"/g, '""')}"`,
        `"${(p.description || '').replace(/"/g, '""')}"`,
        p.active || 1
      ];
      csvRows.push(row.join(','));
    }
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=products.csv');
    res.send('\uFEFF' + csvRows.join('\n')); // UTF-8 BOM for Excel
  } catch (e) {
    console.error('Export products error:', e);
    res.status(500).json({ error: e.message });
  }
});

// CSV Export - Orders
app.get('/api/admin/export/orders', async (req, res) => {
  try {
    const orders = await sql`
      SELECT o.*, u.name as customer_name, u.email as customer_email 
      FROM orders o 
      LEFT JOIN users u ON o.user_id = u.id 
      ORDER BY o.id DESC
    `;
    
    const headers = ['id', 'customer_name', 'customer_email', 'total', 'status', 'tracking_number', 'internal_notes', 'created_at'];
    const csvRows = [headers.join(',')];
    
    for (const o of orders) {
      const row = [
        o.id,
        `"${(o.customer_name || '').replace(/"/g, '""')}"`,
        `"${(o.customer_email || '').replace(/"/g, '""')}"`,
        o.total || 0,
        `"${(o.status || '').replace(/"/g, '""')}"`,
        `"${(o.tracking_number || '').replace(/"/g, '""')}"`,
        `"${(o.internal_notes || '').replace(/"/g, '""')}"`,
        o.created_at ? new Date(o.created_at).toLocaleString('zh-HK') : ''
      ];
      csvRows.push(row.join(','));
    }
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=orders.csv');
    res.send('\uFEFF' + csvRows.join('\n'));
  } catch (e) {
    console.error('Export orders error:', e);
    res.status(500).json({ error: e.message });
  }
});

// CSV Import - Products (Basic)
app.post('/api/admin/import/products', async (req, res) => {
  try {
    const { csvData } = req.body;
    
    if (!csvData || typeof csvData !== 'string') {
      return res.status(400).json({ error: '請提供 CSV 數據' });
    }
    
    const lines = csvData.split('\n').filter(line => line.trim());
    if (lines.length < 2) {
      return res.status(400).json({ error: 'CSV 格式錯誤或沒有數據' });
    }
    
    // Parse CSV (simple parser)
    const parseCSVLine = (line) => {
      const result = [];
      let current = '';
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    };
    
    const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase());
    let imported = 0;
    let skipped = 0;
    let errors = [];
    
    for (let i = 1; i < lines.length; i++) {
      try {
        const values = parseCSVLine(lines[i]);
        if (values.length < 2) continue;
        
        // Map CSV columns to database fields
        const row = {};
        headers.forEach((h, idx) => {
          row[h] = values[idx] || '';
        });
        
        // Validate required fields
        if (!row.name) {
          skipped++;
          continue;
        }
        
        // Check if product exists
        const existing = row.product_code ? 
          await sql`SELECT id FROM products WHERE product_code = ${row.product_code}` : [];
        
        if (existing.length > 0) {
          // Update existing - without price_retail (may not exist in all DBs)
          await sql`
            UPDATE products SET 
              name = ${row.name},
              price = ${parseInt(row.price) || 0},
              stock = ${parseInt(row.stock) || 0},
              category = ${row.category || ''},
              description = ${row.description || ''}
            WHERE id = ${existing[0].id}
          `;
        } else {
          // Insert new - without price_retail (may not exist in all DBs)
          await sql`
            INSERT INTO products (product_code, name, price, stock, category, description, active)
            VALUES (${row.product_code || null}, ${row.name}, ${parseInt(row.price) || 0}, ${parseInt(row.stock) || 0}, ${row.category || ''}, ${row.description || ''}, ${parseInt(row.active) || 1})
          `;
        }
        imported++;
      } catch (e) {
        errors.push(`第 ${i + 1} 行: ${e.message}`);
      }
    }
    
    res.json({ success: true, imported, skipped, errors: errors.slice(0, 5) });
  } catch (e) {
    console.error('Import products error:', e);
    res.status(500).json({ error: e.message });
  }
});

// ==================== PHASE 6: Admin Users & Permissions ====================

// Get admin users list
app.get('/api/admin/users', async (req, res) => {
  try {
    const users = await sql`
      SELECT id, username, email, role, created_at, last_login, active
      FROM admin_users 
      ORDER BY id DESC
    `;
    res.json(users);
  } catch (e) {
    console.error('Get admin users error:', e);
    res.status(500).json({ error: e.message });
  }
});

// Add admin user
app.post('/api/admin/users', async (req, res) => {
  try {
    const { username, email, password, role } = req.body;
    
    if (!username || !email || !password) {
      return res.status(400).json({ error: '請填寫所有必填欄位' });
    }
    
    // Check if email exists
    const existing = await sql`SELECT id FROM admin_users WHERE email = ${email}`;
    if (existing.length > 0) {
      return res.status(400).json({ error: '此電郵已被使用' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const userRole = role || 'staff';
    
    await sql`
      INSERT INTO admin_users (username, email, password, role, active)
      VALUES (${username}, ${email}, ${hashedPassword}, ${userRole}, 1)
    `;
    
    res.json({ success: true });
  } catch (e) {
    console.error('Add admin user error:', e);
    res.status(500).json({ error: e.message });
  }
});

// Update admin user
app.put('/api/admin/users/:id', async (req, res) => {
  try {
    const { username, email, role, active, password } = req.body;
    const userId = parseInt(req.params.id);
    
    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      await sql`
        UPDATE admin_users SET 
          username = ${username},
          email = ${email},
          role = ${role},
          active = ${active},
          password = ${hashedPassword}
        WHERE id = ${userId}
      `;
    } else {
      await sql`
        UPDATE admin_users SET 
          username = ${username},
          email = ${email},
          role = ${role},
          active = ${active}
        WHERE id = ${userId}
      `;
    }
    
    res.json({ success: true });
  } catch (e) {
    console.error('Update admin user error:', e);
    res.status(500).json({ error: e.message });
  }
});

// Delete admin user
app.delete('/api/admin/users/:id', async (req, res) => {
  try {
    await sql`DELETE FROM admin_users WHERE id = ${req.params.id} AND role != 'admin'`;
    res.json({ success: true });
  } catch (e) {
    console.error('Delete admin user error:', e);
    res.status(500).json({ error: e.message });
  }
});

// ==================== PHASE 6: System Info ====================

// Get system info
app.get('/api/admin/system-info', async (req, res) => {
  try {
    // Get database info
    const dbInfo = await pool.query('SELECT current_database(), current_user, version()');
    
    // Get table counts
    const tables = ['products', 'orders', 'users', 'categories', 'coupons'];
    const counts = {};
    
    for (const table of tables) {
      try {
        const result = await pool.query(`SELECT COUNT(*) as count FROM ${table}`);
        counts[table] = parseInt(result.rows[0].count);
      } catch (e) {
        counts[table] = 0;
      }
    }
    
    // Get recent orders count
    const recentOrders = await sql`
      SELECT COUNT(*) as count FROM orders 
      WHERE created_at > NOW() - INTERVAL '7 days'
    `;
    
    res.json({
      version: 'OHYA2.0 v1.0.0',
      database: {
        host: dbInfo.rows[0].current_user + '@' + (process.env.POSTGRES_HOST || 'localhost'),
        name: dbInfo.rows[0].current_database,
        status: 'connected',
        version: dbInfo.rows[0].version.substring(0, 50)
      },
      tables: counts,
      recentOrders7days: recentOrders[0]?.count || 0,
      uptime: process.uptime(),
      nodeVersion: process.version,
      platform: process.platform
    });
  } catch (e) {
    console.error('Get system info error:', e);
    res.status(500).json({ error: e.message });
  }
});

// ==================== TELEGRAM BOT APIs ====================

// Get telegram subscribers
app.get('/api/admin/telegram/subscribers', async (req, res) => {
  try {
    const subscribers = await sql`
      SELECT * FROM telegram_subscribers 
      WHERE active = 1 
      ORDER BY subscribed_at DESC
    `;
    res.json(subscribers);
  } catch (e) {
    console.error('Error fetching subscribers:', e);
    res.status(500).json({ error: e.message });
  }
});

// Broadcast message to all subscribers
app.post('/api/admin/telegram/broadcast', async (req, res) => {
  try {
    const { message, parse_mode } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }
    
    let telegramBot;
    try {
      telegramBot = require('./telegram-bot');
    } catch (e) {
      return res.status(500).json({ error: 'Telegram Bot not available' });
    }
    
    const result = await telegramBot.broadcastToSubscribers(message, { 
      parse_mode: parse_mode || 'Markdown' 
    });
    
    res.json({ 
      success: true, 
      delivered: result.success, 
      failed: result.failed 
    });
  } catch (e) {
    console.error('Broadcast error:', e);
    res.status(500).json({ error: e.message });
  }
});

// Send notification to specific user (by order)
app.post('/api/admin/telegram/notify', async (req, res) => {
  try {
    const { order_id, message } = req.body;
    
    if (!order_id || !message) {
      return res.status(400).json({ error: 'Order ID and message required' });
    }
    
    // Get order and customer info
    const orders = await sql`
      SELECT o.*, u.name as customer_name, u.phone
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      WHERE o.id = ${order_id}
    `;
    
    if (orders.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    const order = orders[0];
    
    let telegramBot;
    try {
      telegramBot = require('./telegram-bot');
    } catch (e) {
      return res.status(500).json({ error: 'Telegram Bot not available' });
    }
    
    // Find subscriber
    const subscriber = await sql`
      SELECT telegram_id FROM telegram_subscribers 
      WHERE name = ${order.customer_name} OR phone = ${order.phone}
      LIMIT 1
    `;
    
    if (subscriber.length === 0) {
      return res.json({ success: false, message: 'Customer not subscribed to Telegram' });
    }
    
    await telegramBot.sendMessage(subscriber[0].telegram_id, message);
    
    res.json({ success: true });
  } catch (e) {
    console.error('Notify error:', e);
    res.status(500).json({ error: e.message });
  }
});

// Notify about new product (webhook for admin)
app.post('/api/admin/telegram/new-product', async (req, res) => {
  try {
    const product = req.body;
    
    let telegramBot;
    try {
      telegramBot = require('./telegram-bot');
    } catch (e) {
      return res.status(500).json({ error: 'Telegram Bot not available' });
    }
    
    const result = await telegramBot.notifyNewProduct(product);
    
    res.json({ success: true, ...result });
  } catch (e) {
    console.error('New product notification error:', e);
    res.status(500).json({ error: e.message });
  }
});

// Notify about flash sale (webhook for admin)
app.post('/api/admin/telegram/flash-sale', async (req, res) => {
  try {
    const { product, discount_percent } = req.body;
    
    let telegramBot;
    try {
      telegramBot = require('./telegram-bot');
    } catch (e) {
      return res.status(500).json({ error: 'Telegram Bot not available' });
    }
    
    const result = await telegramBot.notifyFlashSale(product, discount_percent);
    
    res.json({ success: true, ...result });
  } catch (e) {
    console.error('Flash sale notification error:', e);
    res.status(500).json({ error: e.message });
  }
});

// ==================== END PHASE 6 ====================

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
