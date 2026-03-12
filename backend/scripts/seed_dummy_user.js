// backend/scripts/seed_dummy_user.js
// Creates or updates a reviewer dummy user for login testing.
require('dotenv').config();
const bcrypt = require('bcrypt');
const { Pool } = require('pg');
const config = require('../shared/config');

const DEFAULT_EMAIL = 'dummy.reviewer@skdcpns.com';
const DEFAULT_PASSWORD = 'Dummy123!';
const DEFAULT_NAME = 'Akun Dummy Reviewer';

async function hasColumn(client, tableName, columnName) {
  const result = await client.query(
    `SELECT 1
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2
     LIMIT 1`,
    [tableName, columnName]
  );
  return Boolean(result.rows?.[0]);
}

async function run() {
  const email = (process.env.DUMMY_EMAIL || DEFAULT_EMAIL).trim().toLowerCase();
  const password = process.env.DUMMY_PASSWORD || DEFAULT_PASSWORD;
  const displayName = (process.env.DUMMY_NAME || DEFAULT_NAME).trim();

  if (String(password).length < 6) {
    throw new Error('DUMMY_PASSWORD minimal 6 karakter');
  }

  if (!config.dbUrl) {
    throw new Error('DB URL tidak ditemukan. Set DATABASE_URL atau DB_URL di env backend.');
  }

  const pool = new Pool({ connectionString: config.dbUrl });
  const client = await pool.connect();

  try {
    const hashedPassword = await bcrypt.hash(password, 12);
    const userInsertStrategies = [
      {
         text: `INSERT INTO users (email, password_hash, display_name, email_verified, email_verified_at, created_at)
           VALUES ($1, $2, $3, TRUE, NOW(), NOW())
               ON CONFLICT (email)
               DO UPDATE SET password_hash = EXCLUDED.password_hash,
                             display_name = EXCLUDED.display_name,
                             email_verified = TRUE,
               email_verified_at = NOW()
               RETURNING id, email`,
        values: [email, hashedPassword, displayName],
      },
      {
         text: `INSERT INTO users (email, password_hash, display_name, created_at)
           VALUES ($1, $2, $3, NOW())
               ON CONFLICT (email)
               DO UPDATE SET password_hash = EXCLUDED.password_hash,
               display_name = EXCLUDED.display_name
               RETURNING id, email`,
        values: [email, hashedPassword, displayName],
      },
      {
         text: `INSERT INTO users (email, password, name, role, created_at)
           VALUES ($1, $2, $3, 'user', NOW())
               ON CONFLICT (email)
               DO UPDATE SET password = EXCLUDED.password,
               name = EXCLUDED.name
               RETURNING id, email`,
        values: [email, hashedPassword, displayName],
      },
    ];

    let userId = null;
    let lastError = null;

    for (const strategy of userInsertStrategies) {
      try {
        const res = await client.query(strategy.text, strategy.values);
        userId = res.rows?.[0]?.id;
        if (userId) break;
      } catch (err) {
        lastError = err;
      }
    }

    if (!userId) {
      throw lastError || new Error('Gagal membuat user dummy');
    }

    const hasRoles = await hasColumn(client, 'user_roles', 'user_id').catch(() => false);
    if (hasRoles) {
      const roleRes = await client.query(`SELECT id FROM roles WHERE name = 'user' LIMIT 1`).catch(() => ({ rows: [] }));
      if (roleRes.rows?.[0]?.id) {
        await client.query(
          `INSERT INTO user_roles (user_id, role_id)
           VALUES ($1, $2)
           ON CONFLICT DO NOTHING`,
          [userId, roleRes.rows[0].id]
        );
      }
    }

    const hasEmailVerified = await hasColumn(client, 'users', 'email_verified');
    if (hasEmailVerified) {
      const hasEmailVerifiedAt = await hasColumn(client, 'users', 'email_verified_at');
      if (hasEmailVerifiedAt) {
        await client.query(
          `UPDATE users SET email_verified = TRUE, email_verified_at = COALESCE(email_verified_at, NOW()) WHERE id = $1`,
          [userId]
        );
      } else {
        await client.query(`UPDATE users SET email_verified = TRUE WHERE id = $1`, [userId]);
      }
    }

    console.log('Dummy user ready');
    console.log(`Email: ${email}`);
    console.log(`Password: ${password}`);
  } catch (err) {
    console.error('Failed to seed dummy user:', err.message || err);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

run();
