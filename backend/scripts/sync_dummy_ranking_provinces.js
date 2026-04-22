require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL || process.env.PG_CONNECTION_STRING;
if (!DATABASE_URL) {
  console.error('DATABASE_URL is missing');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// 23-slot cycle: Jakarta dominant, but still keeps other Java/Sumatra provinces visible.
const PROVINCE_CYCLE = [
  'DKI Jakarta', 'Jawa Barat', 'DKI Jakarta', 'Lampung', 'DKI Jakarta',
  'Sumatera Selatan', 'Jawa Tengah', 'DKI Jakarta', 'Jawa Barat', 'DKI Jakarta',
  'Jawa Timur', 'DKI Jakarta', 'Lampung', 'DKI Jakarta', 'Sumatera Selatan',
  'Jawa Barat', 'DKI Jakarta', 'Jawa Tengah', 'DKI Jakarta', 'Sumatera Selatan',
  'Jawa Barat', 'DKI Jakarta', 'Lampung',
];

function getDummyIndex(email) {
  const match = String(email || '').match(/dummy\.ranking(\d+)@/i);
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
}

async function main() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const usersResult = await client.query(
      `SELECT id, email, COALESCE(NULLIF(name, ''), SPLIT_PART(email, '@', 1)) AS name
       FROM users
       WHERE email LIKE 'dummy.ranking%@studigi.id'`
    );

    const users = (usersResult.rows || [])
      .map((row) => ({
        id: Number(row.id),
        email: String(row.email || '').trim(),
        name: String(row.name || '').trim(),
      }))
      .sort((a, b) => getDummyIndex(a.email) - getDummyIndex(b.email));

    if (users.length === 0) {
      throw new Error('Tidak ada user dummy.ranking yang ditemukan.');
    }

    for (let i = 0; i < users.length; i += 1) {
      const user = users[i];
      const province = PROVINCE_CYCLE[i % PROVINCE_CYCLE.length];

      await client.query(
        `UPDATE tryout_sessions ts
         SET participant_name = $2,
             participant_province = $3
         WHERE ts.user_id = $1
           AND ts.status = 'completed'`,
        [user.id, user.name, province]
      );
    }

    const conflictResult = await client.query(
      `SELECT participant_name, COUNT(DISTINCT COALESCE(participant_province, '-')) AS province_count
       FROM tryout_sessions ts
       JOIN users u ON u.id = ts.user_id
       WHERE u.email LIKE 'dummy.ranking%@studigi.id'
         AND ts.status = 'completed'
       GROUP BY participant_name
       HAVING COUNT(DISTINCT COALESCE(participant_province, '-')) > 1
       ORDER BY participant_name ASC`
    );

    const distributionResult = await client.query(
      `SELECT COALESCE(participant_province, '-') AS province, COUNT(*)::int AS total
       FROM tryout_sessions ts
       JOIN users u ON u.id = ts.user_id
       WHERE u.email LIKE 'dummy.ranking%@studigi.id'
         AND ts.status = 'completed'
       GROUP BY COALESCE(participant_province, '-')
       ORDER BY total DESC, province ASC`
    );

    await client.query('COMMIT');

    console.log('Dummy users synced:', users.length);
    console.log('Name-province conflicts:', conflictResult.rowCount || 0);
    console.log('Distribution (completed sessions):');
    for (const row of distributionResult.rows || []) {
      console.log(`- ${row.province}: ${row.total}`);
    }
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Sync failed:', error.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
