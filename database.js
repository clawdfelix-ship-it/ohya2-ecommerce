const { sql } = require('@vercel/postgres');
const bcrypt = require('bcryptjs');

async function initDatabase() {
  try {
    // Create tables if they don't exist
    await sql`
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
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        product_code TEXT UNIQUE,
        name TEXT NOT NULL,
        price INTEGER NOT NULL,
        description TEXT,
        barcode TEXT,
        category TEXT,
        stock INTEGER DEFAULT 0,
        active INTEGER DEFAULT 1,
        image_url TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        total INTEGER NOT NULL,
        status TEXT DEFAULT 'pending',
        bank_transfer_proof TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS order_items (
        id SERIAL PRIMARY KEY,
        order_id INTEGER REFERENCES orders(id),
        product_id INTEGER REFERENCES products(id),
        quantity INTEGER NOT NULL,
        price INTEGER NOT NULL
      )
    `;

    // Create admin user if not exists
    try {
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await sql`
        INSERT INTO users (email, password, name, is_admin)
        VALUES ('admin@ohya2.com', ${hashedPassword}, 'Admin', 1)
        ON CONFLICT (email) DO NOTHING
      `;
    } catch (e) {
      console.log('Admin might already exist:', e.message);
    }

    console.log('Database initialized!');
    return true;
  } catch (e) {
    console.error('Database init error:', e.message);
    throw e;
  }
}

module.exports = { initDatabase, sql };
