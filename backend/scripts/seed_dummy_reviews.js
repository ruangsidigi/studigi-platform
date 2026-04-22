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

const DUMMY_REVIEWS = [
  { email: 'dummy.ranking1@studigi.id', rating: 5, comment: 'Soalnya bagus dan pembahasan membantu banget.' },
  { email: 'dummy.ranking2@studigi.id', rating: 5, comment: 'Layout rapi, waktu pas, dan tingkat kesulitan seimbang.' },
  { email: 'dummy.ranking3@studigi.id', rating: 4, comment: 'Membantu latihan manajemen waktu sebelum ujian asli.' },
  { email: 'dummy.ranking4@studigi.id', rating: 5, comment: 'Pembahasan jelas, terutama di bagian TIU numerik.' },
  { email: 'dummy.ranking5@studigi.id', rating: 4, comment: 'Kategori soal variatif, jadi latihan terasa komplit.' },
  { email: 'dummy.ranking6@studigi.id', rating: 5, comment: 'Simulasi tryout-nya mirip kondisi tes sesungguhnya.' },
  { email: 'dummy.ranking7@studigi.id', rating: 5, comment: 'Progress dan ranking bikin saya lebih termotivasi belajar.' },
  { email: 'dummy.ranking8@studigi.id', rating: 4, comment: 'Bagus untuk evaluasi kelemahan per kategori soal.' },
  { email: 'dummy.ranking9@studigi.id', rating: 5, comment: 'Paket latihan sangat worth it, soal berkualitas.' },
  { email: 'dummy.ranking10@studigi.id', rating: 4, comment: 'Antarmuka nyaman dipakai di laptop maupun HP.' },
  { email: 'dummy.ranking11@studigi.id', rating: 5, comment: null },
  { email: 'dummy.ranking12@studigi.id', rating: 4, comment: null },
  { email: 'dummy.ranking13@studigi.id', rating: 5, comment: null },
  { email: 'dummy.ranking14@studigi.id', rating: 4, comment: null },
  { email: 'dummy.ranking15@studigi.id', rating: 5, comment: null },
];

const REVIEWER_PACKAGE_COUNT = {
  'dummy.ranking1@studigi.id': 2,
  'dummy.ranking2@studigi.id': 2,
  'dummy.ranking3@studigi.id': 2,
  'dummy.ranking4@studigi.id': 2,
  'dummy.ranking5@studigi.id': 2,
  'dummy.ranking6@studigi.id': 2,
  'dummy.ranking7@studigi.id': 2,
  'dummy.ranking8@studigi.id': 2,
  'dummy.ranking9@studigi.id': 2,
  'dummy.ranking10@studigi.id': 2,
  'dummy.ranking11@studigi.id': 1,
  'dummy.ranking12@studigi.id': 1,
  'dummy.ranking13@studigi.id': 1,
  'dummy.ranking14@studigi.id': 1,
  'dummy.ranking15@studigi.id': 1,
};

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

async function getTargetTryoutPackageIds(client) {
  const preferred = await client.query(
    `SELECT id
     FROM packages
     WHERE name IN ('Tryout SKD CPNS 1', 'Tryout SKD CPNS 2')
     ORDER BY CASE name WHEN 'Tryout SKD CPNS 1' THEN 1 WHEN 'Tryout SKD CPNS 2' THEN 2 ELSE 3 END`
  );

  const preferredIds = preferred.rows.map((row) => Number(row.id)).filter((id) => Number.isInteger(id) && id > 0);

  const fallback = await client.query(
    `SELECT id
     FROM packages
     WHERE LOWER(COALESCE(type, 'tryout')) IN ('tryout', 'latihan')
     ORDER BY id ASC
     LIMIT 3`
  );

  const fallbackIds = fallback.rows.map((row) => Number(row.id)).filter((id) => Number.isInteger(id) && id > 0);

  const combined = [...preferredIds, ...fallbackIds].filter((id, index, arr) => arr.indexOf(id) === index);
  if (combined.length < 2) {
    throw new Error('Butuh minimal 2 paket tryout untuk seeding review dummy.');
  }

  return combined.slice(0, 2);
}

const getTargetAverageProfile = (index) => {
  if (index % 2 === 0) {
    // 12x bintang 5 + 3x bintang 4 = 4.8 (15 reviewer)
    return [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 4, 4, 4];
  }

  // 9x bintang 5 + 1x bintang 4 = 4.9 (10 reviewer)
  return [5, 5, 5, 5, 5, 5, 5, 5, 5, 4];
};

async function getOrCreateCompletedSession(client, userId, packageId) {
  const existing = await client.query(
    `SELECT id
     FROM tryout_sessions
     WHERE user_id = $1 AND package_id = $2 AND status = 'completed'
     ORDER BY finished_at DESC NULLS LAST, id DESC
     LIMIT 1`,
    [userId, packageId]
  );

  if (existing.rows[0]) return Number(existing.rows[0].id);

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
       NULL,
       NULL,
       NOW() - INTERVAL '120 minutes',
       NOW() - INTERVAL '20 minutes',
       'completed',
       80,
       95,
       210,
       385,
       TRUE,
       NOW() - INTERVAL '120 minutes'
     )
     RETURNING id`,
    [userId, packageId]
  );

  return Number(inserted.rows[0].id);
}

async function main() {
  const client = await pool.connect();
  let inserted = 0;

  try {
    await client.query('BEGIN');
    await ensureReviewSchema(client);

    const packageIds = await getTargetTryoutPackageIds(client);
    const reviewers = [];

    for (const item of DUMMY_REVIEWS) {
      const userResult = await client.query('SELECT id FROM users WHERE email = $1 LIMIT 1', [item.email]);
      const userId = userResult.rows[0]?.id;
      if (!userId) continue;
      reviewers.push({ ...item, userId: Number(userId) });
    }

    if (reviewers.length < 10) {
      throw new Error('User dummy ranking tidak cukup untuk pembagian reviewer.');
    }

    await client.query(
      `DELETE FROM package_reviews
       WHERE is_dummy = TRUE
          OR user_id IN (SELECT id FROM users WHERE email LIKE 'dummy.ranking%@studigi.id')`
    );

    const commentUsedByEmail = new Set();

    for (let packageIndex = 0; packageIndex < packageIds.length; packageIndex += 1) {
      const packageId = packageIds[packageIndex];
      const targetRatings = getTargetAverageProfile(packageIndex);
      const selectedReviewers = [];

      for (let i = 0; i < reviewers.length; i += 1) {
        const reviewer = reviewers[i];
        const allowedCount = Number(REVIEWER_PACKAGE_COUNT[reviewer.email] || 1);
        if (packageIndex < allowedCount) {
          selectedReviewers.push(reviewer);
        }
        if (selectedReviewers.length === targetRatings.length) break;
      }

      if (selectedReviewers.length < targetRatings.length) {
        throw new Error(`Reviewer tidak cukup untuk paket ${packageId}`);
      }

      for (let i = 0; i < selectedReviewers.length; i += 1) {
        const reviewer = selectedReviewers[i];
        const rating = targetRatings[i];
        const sessionId = await getOrCreateCompletedSession(client, reviewer.userId, packageId);
        const shouldUseComment = reviewer.comment && !commentUsedByEmail.has(reviewer.email);
        const comment = shouldUseComment ? reviewer.comment : null;

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
          [reviewer.userId, sessionId, packageId, rating, comment]
        );

        if (shouldUseComment) {
          commentUsedByEmail.add(reviewer.email);
        }
        inserted += 1;
      }
    }

    await client.query('COMMIT');
    console.log('Dummy reviews upserted:', inserted);
    console.log('Target packages:', packageIds.join(', '));
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
