const fs = require('fs');
const path = require('path');
const { initDatabase, sql } = require('./database');

async function migrateProducts() {
  console.log('Starting migration...');
  
  // Read existing products
  const productsPath = path.join(__dirname, 'public', 'products.json');
  const productsData = JSON.parse(fs.readFileSync(productsPath, 'utf8'));
  
  console.log(`Found ${productsData.length} products in JSON`);
  
  // Check if products already exist in DB
  const existing = await sql`SELECT COUNT(*) as count FROM products`;
  console.log(`Products in DB: ${existing[0].count}`);
  
  if (existing[0].count > 0) {
    console.log('Products already exist in DB, skipping migration');
    return;
  }
  
  // Migrate each product
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
      // Skip duplicates or errors
    }
  }
  
  console.log(`Imported ${imported} products`);
}

async function migrateCustomers() {
  const customersPath = path.join(__dirname, 'public', 'customers.json');
  if (!fs.existsSync(customersPath)) return;
  
  const customersData = JSON.parse(fs.readFileSync(customersPath, 'utf8'));
  console.log(`Found ${customersData.length} customers in JSON`);
  
  const existing = await sql`SELECT COUNT(*) as count FROM users WHERE is_admin = 0`;
  if (existing[0].count > 0) {
    console.log('Customers already exist in DB, skipping');
    return;
  }
  
  const bcrypt = require('bcryptjs');
  for (const c of customersData) {
    try {
      const hashedPassword = await bcrypt.hash('password123', 10);
      await sql`
        INSERT INTO users (email, password, name, phone, is_admin)
        VALUES (${c.email || `customer${c.id}@test.com`}, ${hashedPassword}, ${c.name}, ${c.phone || ''}, 0)
      `;
    } catch (e) {
      // Skip
    }
  }
  console.log('Customers migration done');
}

async function migrateOrders() {
  const ordersPath = path.join(__dirname, 'public', 'orders.json');
  if (!fs.existsSync(ordersPath)) return;
  
  const ordersData = JSON.parse(fs.readFileSync(ordersPath, 'utf8'));
  console.log(`Found ${ordersData.length} orders in JSON`);
  
  const existing = await sql`SELECT COUNT(*) as count FROM orders`;
  if (existing[0].count > 0) {
    console.log('Orders already exist in DB, skipping');
    return;
  }
  
  for (const o of ordersData) {
    try {
      await sql`
        INSERT INTO orders (user_id, total, status, created_at)
        VALUES (${o.user_id || null}, ${o.total}, ${o.status || 'pending'}, ${o.created_at || new Date()})
      `;
    } catch (e) {
      // Skip
    }
  }
  console.log('Orders migration done');
}

async function main() {
  await initDatabase();
  await migrateProducts();
  await migrateCustomers();
  await migrateOrders();
  console.log('Migration complete!');
  process.exit(0);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
