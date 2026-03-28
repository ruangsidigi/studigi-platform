require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL || process.env.PG_CONNECTION_STRING;
if (!DATABASE_URL) {
  console.error('DATABASE_URL is missing');
  process.exit(1);
}

const profiles = [
  { email: 'dummy.ranking1@studigi.id', twk: 126, tiu: 165, tkp: 224, total: 515 },
  { email: 'dummy.ranking2@studigi.id', twk: 122, tiu: 160, tkp: 218, total: 500 },
  { email: 'dummy.ranking3@studigi.id', twk: 118, tiu: 154, tkp: 213, total: 485 },
  { email: 'dummy.ranking4@studigi.id', twk: 123, tiu: 162, tkp: 220, total: 505 },
  { email: 'dummy.ranking5@studigi.id', twk: 119, tiu: 156, tkp: 210, total: 485 },
  { email: 'dummy.ranking6@studigi.id', twk: 112, tiu: 148, tkp: 205, total: 465 },
  { email: 'dummy.ranking7@studigi.id', twk: 127, tiu: 166, tkp: 222, total: 515 },
  { email: 'dummy.ranking8@studigi.id', twk: 121, tiu: 161, tkp: 218, total: 500 },
  { email: 'dummy.ranking9@studigi.id', twk: 117, tiu: 155, tkp: 213, total: 485 },
  { email: 'dummy.ranking10@studigi.id', twk: 111, tiu: 147, tkp: 202, total: 460 },
];

(async () => {
  const db = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  try {
    await db.query('BEGIN');

    for (const p of profiles) {
      const userRow = await db.query('SELECT id FROM users WHERE email = $1 LIMIT 1', [p.email]);
      if (!userRow.rows[0]) continue;
      const userId = Number(userRow.rows[0].id);

      const isPassed = p.twk > 65 && p.tiu > 85 && p.tkp > 166;
      await db.query(
        `UPDATE tryout_sessions
         SET twk_score = $1,
             tiu_score = $2,
             tkp_score = $3,
             total_score = $4,
             is_passed = $5
         WHERE user_id = $6
           AND status = 'completed'
           AND participant_name IS NOT NULL`,
        [p.twk, p.tiu, p.tkp, p.total, isPassed, userId]
      );
    }

    await db.query('COMMIT');

    const summary = await db.query(
      `SELECT package_id, participant_name, participant_province, total_score, is_passed
       FROM tryout_sessions
       WHERE status = 'completed' AND participant_name IS NOT NULL AND user_id IN (
         SELECT id FROM users WHERE email LIKE 'dummy.ranking%@studigi.id'
       )
       ORDER BY package_id, total_score DESC, participant_name ASC`
    );

    console.log('Updated dummy sessions:', summary.rowCount || 0);
    console.log(summary.rows);
  } catch (err) {
    await db.query('ROLLBACK');
    console.error('Tune failed:', err.message);
    process.exitCode = 1;
  } finally {
    await db.end();
  }
})();
