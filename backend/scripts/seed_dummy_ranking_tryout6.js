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
const TARGET_TOTAL_PARTICIPANTS = 23;

const provinces = [
  'Aceh',
  'Sumatera Utara',
  'Sumatera Barat',
  'Riau',
  'Kepulauan Riau',
  'Jambi',
  'Bengkulu',
  'Sumatera Selatan',
  'Lampung',
  'Banten',
  'DKI Jakarta',
  'Jawa Barat',
  'Jawa Tengah',
  'DI Yogyakarta',
  'Jawa Timur',
  'Bali',
  'Nusa Tenggara Barat',
  'Nusa Tenggara Timur',
  'Kalimantan Barat',
  'Kalimantan Tengah',
  'Kalimantan Selatan',
  'Kalimantan Timur',
  'Sulawesi Selatan',
];

const firstNames = [
  'Aksa', 'Alena', 'Alif', 'Amel', 'Arka', 'Aurel', 'Ayin', 'Bagas', 'Bara', 'Bima',
  'Calya', 'Candra', 'Cila', 'Dafa', 'Damar', 'Davin', 'Dian', 'Dira', 'Elga', 'Elsa',
  'Fano', 'Farrel', 'Felix', 'Fina', 'Gala', 'Gavin', 'Gio', 'Hana', 'Hanif', 'Iqis',
  'Jano', 'Jihan', 'Jordi', 'Kai', 'Keila', 'Kian', 'Lala', 'Laras', 'Lio', 'Madin',
  'Maira', 'Miko', 'Mila', 'Nadhif', 'Nael', 'Nala', 'Naufal', 'Naya', 'Niko', 'Oji',
];

const secondNames = [
  'Agustin', 'Aldebar', 'Alfian', 'Anjani', 'Ardana', 'Azzam', 'Baskara', 'Bella', 'Cakra',
  'Danis', 'Dirgantara', 'Fadila', 'Faiz', 'Fikri', 'Firda', 'Gabriela', 'Hakim', 'Irawan',
  'Jelita', 'Kirana', 'Kusuma', 'Lazuardi', 'Mahendra', 'Maulani', 'Nirwana', 'Nur',
  'Pangestu', 'Permata', 'Pradana', 'Prakoso', 'Pratama', 'Putri', 'Ramadhan', 'Ranggana',
  'Saputra', 'Sari', 'Setiawan', 'Syahputra', 'Wicaksono', 'Wulandari', 'Yunita',
];

function createParticipant(index) {
  const first = firstNames[index % firstNames.length];
  const second = secondNames[(index * 5 + 7) % secondNames.length];
  const useSecondName = index % 4 !== 0;
  const name = useSecondName ? `${first} ${second}` : first;

  const twk = 68 + ((index * 3) % 12);
  const tiu = 92 + ((index * 4) % 18);
  const tkp = 194 + ((index * 5) % 20);
  const total = Math.min(410, twk + tiu + tkp);

  return {
    name,
    province: provinces[(index * 3) % provinces.length],
    email: `dummy.ranking${index + 1}@studigi.id`,
    twk,
    tiu,
    tkp,
    total,
  };
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
    const packageResult = await client.query(
      `SELECT id, name
       FROM packages
       WHERE LOWER(name) LIKE '%tryout 6%'
       ORDER BY id ASC
       LIMIT 1`
    );

    if (!packageResult.rows[0]) {
      throw new Error('Paket Tryout 6 tidak ditemukan.');
    }

    const packageId = Number(packageResult.rows[0].id);
    const packageName = packageResult.rows[0].name;

    await client.query('BEGIN');

    const realCountResult = await client.query(
      `SELECT COUNT(*)::int AS cnt
       FROM tryout_sessions ts
       JOIN users u ON u.id = ts.user_id
       WHERE ts.package_id = $1
         AND ts.status = 'completed'
         AND u.email NOT LIKE 'dummy.ranking%@studigi.id'`,
      [packageId]
    );
    const realCount = Number(realCountResult.rows[0]?.cnt || 0);
    const targetDummyCount = Math.max(0, TARGET_TOTAL_PARTICIPANTS - realCount);

    await client.query(
      `DELETE FROM tryout_answers
       WHERE session_id IN (
         SELECT ts.id
         FROM tryout_sessions ts
         JOIN users u ON u.id = ts.user_id
         WHERE ts.package_id = $1
           AND ts.status = 'completed'
           AND u.email LIKE 'dummy.ranking%@studigi.id'
       )`,
      [packageId]
    );

    await client.query(
      `DELETE FROM tryout_sessions
       WHERE id IN (
         SELECT ts.id
         FROM tryout_sessions ts
         JOIN users u ON u.id = ts.user_id
         WHERE ts.package_id = $1
           AND ts.status = 'completed'
           AND u.email LIKE 'dummy.ranking%@studigi.id'
       )`,
      [packageId]
    );

    for (let i = 0; i < targetDummyCount; i += 1) {
      const p = createParticipant(i);
      const userId = await upsertUser(client, p);
      const startOffsetMinutes = 360 - i * 9;
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
           $1, $2, $3, $4,
           NOW() - (($5 || ' minutes')::interval),
           NOW() - (($6 || ' minutes')::interval),
           'completed',
           $7, $8, $9, $10,
           TRUE,
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
        ]
      );
    }

    await client.query('COMMIT');

    const totalResult = await client.query(
      `SELECT COUNT(*)::int AS cnt
       FROM tryout_sessions
       WHERE package_id = $1
         AND status = 'completed'`,
      [packageId]
    );

    console.log('Target package:', `${packageId} - ${packageName}`);
    console.log('Real participants:', realCount);
    console.log('Dummy inserted:', targetDummyCount);
    console.log('Total completed participants:', Number(totalResult.rows[0]?.cnt || 0));
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Seed Tryout 6 dummy ranking failed:', error.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
