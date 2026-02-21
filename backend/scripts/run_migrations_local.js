// backend/scripts/run_migrations_local.js
// Simple migration runner: applies all .sql files in ../migrations in lexicographic order
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');
const DATABASE_URL = process.env.DATABASE_URL || process.env.PG_CONNECTION_STRING;
if (!DATABASE_URL) {
  console.error('Set DATABASE_URL or PG_CONNECTION_STRING env var');
  process.exit(1);
}

async function run() {
  const pool = new Pool({ connectionString: DATABASE_URL });
  const client = await pool.connect();
  try {
    const files = fs.readdirSync(MIGRATIONS_DIR).filter(f => f.endsWith('.sql')).sort();
    for (const f of files) {
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, f), 'utf8');
      console.log('Applying', f);
      await client.query(sql);
    }
    console.log('Migrations applied');
  } catch (err) {
    console.error('Migration error', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
