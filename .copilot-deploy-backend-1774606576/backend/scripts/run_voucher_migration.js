// Run the voucher migration (027_add_vouchers.sql) against the production DB
require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function run() {
  const sql = fs.readFileSync(path.join(__dirname, '../db/migrations/027_add_vouchers.sql'), 'utf8');
  try {
    await pool.query(sql);
    console.log('Migration 027_add_vouchers applied successfully');
  } catch (err) {
    // Some statements may fail if objects exist – report and continue
    console.error('Migration error (may be safe to ignore if columns already exist):', err.message);
  } finally {
    await pool.end();
  }
}
run();
