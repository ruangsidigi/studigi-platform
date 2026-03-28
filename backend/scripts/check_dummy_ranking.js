require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');

(async () => {
  const db = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  try {
    const rows = await db.query(
      `SELECT participant_province, COUNT(*)::int AS cnt
       FROM tryout_sessions
       WHERE status = 'completed' AND package_id IN (16, 30)
       GROUP BY participant_province
       ORDER BY participant_province`
    );
    console.log(rows.rows);
  } finally {
    await db.end();
  }
})();
