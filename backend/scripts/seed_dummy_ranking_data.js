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
const TARGET_PARTICIPANT_COUNT = 100;
const TARGET_PASS_COUNT = 40;

const provinces = [
  'Aceh',
  'Sumatera Utara',
  'Sumatera Barat',
  'Riau',
  'Kepulauan Riau',
  'Jambi',
  'Bengkulu',
  'Sumatera Selatan',
  'Kepulauan Bangka Belitung',
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
  'Kalimantan Utara',
  'Sulawesi Utara',
  'Sulawesi Tengah',
  'Sulawesi Selatan',
  'Sulawesi Tenggara',
  'Gorontalo',
  'Sulawesi Barat',
  'Maluku',
  'Maluku Utara',
  'Papua Barat',
  'Papua',
];

const firstNames = [
  'Aksa', 'Alena', 'Alif', 'Amel', 'Arka', 'Aurel', 'Ayin', 'Bagas', 'Bara', 'Bima',
  'Calya', 'Candra', 'Cila', 'Dafa', 'Damar', 'Davin', 'Dian', 'Dira', 'Elga', 'Elsa',
  'Fano', 'Farrel', 'Felix', 'Fina', 'Gala', 'Gavin', 'Gio', 'Hana', 'Hanif', 'Iqis',
  'Jano', 'Jihan', 'Jordi', 'Kai', 'Keila', 'Kian', 'Lala', 'Laras', 'Lio', 'Madin',
  'Maira', 'Miko', 'Mila', 'Nadhif', 'Nael', 'Nala', 'Naufal', 'Naya', 'Niko', 'Oji',
  'Putra', 'Qila', 'Rafi', 'Raisa', 'Raka', 'Rara', 'Rasya', 'Rei', 'Reno', 'Rian',
  'Risa', 'Rizal', 'Safa', 'Salma', 'Satria', 'Sava', 'Seno', 'Sisi', 'Tama', 'Tara',
  'Tegar', 'Tio', 'Vano', 'Vina', 'Wafi', 'Wira', 'Yaya', 'Yoga', 'Yori', 'Zaki',
];

const secondNames = [
  'Aditya', 'Agustin', 'Aldebar', 'Alfian', 'Anjani', 'Ardana', 'Azzam', 'Baskara', 'Bella', 'Cakra',
  'Danis', 'Dirgantara', 'Fadila', 'Faiz', 'Fikri', 'Firda', 'Gabriela', 'Hakim', 'Irawan', 'Jelita',
  'Kirana', 'Kusuma', 'Lazuardi', 'Mahendra', 'Maulani', 'Nirwana', 'Nur', 'Pangestu', 'Permata', 'Pradana',
  'Prakoso', 'Pratama', 'Putri', 'Ramadhan', 'Ranggana', 'Saputra', 'Sari', 'Setiawan', 'Syahputra', 'Wicaksono',
  'Wulandari', 'Yunita',
];

function createScores(index) {
  const isPass = index < TARGET_PASS_COUNT;

  let twk;
  let tiu;
  let tkp;

  if (isPass) {
    twk = 69 + ((index * 2) % 12);
    tiu = 90 + ((index * 4) % 22);
    tkp = 191 + ((index * 5) % 30);
  } else {
    twk = 56 + ((index * 3) % 12);
    tiu = 74 + ((index * 4) % 18);
    tkp = 145 + ((index * 5) % 30);
  }

  // Keep score realistic and avoid any perfect/full score patterns.
  const total = Math.min(410, twk + tiu + tkp);
  return { twk, tiu, tkp, total, isPass: total >= 350 };
}

function buildDummyParticipants(count) {
  const participants = [];

  for (let i = 0; i < count; i += 1) {
    const first = firstNames[i % firstNames.length];
    const second = secondNames[Math.floor(i / firstNames.length) % secondNames.length];
    const useSecondName = i >= firstNames.length || i % 3 !== 0;
    const name = useSecondName ? `${first} ${second}` : first;

    const scores = createScores(i);

    participants.push({
      name,
      province: provinces[(i * 7) % provinces.length],
      email: `dummy.ranking${i + 1}@studigi.id`,
      packageSlot: i % 2,
      twk: scores.twk,
      tiu: scores.tiu,
      tkp: scores.tkp,
      total: scores.total,
      isPass: scores.isPass,
    });
  }

  return participants;
}

const dummyParticipants = buildDummyParticipants(TARGET_PARTICIPANT_COUNT);

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
          p.isPass,
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
