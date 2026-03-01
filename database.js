const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

// Create connection pool from POSTGRES_URL environment variable
const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

const sql = async (strings, ...values) => {
  // Convert tagged template literal to query
  let query = '';
  const params = [];
  let paramIndex = 1;
  
  for (let i = 0; i < strings.length; i++) {
    query += strings[i];
    if (i < values.length) {
      query += `$${paramIndex}`;
      params.push(values[i]);
      paramIndex++;
    }
  }
  
  // Handle all queries
  const result = await pool.query(query, params);
  return result.rows;
};

async function initDatabase() {
  try {
    // Create tables if they don't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        name TEXT NOT NULL,
        phone TEXT,
        address TEXT,
        is_admin INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        product_code TEXT UNIQUE,
        jan_code TEXT,
        name TEXT NOT NULL,
        price INTEGER NOT NULL DEFAULT 0,
        price_retail INTEGER DEFAULT 0,
        price_wholesale INTEGER DEFAULT 0,
        price_cost INTEGER DEFAULT 0,
        description TEXT,
        barcode TEXT,
        category TEXT,
        stock INTEGER DEFAULT 0,
        active INTEGER DEFAULT 1,
        image_url TEXT,
        image_urls TEXT DEFAULT '[]',
        seo_title TEXT,
        seo_description TEXT,
        seo_keywords TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Product variants table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS product_variants (
        id SERIAL PRIMARY KEY,
        product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
        variant_name TEXT,
        variant_value TEXT,
        price_modifier INTEGER DEFAULT 0,
        stock INTEGER DEFAULT 0,
        sku TEXT,
        active INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        total INTEGER NOT NULL,
        status TEXT DEFAULT 'pending',
        bank_transfer_proof TEXT,
        tracking_number TEXT,
        internal_notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        parent_id INTEGER REFERENCES categories(id),
        sort_order INTEGER DEFAULT 0,
        active INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS order_items (
        id SERIAL PRIMARY KEY,
        order_id INTEGER REFERENCES orders(id),
        product_id INTEGER REFERENCES products(id),
        quantity INTEGER NOT NULL,
        price INTEGER NOT NULL
      )
    `);

    // Customer tags table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS customer_tags (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        tag TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, tag)
      )
    `);

    // Coupons table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS coupons (
        id SERIAL PRIMARY KEY,
        code TEXT UNIQUE NOT NULL,
        type TEXT NOT NULL DEFAULT 'percentage',
        value INTEGER NOT NULL DEFAULT 0,
        min_spend INTEGER DEFAULT 0,
        max_uses INTEGER DEFAULT 1,
        used_count INTEGER DEFAULT 0,
        starts_at TIMESTAMP,
        expires_at TIMESTAMP,
        applicable_type TEXT DEFAULT 'all',
        applicable_ids TEXT DEFAULT '[]',
        active INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Flash sales / special prices table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS flash_sales (
        id SERIAL PRIMARY KEY,
        product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
        special_price INTEGER NOT NULL,
        original_price INTEGER NOT NULL,
        starts_at TIMESTAMP,
        ends_at TIMESTAMP,
        active INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Admin Users table (Phase 6)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS admin_users (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'staff',
        active INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_login TIMESTAMP
      )
    `);

    // Create default admin if not exists
    try {
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await pool.query(`
        INSERT INTO admin_users (username, email, password, role, active)
        VALUES ('admin', 'admin@ohya2.com', $1, 'admin', 1)
        ON CONFLICT (username) DO NOTHING
      `, [hashedPassword]);
    } catch (e) {
      console.log('Admin user might already exist');
    }

    // Create admin user in users table if not exists (for backward compatibility)
    try {
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await pool.query(`
        INSERT INTO users (email, password, name, is_admin)
        VALUES ('admin@ohya2.com', $1, 'Admin', 1)
        ON CONFLICT (email) DO NOTHING
      `, [hashedPassword]);
    } catch (e) {
      console.log('Admin might already exist');
    }

    console.log('Database initialized!');
    return true;
  } catch (e) {
    console.error('Database init error:', e.message);
    throw e;
  }
}

module.exports = { initDatabase, sql, pool };
