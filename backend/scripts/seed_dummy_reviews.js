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

const REVIEWERS = [
  { email: 'dummy.ranking1@studigi.id', displayName: 'Naufal Pratama' },
  { email: 'dummy.ranking2@studigi.id', displayName: 'Alya Rahma' },
  { email: 'dummy.ranking3@studigi.id', displayName: 'Rafi Akbar' },
  { email: 'dummy.ranking4@studigi.id', displayName: 'Citra Maharani' },
  { email: 'dummy.ranking5@studigi.id', displayName: 'Bagas Nugroho' },
  { email: 'dummy.ranking6@studigi.id', displayName: 'Salsa Kirana' },
  { email: 'dummy.ranking7@studigi.id', displayName: 'Dimas Saputra' },
  { email: 'dummy.ranking8@studigi.id', displayName: 'Intan Lestari' },
  { email: 'dummy.ranking9@studigi.id', displayName: 'Fikri Maulana' },
  { email: 'dummy.ranking10@studigi.id', displayName: 'Nadia Putri' },
  { email: 'dummy.ranking11@studigi.id', displayName: 'Rizky Ananta' },
  { email: 'dummy.ranking12@studigi.id', displayName: 'Maya Salsabila' },
  { email: 'dummy.ranking13@studigi.id', displayName: 'Farhan Zidan' },
  { email: 'dummy.ranking14@studigi.id', displayName: 'Tiara Nabila' },
  { email: 'dummy.ranking15@studigi.id', displayName: 'Aditio Wibowo' },
];

const MAX_PACKAGE_PER_REVIEWER = 4;
const TARGET_REVIEW_COUNTS = [10, 10, 10, 10, 10, 10];

const PACKAGE_TESTIMONIALS = [
  [
    'tampilannya keren parahh berasa tes asli',
    'soalnya susah banget tapi mirip sama tes asli 2024 kemarin',
    'soalnya nampol abis',
    'ngebantu banget soal tryoutnya buat latihan',
    'pembahasannya oke banget',
    'mulai dari tampilan soal sampe tampilan pembahasannya pun oke banget',
    'gak ekspek ada sistem ranking nya juga',
    null,
    null,
    'timer dan navigasinya enak, jadi ga panik pas ngerjain',
  ],
  [
    'banyakin voucher diskonnya plis',
    'nunggu update soal lainnya',
    'adain untuk latihan tes BUMN juga dong, soalnya ini bener2 ngebantu',
    'ngebantu banget buat latihan',
    'goksss',
    'mantap',
    null,
    null,
  ],
  [
    'kereennn abisss',
    'latihan untuk tes lain selain CPNS dong',
    'murah tapi mantep banget soal2nya',
    'beneran HOTS',
    'SKB please',
    null,
    null,
  ],
  [
    'gokiiiilll',
    'keren banget',
    'bismillah CPNS 2026',
    'rekomen si ini',
    'murah mantap',
    null,
    null,
  ],
  [
    'semurah ini tapi gacor abis',
    'nyesel beli yang mahal2, inimurah tapi oke',
    'tampilan tesnya itulohh keren banget',
    'ga nyesel beli tryout disini',
    'fitur review hasilnya ngebantu banget buat evaluasi kelemahan',
    null,
    null,
  ],
  [
    'paket bonusnya juga kepake banget buat pemanasan sebelum latihan utama',
    'soalnya fresh dan ga ngebosenin, cocok buat tambahan jam terbang',
    'moga ada update paket lanjutannya, ini udah bagus banget',
    'buat harga segini worth it parah, ngebantu banget latihan harian',
    null,
    null,
  ],
];

const PACKAGE_RATING_PROFILES = [
  // 4.8 average
  [5, 5, 5, 5, 5, 5, 5, 5, 4, 4],
  // 4.9 average
  [5, 5, 5, 5, 5, 5, 5, 5, 5, 4],
  // 4.8 average
  [5, 5, 5, 5, 5, 5, 5, 5, 4, 4],
  // 4.8 average
  [5, 5, 5, 5, 5, 5, 5, 5, 4, 4],
  // 4.8 average
  [5, 5, 5, 5, 5, 5, 5, 5, 4, 4],
  // 4.9 average
  [5, 5, 5, 5, 5, 5, 5, 5, 5, 4],
];

async function ensureReviewSchema(client) {
  await client.query(
    `CREATE TABLE IF NOT EXISTS package_reviews (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      session_id BIGINT NOT NULL REFERENCES tryout_sessions(id) ON DELETE CASCADE,
      package_id BIGINT NOT NULL REFERENCES packages(id) ON DELETE CASCADE,
      rating SMALLINT NULL CHECK (rating >= 1 AND rating <= 5),
      comment TEXT NULL,
      is_skipped BOOLEAN NOT NULL DEFAULT FALSE,
      is_dummy BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT package_reviews_session_user_unique UNIQUE (session_id, user_id),
      CONSTRAINT package_reviews_input_guard CHECK (is_skipped = TRUE OR rating IS NOT NULL)
    )`
  );
}

async function getTargetTryoutPackages(client) {
  const preferred = await client.query(
    `SELECT id, name
     FROM packages
     WHERE name IN (
       'TRYOUT 1 SKD CPNS (HOTS)',
       'TRYOUT 2 SKD CPNS (HOTS)',
       'TRYOUT 3 SKD CPNS (HOTS)',
       'TRYOUT 4 SKD CPNS (HOTS)',
       'TRYOUT 5 SKD CPNS (HOTS)',
       'TRYOUT 6 SKD CPNS (HOTS) BONUS'
     )
     ORDER BY id ASC`
  );

  if ((preferred.rows || []).length >= 6) return preferred.rows;

  const fallback = await client.query(
    `SELECT id, name
     FROM packages
     WHERE LOWER(COALESCE(type, 'tryout')) IN ('tryout', 'latihan')
     ORDER BY id ASC
     LIMIT 6`
  );

  if ((fallback.rows || []).length < 6) {
    throw new Error('Butuh minimal 6 paket tryout untuk seed review ini.');
  }

  return fallback.rows;
}

async function getOrCreateCompletedSession(client, userId, packageId, displayName, offsetIndex) {
  const existing = await client.query(
    `SELECT id
     FROM tryout_sessions
     WHERE user_id = $1 AND package_id = $2 AND status = 'completed'
     ORDER BY finished_at DESC NULLS LAST, id DESC
     LIMIT 1`,
    [userId, packageId]
  );

  if (existing.rows[0]) {
    const sessionId = Number(existing.rows[0].id);
    await client.query(
      `UPDATE tryout_sessions
       SET participant_name = $2
       WHERE id = $1`,
      [sessionId, displayName]
    );
    return sessionId;
  }

  const inserted = await client.query(
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
       NULL,
       NOW() - (($4 || ' minutes')::interval),
       NOW() - (($5 || ' minutes')::interval),
       'completed',
       80,
       95,
       210,
       385,
       TRUE,
       NOW() - (($4 || ' minutes')::interval)
     )
     RETURNING id`,
    [userId, packageId, displayName, 180 + offsetIndex * 3, 75 + offsetIndex * 3]
  );

  return Number(inserted.rows[0].id);
}

function pickReviewers(reviewers, targetCount) {
  const available = reviewers
    .filter((reviewer) => reviewer.assignedPackages.length < MAX_PACKAGE_PER_REVIEWER)
    .sort((a, b) => {
      if (a.assignedPackages.length !== b.assignedPackages.length) {
        return a.assignedPackages.length - b.assignedPackages.length;
      }
      return String(a.email).localeCompare(String(b.email));
    });

  return available.slice(0, targetCount);
}

async function main() {
  const client = await pool.connect();
  let inserted = 0;

  try {
    await client.query('BEGIN');
    await ensureReviewSchema(client);

    const targetPackages = await getTargetTryoutPackages(client);

    const reviewers = [];
    for (const rawReviewer of REVIEWERS) {
      const userResult = await client.query('SELECT id FROM users WHERE email = $1 LIMIT 1', [rawReviewer.email]);
      const userId = userResult.rows[0]?.id;
      if (!userId) continue;

      await client.query('UPDATE users SET name = $2 WHERE id = $1', [userId, rawReviewer.displayName]);

      reviewers.push({
        ...rawReviewer,
        userId: Number(userId),
        assignedPackages: [],
      });
    }

    if (reviewers.length < 15) {
      throw new Error('Reviewer dummy yang ditemukan kurang dari 15 user.');
    }

    await client.query(
      `DELETE FROM package_reviews
       WHERE is_dummy = TRUE
          OR user_id IN (SELECT id FROM users WHERE email LIKE 'dummy.ranking%@studigi.id')`
    );

    for (let packageIndex = 0; packageIndex < targetPackages.length; packageIndex += 1) {
      const pkg = targetPackages[packageIndex];
      const targetCount = TARGET_REVIEW_COUNTS[packageIndex] || 6;
      const profile = PACKAGE_RATING_PROFILES[packageIndex] || [5, 5, 5, 5, 4, 4];

      const selectedReviewers = pickReviewers(reviewers, targetCount);
      if (selectedReviewers.length < targetCount) {
        throw new Error(`Reviewer tidak cukup untuk paket ${pkg.name}`);
      }

      for (let i = 0; i < selectedReviewers.length; i += 1) {
        const reviewer = selectedReviewers[i];
        const rating = profile[i] || 5;
        const sessionId = await getOrCreateCompletedSession(client, reviewer.userId, Number(pkg.id), reviewer.displayName, packageIndex * 20 + i);

        const testimonialRows = PACKAGE_TESTIMONIALS[packageIndex] || [];
        const comment = testimonialRows[i] || null;

        await client.query(
          `INSERT INTO package_reviews (user_id, session_id, package_id, rating, comment, is_skipped, is_dummy, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, FALSE, TRUE, NOW(), NOW())
           ON CONFLICT (session_id, user_id)
           DO UPDATE SET
             rating = EXCLUDED.rating,
             comment = EXCLUDED.comment,
             is_skipped = FALSE,
             is_dummy = TRUE,
             updated_at = NOW()`,
          [reviewer.userId, sessionId, Number(pkg.id), rating, comment]
        );

        reviewer.assignedPackages.push(Number(pkg.id));
        inserted += 1;
      }
    }

    await client.query('COMMIT');
    console.log('Dummy reviews upserted:', inserted);
    console.log('Target packages:', targetPackages.map((pkg) => `${pkg.id}:${pkg.name}`).join(', '));
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Seed dummy reviews failed:', error.message || error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
