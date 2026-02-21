// backend/scripts/seed_admin.js
// Creates an admin user from env vars ADMIN_EMAIL and ADMIN_PASSWORD
require('dotenv').config();
const bcrypt = require('bcrypt');
const config = require('../shared/config');
const { Pool } = require('pg');

async function run() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    console.error('Set ADMIN_EMAIL and ADMIN_PASSWORD in env to seed admin');
    process.exit(1);
  }
  const pool = new Pool({ connectionString: config.dbUrl });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const hash = await bcrypt.hash(password, 12);
    const userRes = await client.query(`INSERT INTO users (email, password_hash, display_name) VALUES ($1,$2,$3) ON CONFLICT (email) DO UPDATE SET password_hash=EXCLUDED.password_hash RETURNING id`, [email, hash, 'Admin']);
    const userId = userRes.rows[0].id;
    // find admin role id
    const roleRes = await client.query('SELECT id FROM roles WHERE name=$1 LIMIT 1', ['admin']);
    if (roleRes.rows[0]) {
      const roleId = roleRes.rows[0].id;
      await client.query('INSERT INTO user_roles (user_id, role_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [userId, roleId]);
    }
    await client.query('COMMIT');
    console.log('Admin seeded:', email);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
  } finally {
    client.release();
    process.exit(0);
  }
}

run();
