require('dotenv').config();
const { Pool } = require('pg');
const config = require('../shared/config');

async function run() {
  if (!config.dbUrl) throw new Error('DATABASE_URL / DB_URL belum tersedia.');

  const pool = new Pool({ connectionString: config.dbUrl });
  try {
    const result = await pool.query(
      `SELECT p.id, p.name, COUNT(q.id)::int AS question_count
       FROM packages p
       JOIN questions q ON q.package_id = p.id
       GROUP BY p.id, p.name
       ORDER BY p.id ASC
       LIMIT 20`
    );
    console.log(JSON.stringify(result.rows || [], null, 2));
  } finally {
    await pool.end();
  }
}

run().catch((error) => {
  console.error(error && error.stack ? error.stack : String(error));
  process.exitCode = 1;
});