require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');

(async () => {
  const db = new Pool({
    connectionString: process.env.DATABASE_URL || process.env.PG_CONNECTION_STRING,
    ssl: { rejectUnauthorized: false },
  });

  try {
    const q1 = await db.query(
      `SELECT package_id, participant_name, participant_province, total_score, is_passed
       FROM tryout_sessions
       WHERE status = 'completed'
         AND user_id IN (SELECT id FROM users WHERE email LIKE 'dummy.ranking%@studigi.id')
       ORDER BY package_id, total_score DESC, participant_name ASC`
    );

    console.log('rows=', q1.rowCount);
    console.table(q1.rows);

    const q2 = await db.query(
      `SELECT is_passed, COUNT(*)::int AS cnt
       FROM tryout_sessions
       WHERE status = 'completed'
         AND user_id IN (SELECT id FROM users WHERE email LIKE 'dummy.ranking%@studigi.id')
       GROUP BY is_passed
       ORDER BY is_passed DESC`
    );
    console.log('pass_distribution=', q2.rows);
  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
  } finally {
    await db.end();
  }
})();
