const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = path.join(__dirname, 'data', 'ohya.db');
let db = null;

async function initDatabase() {
  const SQL = await initSqlJs();
  
  // Load existing database or create new one
  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  // Initialize tables
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      phone TEXT,
      address TEXT,
      is_admin INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_code TEXT UNIQUE,
      name TEXT NOT NULL,
      description TEXT,
      price REAL NOT NULL,
      barcode TEXT,
      category TEXT,
      image TEXT,
      stock INTEGER DEFAULT 0,
      active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Add columns if they don't exist (for existing databases)
  try {
    db.run("ALTER TABLE products ADD COLUMN product_code TEXT");
  } catch (e) {
    // Column already exists
  }
  try {
    db.run("ALTER TABLE products ADD COLUMN barcode TEXT");
  } catch (e) {
    // Column already exists
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      order_number TEXT UNIQUE NOT NULL,
      total REAL NOT NULL,
      status TEXT DEFAULT 'pending',
      bank_proof TEXT,
      shipping_name TEXT,
      shipping_phone TEXT,
      shipping_address TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      product_name TEXT NOT NULL,
      price REAL NOT NULL,
      quantity INTEGER NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id),
      FOREIGN KEY (product_id) REFERENCES products(id)
    )
  `);

  // Create default admin user if not exists
  const adminExists = db.exec("SELECT id FROM users WHERE email = 'admin@ohya2.com'");
  if (adminExists.length === 0 || adminExists[0].values.length === 0) {
    const hashedPassword = bcrypt.hashSync('admin123', 10);
    db.run(
      'INSERT INTO users (email, password, name, is_admin) VALUES (?, ?, ?, ?)',
      ['admin@ohya2.com', hashedPassword, 'Administrator', 1]
    );
    console.log('Default admin created: admin@ohya2.com / admin123');
  }

  // Check if products exist
  const productCount = db.exec('SELECT COUNT(*) as count FROM products');
  if (productCount.length === 0 || productCount[0].values[0][0] === 0) {
    seedProducts();
  }

  saveDatabase();
  console.log('Database initialized successfully');
  
  return db;
}

function saveDatabase() {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  
  // Ensure data directory exists
  const dataDir = path.join(__dirname, 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  
  fs.writeFileSync(dbPath, buffer);
}

function seedProducts() {
  const sampleProducts = [
    {
      name: 'Premium Vibrator',
      description: 'High-quality premium vibrator with multiple settings',
      price: 599,
      category: 'Vibrators',
      image: '/uploads/products/vibrator1.jpg',
      stock: 50
    },
    {
      name: 'Couples Massage Set',
      description: 'Luxurious couples massage oil set with warming effects',
      price: 399,
      category: 'Massage',
      image: '/uploads/products/massage1.jpg',
      stock: 30
    },
    {
      name: 'Lingerie Collection',
      description: 'Elegant lace lingerie set - Black',
      price: 299,
      category: 'Lingerie',
      image: '/uploads/products/lingerie1.jpg',
      stock: 25
    },
    {
      name: '成人玩具套裝',
      description: '全套入門級成人玩具套裝，適合新手使用',
      price: 888,
      category: '套裝',
      image: '/uploads/products/kit1.jpg',
      stock: 20
    },
    {
      name: 'Premium潤滑劑',
      description: '日本進口優質潤滑劑，水性配方不過敏',
      price: 158,
      category: '輔助用品',
      image: '/uploads/products/lube1.jpg',
      stock: 100
    },
    {
      name: '情趣內衣-紅色',
      description: '誘人紅色情趣內衣，蕾絲設計',
      price: 358,
      category: 'Lingerie',
      image: '/uploads/products/lingerie2.jpg',
      stock: 15
    }
  ];

  for (const product of sampleProducts) {
    db.run(
      'INSERT INTO products (name, description, price, category, image, stock) VALUES (?, ?, ?, ?, ?, ?)',
      [product.name, product.description, product.price, product.category, product.image, product.stock]
    );
  }
  console.log('Sample products seeded');
}

// Helper functions to match better-sqlite3 API style
function getDb() {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

const dbWrapper = {
  prepare: (sql) => ({
    get: (...params) => {
      const stmt = getDb().prepare(sql);
      stmt.bind(params);
      if (stmt.step()) {
        const row = stmt.getAsObject();
        stmt.free();
        return row;
      }
      stmt.free();
      return undefined;
    },
    all: (...params) => {
      const results = [];
      const stmt = getDb().prepare(sql);
      stmt.bind(params);
      while (stmt.step()) {
        results.push(stmt.getAsObject());
      }
      stmt.free();
      return results;
    },
    run: (...params) => {
      getDb().run(sql, params);
      saveDatabase();
      return { lastInsertRowid: getDb().exec('SELECT last_insert_rowid()')[0].values[0][0] };
    }
  }),
  exec: (sql) => {
    getDb().run(sql);
    saveDatabase();
  },
  save: saveDatabase
};

module.exports = { db: dbWrapper, initDatabase };
