const express = require('express');
const voucherHelpers = require('../vouchers');

const router = express.Router();

const requireAuth = (req, res, next) => {
  if (!req.user || !req.user.id) return res.status(401).json({ error: 'Access token required' });
  return next();
};

const isMissingRelation = (message) => {
  const msg = String(message || '').toLowerCase();
  return msg.includes('does not exist') || msg.includes('relation') || msg.includes('column');
};

let reviewSchemaReady = false;
const ensureReviewSchema = async (db) => {
  if (reviewSchemaReady) return;

  await db.query(
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

  await db.query('CREATE INDEX IF NOT EXISTS idx_package_reviews_package_id ON package_reviews(package_id)');
  await db.query('CREATE INDEX IF NOT EXISTS idx_package_reviews_session_id ON package_reviews(session_id)');
  await db.query('CREATE INDEX IF NOT EXISTS idx_package_reviews_created_at ON package_reviews(created_at DESC)');

  reviewSchemaReady = true;
};

const asNumber = (value, fallback = 0) => {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
};

const getSessionForReview = async (db, sessionId, userId) => {
  const result = await db.query(
    `SELECT id, user_id, package_id, status
     FROM tryout_sessions
     WHERE id = $1 AND user_id = $2
     LIMIT 1`,
    [sessionId, userId]
  );

  return result.rows[0] || null;
};

const buildRewardVoucherCode = (userId, sessionId) => {
  const randomPart = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `RATE-${String(userId).padStart(2, '0')}${String(sessionId).padStart(3, '0')}-${randomPart}`;
};

const issueReviewRewardVoucher = async ({ db, user, session, reviewId, comment }) => {
  const trimmedComment = String(comment || '').trim();
  if (!trimmedComment) {
    return { rewardGranted: false, reason: 'comment_required' };
  }

  await voucherHelpers.ensureVoucherSchema(db);
  const rewardConfig = await voucherHelpers.getActiveReviewRewardConfig(db);
  if (!rewardConfig || !rewardConfig.is_active) {
    return { rewardGranted: false, reason: 'reward_inactive' };
  }

  const existingClaim = await db.query(
    `SELECT
       v.id,
       v.code,
       v.description,
       v.discount_type,
       v.discount_value,
       v.min_purchase,
       v.max_discount,
       v.valid_until
     FROM review_reward_claims rrc
     JOIN vouchers v ON v.id = rrc.voucher_id
     WHERE rrc.session_id = $1 AND rrc.user_id = $2
     LIMIT 1`,
    [session.id, user.id]
  );

  if (existingClaim.rows[0]) {
    const voucher = existingClaim.rows[0];
    return {
      rewardGranted: true,
      voucher: {
        id: Number(voucher.id),
        code: voucher.code,
        description: voucher.description || '',
        discountType: voucher.discount_type,
        discountValue: Number(voucher.discount_value),
        minPurchase: Number(voucher.min_purchase || 0),
        maxDiscount: voucher.max_discount !== null ? Number(voucher.max_discount) : null,
        validUntil: voucher.valid_until,
      },
    };
  }

  const validUntilResult = await db.query(
    `SELECT NOW() + (($1 || ' days')::interval) AS valid_until`,
    [Number(rewardConfig.expires_in_days || 7)]
  );
  const validUntil = validUntilResult.rows[0]?.valid_until || null;

  let voucherRow = null;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = buildRewardVoucherCode(user.id, session.id);
    try {
      const insertVoucher = await db.query(
        `INSERT INTO vouchers (
           code,
           description,
           discount_type,
           discount_value,
           min_purchase,
           max_discount,
           max_uses,
           used_count,
           valid_from,
           valid_until,
           is_active,
           issued_to_user_id,
           reward_source,
           metadata,
           created_by,
           created_at,
           updated_at
         ) VALUES (
           $1,$2,$3,$4,$5,$6,1,0,NOW(),$7,TRUE,$8,'review_reward',$9::jsonb,$10,NOW(),NOW()
         ) RETURNING *`,
        [
          code,
          rewardConfig.description || `Voucher reward untuk ${session.package_id}`,
          rewardConfig.discount_type,
          Number(rewardConfig.discount_value),
          Number(rewardConfig.min_purchase || 0),
          rewardConfig.max_discount !== null ? Number(rewardConfig.max_discount) : null,
          validUntil,
          user.id,
          JSON.stringify({
            session_id: session.id,
            package_id: session.package_id,
            review_id: reviewId,
          }),
          rewardConfig.updated_by || rewardConfig.created_by || user.id,
        ]
      );
      voucherRow = insertVoucher.rows[0];
      break;
    } catch (error) {
      if (error.code !== '23505') throw error;
    }
  }

  if (!voucherRow) {
    throw new Error('Gagal membuat kode voucher reward unik');
  }

  await db.query(
    `INSERT INTO review_reward_claims (user_id, session_id, review_id, package_id, voucher_id, created_at)
     VALUES ($1, $2, $3, $4, $5, NOW())`,
    [user.id, session.id, reviewId, session.package_id, voucherRow.id]
  );

  return {
    rewardGranted: true,
    voucher: {
      id: Number(voucherRow.id),
      code: voucherRow.code,
      description: voucherRow.description || '',
      discountType: voucherRow.discount_type,
      discountValue: Number(voucherRow.discount_value),
      minPurchase: Number(voucherRow.min_purchase || 0),
      maxDiscount: voucherRow.max_discount !== null ? Number(voucherRow.max_discount) : null,
      validUntil: voucherRow.valid_until,
    },
  };
};

router.get('/ratings/session/:sessionId/status', requireAuth, async (req, res) => {
  try {
    const db = req.app.locals.db;
    await ensureReviewSchema(db);

    const sessionId = Number(req.params.sessionId);
    if (!Number.isInteger(sessionId)) return res.status(400).json({ error: 'Invalid session id' });

    const session = await getSessionForReview(db, sessionId, req.user.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const existingResult = await db.query(
      `SELECT id, rating, comment, is_skipped, created_at
       FROM package_reviews
       WHERE session_id = $1 AND user_id = $2
       LIMIT 1`,
      [sessionId, req.user.id]
    );

    const existing = existingResult.rows[0] || null;

    return res.json({
      sessionId,
      packageId: asNumber(session.package_id, null),
      isCompleted: String(session.status || '').toLowerCase() === 'completed',
      isSubmitted: Boolean(existing),
      isSkipped: Boolean(existing?.is_skipped),
      current: existing
        ? {
            id: existing.id,
            rating: existing.rating !== null ? Number(existing.rating) : null,
            comment: existing.comment || '',
            createdAt: existing.created_at,
          }
        : null,
    });
  } catch (error) {
    if (isMissingRelation(error.message)) {
      return res.json({
        sessionId: Number(req.params.sessionId) || null,
        packageId: null,
        isCompleted: true,
        isSubmitted: false,
        isSkipped: false,
        current: null,
      });
    }

    return res.status(500).json({ error: error.message || 'Gagal memuat status rating' });
  }
});

router.post('/ratings/session/:sessionId/submit', requireAuth, async (req, res) => {
  try {
    const db = req.app.locals.db;
    await ensureReviewSchema(db);

    const sessionId = Number(req.params.sessionId);
    if (!Number.isInteger(sessionId)) return res.status(400).json({ error: 'Invalid session id' });

    const session = await getSessionForReview(db, sessionId, req.user.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    if (String(session.status || '').toLowerCase() !== 'completed') {
      return res.status(400).json({ error: 'Tryout belum selesai' });
    }

    const skip = Boolean(req.body?.skip);
    const ratingRaw = req.body?.rating;
    const commentRaw = req.body?.comment;

    const rating = ratingRaw === null || ratingRaw === undefined || String(ratingRaw).trim() === ''
      ? null
      : Number(ratingRaw);
    const comment = String(commentRaw || '').trim();

    if (!skip) {
      if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        return res.status(400).json({ error: 'Rating harus antara 1 sampai 5' });
      }
    }

    await db.query('BEGIN');

    const upsertResult = await db.query(
      `INSERT INTO package_reviews (user_id, session_id, package_id, rating, comment, is_skipped, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
       ON CONFLICT (session_id, user_id)
       DO UPDATE SET
         rating = EXCLUDED.rating,
         comment = EXCLUDED.comment,
         is_skipped = EXCLUDED.is_skipped,
         updated_at = NOW()
       RETURNING id, user_id, session_id, package_id, rating, comment, is_skipped, created_at, updated_at`,
      [
        req.user.id,
        sessionId,
        session.package_id,
        skip ? null : rating,
        skip ? null : (comment || null),
        skip,
      ]
    );

    const row = upsertResult.rows[0];
    let reward = { rewardGranted: false };

    if (!skip) {
      reward = await issueReviewRewardVoucher({
        db,
        user: req.user,
        session,
        reviewId: Number(row.id),
        comment,
      });
    }

    await db.query('COMMIT');

    return res.json({
      message: skip ? 'Review dilewati' : 'Review berhasil disimpan',
      review: {
        id: row.id,
        rating: row.rating !== null ? Number(row.rating) : null,
        comment: row.comment || '',
        isSkipped: Boolean(row.is_skipped),
        packageId: Number(row.package_id),
        sessionId: Number(row.session_id),
        updatedAt: row.updated_at,
      },
      reward,
    });
  } catch (error) {
    try {
      await req.app.locals.db.query('ROLLBACK');
    } catch (_) {}
    return res.status(500).json({ error: error.message || 'Gagal menyimpan review' });
  }
});

router.get('/ratings/package/:packageId', async (req, res) => {
  try {
    const db = req.app.locals.db;
    await ensureReviewSchema(db);

    const packageId = Number(req.params.packageId);
    if (!Number.isInteger(packageId)) return res.status(400).json({ error: 'Invalid package id' });

    const summaryResult = await db.query(
      `SELECT
         COUNT(*) FILTER (WHERE is_skipped = FALSE AND rating IS NOT NULL) AS rating_count,
         ROUND(AVG(rating) FILTER (WHERE is_skipped = FALSE AND rating IS NOT NULL), 1) AS avg_rating
       FROM package_reviews
       WHERE package_id = $1`,
      [packageId]
    );

    const commentsResult = await db.query(
      `SELECT
         pr.id,
         pr.rating,
         pr.comment,
         pr.created_at,
         COALESCE(NULLIF(ts.participant_name, ''), u.name, u.email, 'Peserta') AS reviewer_name
       FROM package_reviews pr
       LEFT JOIN tryout_sessions ts ON ts.id = pr.session_id
       LEFT JOIN users u ON u.id = pr.user_id
       WHERE pr.package_id = $1
         AND pr.is_skipped = FALSE
         AND pr.rating IS NOT NULL
       ORDER BY pr.created_at DESC
       LIMIT 20`,
      [packageId]
    );

    const summaryRow = summaryResult.rows[0] || {};

    return res.json({
      packageId,
      summary: {
        averageRating: summaryRow.avg_rating !== null ? Number(summaryRow.avg_rating) : null,
        ratingCount: asNumber(summaryRow.rating_count, 0),
      },
      reviews: (commentsResult.rows || []).map((row) => ({
        id: row.id,
        rating: Number(row.rating),
        comment: row.comment || '',
        reviewerName: row.reviewer_name || 'Peserta',
        createdAt: row.created_at,
      })),
    });
  } catch (error) {
    if (isMissingRelation(error.message)) {
      return res.json({
        packageId: Number(req.params.packageId) || null,
        summary: { averageRating: null, ratingCount: 0 },
        reviews: [],
      });
    }

    return res.status(500).json({ error: error.message || 'Gagal memuat rating paket' });
  }
});

router.get('/ratings/highlights', async (req, res) => {
  try {
    const db = req.app.locals.db;
    await ensureReviewSchema(db);

    const rowsResult = await db.query(
      `SELECT
         pr.id,
         pr.rating,
         pr.comment,
         pr.created_at,
         p.id AS package_id,
         p.name AS package_name,
         COALESCE(NULLIF(ts.participant_name, ''), u.name, u.email, 'Peserta') AS reviewer_name
       FROM package_reviews pr
       JOIN packages p ON p.id = pr.package_id
       LEFT JOIN tryout_sessions ts ON ts.id = pr.session_id
       LEFT JOIN users u ON u.id = pr.user_id
       WHERE pr.is_skipped = FALSE
         AND pr.rating IS NOT NULL
       ORDER BY pr.created_at DESC
       LIMIT 40`
    );

    const packageSummaryResult = await db.query(
      `SELECT
         p.id,
         p.name,
         p.type,
         COUNT(pr.id) FILTER (WHERE pr.is_skipped = FALSE AND pr.rating IS NOT NULL) AS rating_count,
         ROUND(AVG(pr.rating) FILTER (WHERE pr.is_skipped = FALSE AND pr.rating IS NOT NULL), 1) AS avg_rating
       FROM packages p
       LEFT JOIN package_reviews pr ON pr.package_id = p.id
       WHERE LOWER(COALESCE(p.type, 'tryout')) IN ('tryout', 'latihan')
       GROUP BY p.id, p.name
       ORDER BY avg_rating DESC NULLS LAST, rating_count DESC, p.id ASC
       LIMIT 30`
    );

    return res.json({
      packages: (packageSummaryResult.rows || []).map((row) => ({
        id: Number(row.id),
        name: row.name,
        averageRating: row.avg_rating !== null ? Number(row.avg_rating) : null,
        ratingCount: asNumber(row.rating_count, 0),
      })),
      reviews: (rowsResult.rows || []).map((row) => ({
        id: row.id,
        rating: Number(row.rating),
        comment: row.comment || '',
        reviewerName: row.reviewer_name || 'Peserta',
        packageId: Number(row.package_id),
        packageName: row.package_name || '-',
        createdAt: row.created_at,
      })),
    });
  } catch (error) {
    if (isMissingRelation(error.message)) {
      return res.json({ packages: [], reviews: [] });
    }

    return res.status(500).json({ error: error.message || 'Gagal memuat highlights rating' });
  }
});

module.exports = router;
