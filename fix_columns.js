const { initDatabase, sql } = require('./database');

async function fixColumns() {
  await initDatabase();
  
  // Add missing columns
  const columns = [
    'jan_code TEXT',
    'price_jpy INTEGER DEFAULT 0',
    'seo_title TEXT',
    'seo_description TEXT',
    'seo_keywords TEXT'
  ];
  
  for (const col of columns) {
    const colName = col.split(' ')[0];
    try {
      await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS ${sql(colName)} ${sql(col.split(' ').slice(1).join(' '))}`;
      console.log(`Added column: ${colName}`);
    } catch(e) {
      console.log(`Column ${colName}: ${e.message}`);
    }
  }
  
  console.log('Done!');
  process.exit(0);
}

fixColumns().catch(e => {
  console.error(e);
  process.exit(1);
});
