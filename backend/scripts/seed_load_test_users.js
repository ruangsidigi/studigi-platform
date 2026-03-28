require('dotenv').config();
const bcrypt = require('bcrypt');
const { Pool } = require('pg');
const config = require('../shared/config');

const TOTAL_USERS = Math.max(1, Number(process.env.LOAD_TEST_USERS || 100));
const RUN_ID = String(process.env.LOAD_TEST_RUN_ID || 'prod100').trim();
const PASSWORD = process.env.LOAD_TEST_PASSWORD || 'LoadTest123!';
const NAME_PREFIX = process.env.LOAD_TEST_NAME_PREFIX || 'Load Test User';
const EMAIL_DOMAIN = process.env.LOAD_TEST_EMAIL_DOMAIN || 'example.com';

const hasColumn = async (client, tableName, columnName) => {
  const result = await client.query(
    `SELECT 1
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2
     LIMIT 1`,
    [tableName, columnName]
  );
  return Boolean(result.rows?.[0]);
};

const buildIdentity = (index) => {
  const sequence = String(index + 1).padStart(3, '0');
  return {
    email: `loadtest.${RUN_ID}.${sequence}@${EMAIL_DOMAIN}`.toLowerCase(),
    name: `${NAME_PREFIX} ${sequence}`,
  };
};

async function upsertUser(client, hashedPassword, identity, canUseVerifiedColumns) {
  const strategies = [
    {
      text: canUseVerifiedColumns
        ? `INSERT INTO users (email, password_hash, display_name, email_verified, email_verified_at, created_at)
           VALUES ($1, $2, $3, TRUE, NOW(), NOW())
           ON CONFLICT (email)
           DO UPDATE SET password_hash = EXCLUDED.password_hash,
                         display_name = EXCLUDED.display_name,
                         email_verified = TRUE,
                         email_verified_at = NOW()
           RETURNING id, email`
        : `INSERT INTO users (email, password_hash, display_name, created_at)
           VALUES ($1, $2, $3, NOW())
           ON CONFLICT (email)
           DO UPDATE SET password_hash = EXCLUDED.password_hash,
                         display_name = EXCLUDED.display_name
           RETURNING id, email`,
      values: [identity.email, hashedPassword, identity.name],
    },
    {
      text: `INSERT INTO users (email, password, name, role, created_at)
             VALUES ($1, $2, $3, 'user', NOW())
             ON CONFLICT (email)
             DO UPDATE SET password = EXCLUDED.password,
                           name = EXCLUDED.name
             RETURNING id, email`,
      values: [identity.email, hashedPassword, identity.name],
    },
  ];

  let lastError = null;
  for (const strategy of strategies) {
    try {
      const result = await client.query(strategy.text, strategy.values);
      return result.rows?.[0] || null;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error(`Gagal membuat user ${identity.email}`);
}

async function run() {
  if (!config.dbUrl) throw new Error('DATABASE_URL / DB_URL belum tersedia.');

  const pool = new Pool({ connectionString: config.dbUrl });
  const client = await pool.connect();

  try {
    const hashedPassword = await bcrypt.hash(PASSWORD, 12);
    const canUseVerifiedColumns = await hasColumn(client, 'users', 'email_verified').catch(() => false);
    const hasEmailVerifiedAt = canUseVerifiedColumns
      ? await hasColumn(client, 'users', 'email_verified_at').catch(() => false)
      : false;
    const hasUserRoles = await hasColumn(client, 'user_roles', 'user_id').catch(() => false);
    const roleRes = hasUserRoles
      ? await client.query(`SELECT id FROM roles WHERE name = 'user' LIMIT 1`).catch(() => ({ rows: [] }))
      : { rows: [] };
    const roleId = roleRes.rows?.[0]?.id || null;

    const created = [];
    for (let index = 0; index < TOTAL_USERS; index += 1) {
      const identity = buildIdentity(index);
      const userRow = await upsertUser(client, hashedPassword, identity, canUseVerifiedColumns);

      if (canUseVerifiedColumns) {
        if (hasEmailVerifiedAt) {
          await client.query(
            `UPDATE users
             SET email_verified = TRUE,
                 email_verified_at = COALESCE(email_verified_at, NOW())
             WHERE id = $1`,
            [userRow.id]
          );
        } else {
          await client.query(`UPDATE users SET email_verified = TRUE WHERE id = $1`, [userRow.id]);
        }
      }

      if (hasUserRoles && roleId) {
        await client.query(
          `INSERT INTO user_roles (user_id, role_id)
           VALUES ($1, $2)
           ON CONFLICT DO NOTHING`,
          [userRow.id, roleId]
        ).catch(() => {});
      }

      created.push(identity.email);
    }

    console.log(JSON.stringify({
      totalUsers: TOTAL_USERS,
      runId: RUN_ID,
      password: PASSWORD,
      firstUser: created[0],
      lastUser: created[created.length - 1],
    }, null, 2));
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((error) => {
  console.error(error && error.stack ? error.stack : String(error));
  process.exitCode = 1;
});