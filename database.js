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

    // Create admin user if not exists
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
