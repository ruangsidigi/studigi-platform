require('dotenv').config();
const { Pool } = require('pg');
const config = require('../shared/config');

const RUN_ID = String(process.env.LOAD_TEST_RUN_ID || 'prod100').trim();
const PACKAGE_ID = Number(process.env.LOAD_TEST_PACKAGE_ID || 0);
const EMAIL_DOMAIN = process.env.LOAD_TEST_EMAIL_DOMAIN || 'example.com';

async function run() {
  if (!config.dbUrl) throw new Error('DATABASE_URL / DB_URL belum tersedia.');
  if (!Number.isInteger(PACKAGE_ID) || PACKAGE_ID <= 0) {
    throw new Error('LOAD_TEST_PACKAGE_ID wajib diisi dengan package id yang valid.');
  }

  const pool = new Pool({ connectionString: config.dbUrl });
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const userResult = await client.query(
      `SELECT id, email
       FROM users
       WHERE email LIKE $1
       ORDER BY email ASC`,
      [`loadtest.${RUN_ID}.%@${EMAIL_DOMAIN}`]
    );

    const packageResult = await client.query('SELECT id, price, name FROM packages WHERE id = $1 LIMIT 1', [PACKAGE_ID]);
    const pkg = packageResult.rows?.[0];
    if (!pkg) throw new Error(`Package ${PACKAGE_ID} tidak ditemukan.`);

    for (const row of userResult.rows || []) {
      await client.query(
        `INSERT INTO purchases (user_id, package_id, total_price, payment_status, created_at)
         VALUES ($1, $2, $3, 'completed', NOW())`,
        [row.id, PACKAGE_ID, Number(pkg.price || 0)]
      );
    }

    await client.query('COMMIT');
    console.log(JSON.stringify({
      packageId: PACKAGE_ID,
      packageName: pkg.name,
      seededUsers: userResult.rows?.length || 0,
    }, null, 2));
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((error) => {
  console.error(error && error.stack ? error.stack : String(error));
  process.exitCode = 1;
});