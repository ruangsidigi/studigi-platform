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
  { email: 'dummy.ranking1@studigi.id', displayName: 'Naufal Pratama', comment: 'Soalnya relate sama pola SKD terbaru. Enak banget buat latihan harian.' },
  { email: 'dummy.ranking2@studigi.id', displayName: 'Alya Rahma', comment: 'UI-nya clean, jadi fokus ngerjain tanpa distraksi. Mantap.' },
  { email: 'dummy.ranking3@studigi.id', displayName: 'Rafi Akbar', comment: 'Pembahasannya to the point dan gampang dipahami, terutama TIU.' },
  { email: 'dummy.ranking4@studigi.id', displayName: 'Citra Maharani', comment: 'Timer dan nuansa tryout-nya bikin kerasa kayak tes beneran.' },
  { email: 'dummy.ranking5@studigi.id', displayName: 'Bagas Nugroho', comment: 'Bantu banget buat ukur progres. Jadi tahu harus fokus belajar di mana.' },
  { email: 'dummy.ranking6@studigi.id', displayName: 'Salsa Kirana', comment: 'Paket soalnya variatif, nggak ngebosenin. Cocok buat prepare intensif.' },
  { email: 'dummy.ranking7@studigi.id', displayName: 'Dimas Saputra', comment: 'Flow dari mulai tryout sampai review hasil itu smooth. Suka banget.' },
  { email: 'dummy.ranking8@studigi.id', displayName: 'Intan Lestari', comment: 'Soal HOTS-nya menantang tapi masih realistis. Worth it untuk latihan.' },
  { email: 'dummy.ranking9@studigi.id', displayName: 'Fikri Maulana', comment: 'Ngebantu ningkatin speed ngerjain. Pas buat simulasi sebelum ujian.' },
  { email: 'dummy.ranking10@studigi.id', displayName: 'Nadia Putri', comment: 'Overall experience-nya modern dan nyaman dipakai di laptop maupun HP.' },
  { email: 'dummy.ranking11@studigi.id', displayName: 'Rizky Ananta', comment: null },
  { email: 'dummy.ranking12@studigi.id', displayName: 'Maya Salsabila', comment: null },
  { email: 'dummy.ranking13@studigi.id', displayName: 'Farhan Zidan', comment: null },
  { email: 'dummy.ranking14@studigi.id', displayName: 'Tiara Nabila', comment: null },
  { email: 'dummy.ranking15@studigi.id', displayName: 'Aditio Wibowo', comment: null },
];

const MAX_PACKAGE_PER_REVIEWER = 3;
const TARGET_REVIEW_COUNTS = [15, 10, 6, 6, 6];

const PACKAGE_RATING_PROFILES = [
  // Paket 1 -> 4.8
  [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 4, 4, 4],
  // Paket 2 -> 4.9
  [5, 5, 5, 5, 5, 5, 5, 5, 5, 4],
  // Paket 3 -> 4.8
  [5, 5, 5, 5, 5, 4],
  // Paket 4 -> 4.7
  [5, 5, 5, 5, 4, 4],
  // Paket 5 -> 4.8
  [5, 5, 5, 5, 5, 4],
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
       'TRYOUT 5 SKD CPNS (HOTS)'
     )
     ORDER BY id ASC`
  );

  if ((preferred.rows || []).length >= 5) return preferred.rows;

  const fallback = await client.query(
    `SELECT id, name
     FROM packages
     WHERE LOWER(COALESCE(type, 'tryout')) IN ('tryout', 'latihan')
       AND LOWER(COALESCE(name, '')) NOT LIKE '%bonus%'
     ORDER BY id ASC
     LIMIT 5`
  );

  if ((fallback.rows || []).length < 5) {
    throw new Error('Butuh minimal 5 paket tryout (non-bonus) untuk seed review ini.');
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
        usedComment: false,
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

        let comment = null;
        if (reviewer.comment && !reviewer.usedComment) {
          comment = reviewer.comment;
          reviewer.usedComment = true;
        }

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
