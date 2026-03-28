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

const DUMMY_PASSWORD_HASH = '$2a$10$UgXqNqJ7qZ3EWU8r0aJ5P.YX2W.wjYXGdnF6H6LQq6kH1K8W5pMWC';

const dummyParticipants = [
  { name: 'Budi Santoso', province: 'Lampung', email: 'dummy.ranking1@studigi.id', packageSlot: 0, total: 540, twk: 130, tiu: 170, tkp: 240 },
  { name: 'Siti Aisyah', province: 'Lampung', email: 'dummy.ranking2@studigi.id', packageSlot: 0, total: 515, twk: 125, tiu: 165, tkp: 225 },
  { name: 'Andi Pratama', province: 'Lampung', email: 'dummy.ranking3@studigi.id', packageSlot: 1, total: 498, twk: 118, tiu: 160, tkp: 220 },

  { name: 'Rina Wulandari', province: 'Sumatera Selatan', email: 'dummy.ranking4@studigi.id', packageSlot: 0, total: 522, twk: 126, tiu: 168, tkp: 228 },
  { name: 'Dedi Kurniawan', province: 'Sumatera Selatan', email: 'dummy.ranking5@studigi.id', packageSlot: 1, total: 505, twk: 122, tiu: 164, tkp: 219 },
  { name: 'Nabila Putri', province: 'Sumatera Selatan', email: 'dummy.ranking6@studigi.id', packageSlot: 1, total: 486, twk: 115, tiu: 156, tkp: 215 },

  { name: 'Fajar Ramadhan', province: 'Jawa Barat', email: 'dummy.ranking7@studigi.id', packageSlot: 0, total: 532, twk: 128, tiu: 169, tkp: 235 },
  { name: 'Intan Permata', province: 'Jawa Barat', email: 'dummy.ranking8@studigi.id', packageSlot: 1, total: 512, twk: 124, tiu: 163, tkp: 225 },
  { name: 'Rizky Maulana', province: 'Jawa Barat', email: 'dummy.ranking9@studigi.id', packageSlot: 0, total: 503, twk: 120, tiu: 162, tkp: 221 },
  { name: 'Dewi Lestari', province: 'Jawa Barat', email: 'dummy.ranking10@studigi.id', packageSlot: 1, total: 495, twk: 117, tiu: 159, tkp: 219 },
];

async function getTargetPackageIds(client) {
  const preferred = await client.query(
    `SELECT id, name
     FROM packages
     WHERE name IN ('Tryout SKD CPNS 1', 'Tryout SKD CPNS 2')
     ORDER BY CASE name WHEN 'Tryout SKD CPNS 1' THEN 1 WHEN 'Tryout SKD CPNS 2' THEN 2 ELSE 3 END`
  );

  if (preferred.rows.length >= 2) {
    return preferred.rows.map((r) => Number(r.id));
  }

  const fallback = await client.query(
    `SELECT id
     FROM packages
     WHERE LOWER(COALESCE(type, '')) IN ('tryout', 'latihan')
     ORDER BY id ASC
     LIMIT 2`
  );

  const ids = fallback.rows.map((r) => Number(r.id));
  if (ids.length < 2) {
    throw new Error('Tidak ditemukan minimal 2 paket untuk dummy ranking.');
  }
  return ids;
}

async function upsertUser(client, participant) {
  const result = await client.query(
    `INSERT INTO users (email, password, name, role)
     VALUES ($1, $2, $3, 'user')
     ON CONFLICT (email)
     DO UPDATE SET name = EXCLUDED.name
     RETURNING id`,
    [participant.email, DUMMY_PASSWORD_HASH, participant.name]
  );
  return Number(result.rows[0].id);
}

async function main() {
  const client = await pool.connect();
  try {
    const packageIds = await getTargetPackageIds(client);
    console.log('Target package IDs:', packageIds.join(', '));

    await client.query('BEGIN');

    await client.query(
      `DELETE FROM tryout_answers
       WHERE session_id IN (
         SELECT id FROM tryout_sessions
         WHERE package_id = ANY($1::bigint[]) AND status = 'completed'
       )`,
      [packageIds]
    );

    const deletedSessions = await client.query(
      `DELETE FROM tryout_sessions
       WHERE package_id = ANY($1::bigint[]) AND status = 'completed'`,
      [packageIds]
    );

    console.log('Deleted completed sessions:', deletedSessions.rowCount || 0);

    for (let i = 0; i < dummyParticipants.length; i += 1) {
      const p = dummyParticipants[i];
      const userId = await upsertUser(client, p);
      const packageId = packageIds[p.packageSlot % packageIds.length];
      const startOffsetMinutes = 180 - i * 7;
      const finishOffsetMinutes = startOffsetMinutes - 95;

      await client.query(
        `INSERT INTO tryout_sessions (
           user_id,
           package_id,
           participant_name,
           participant_province,
           started_at,
           finished_at,
           status,
           twk_score,
           tiu_score,
           tkp_score,
           total_score,
           is_passed,
           created_at
         ) VALUES (
           $1,
           $2,
           $3,
           $4,
           NOW() - (($5 || ' minutes')::interval),
           NOW() - (($6 || ' minutes')::interval),
           'completed',
           $7,
           $8,
           $9,
           $10,
           $11,
           NOW() - (($5 || ' minutes')::interval)
         )`,
        [
          userId,
          packageId,
          p.name,
          p.province,
          startOffsetMinutes,
          finishOffsetMinutes,
          p.twk,
          p.tiu,
          p.tkp,
          p.total,
          p.total >= 350,
        ]
      );
    }

    await client.query('COMMIT');
    console.log('Dummy ranking data inserted:', dummyParticipants.length);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Seed failed:', error.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
