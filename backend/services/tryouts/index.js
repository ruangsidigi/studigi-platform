const express = require('express');
const { INDONESIA_PROVINCES } = require('../../shared/config/indonesiaProvinces');

const router = express.Router();

const getUserRoleNames = (user) => {
  if (!user || !Array.isArray(user.roles)) return [];
  return user.roles
    .map((role) => String(role?.name || role?.role || '').toLowerCase())
    .filter(Boolean);
};

const isAdminUser = (user) => {
  const roleNames = getUserRoleNames(user);
  return (
    roleNames.includes('admin') ||
    String(user?.role || '').toLowerCase() === 'admin' ||
    String(user?.email || '').toLowerCase() === String(process.env.ADMIN_EMAIL || 'admin@skdcpns.com').toLowerCase()
  );
};

const requireAuth = (req, res, next) => {
  if (!req.user || !req.user.id) return res.status(401).json({ error: 'Access token required' });
  return next();
};

const getSelectedOptionPoint = (row, answer) => {
  const key = `point_${String(answer || '').toLowerCase()}`;
  return Number(row?.[key] ?? 0) || 0;
};

const hasManualPointConfig = (row) => {
  const keys = ['point_a', 'point_b', 'point_c', 'point_d', 'point_e'];
  return keys.some((key) => row?.[key] !== null && row?.[key] !== undefined && String(row?.[key]).trim() !== '');
};

const getAccessiblePackageIds = async (db, userId) => {
  const accessible = new Set();

  const purchaseResult = await db.query(
    `SELECT package_id
     FROM purchases
     WHERE user_id = $1
       AND package_id IS NOT NULL`,
    [userId]
  );

  for (const row of purchaseResult.rows || []) {
    const normalized = Number(row.package_id);
    if (Number.isInteger(normalized) && normalized > 0) {
      accessible.add(normalized);
    }
  }

  // Also include package ids from successful payment transaction metadata.
  try {
    const paidStatuses = ['paid', 'completed', 'success', 'settlement'];
    const txResult = await db.query(
      `SELECT metadata
       FROM payment_transactions
       WHERE user_id = $1
         AND LOWER(COALESCE(status, '')) = ANY($2::text[])`,
      [userId, paidStatuses]
    );

    for (const row of txResult.rows || []) {
      const meta = row?.metadata && typeof row.metadata === 'object' ? row.metadata : null;
      const ids = Array.isArray(meta?.package_ids) ? meta.package_ids : [];
      for (const id of ids) {
        const normalized = Number(id);
        if (Number.isInteger(normalized) && normalized > 0) {
          accessible.add(normalized);
        }
      }
    }
  } catch (_) {
    // Ignore when payment_transactions table is unavailable on older schema.
  }

  if (!accessible.size) {
    return accessible;
  }

  const ownedIds = [...accessible];

  // Expand bundle ownership to its child packages.
  try {
    const bundleLinks = await db.query(
      'SELECT package_id FROM bundle_packages WHERE bundle_id = ANY($1::int[])',
      [ownedIds]
    );
    for (const row of bundleLinks.rows || []) {
      const childId = Number(row.package_id);
      if (Number.isInteger(childId) && childId > 0) {
        accessible.add(childId);
      }
    }
  } catch (_) {
    // Ignore when bundle_packages table does not exist in older schema.
  }

  // Fallback for deployments that store bundle children on packages.included_package_ids.
  try {
    const packageRows = await db.query(
      'SELECT id, included_package_ids FROM packages WHERE id = ANY($1::int[])',
      [ownedIds]
    );
    for (const row of packageRows.rows || []) {
      const includedIds = Array.isArray(row.included_package_ids) ? row.included_package_ids : [];
      for (const includedId of includedIds) {
        const childId = Number(includedId);
        if (Number.isInteger(childId) && childId > 0) {
          accessible.add(childId);
        }
      }
    }
  } catch (_) {
    // Ignore legacy schema mismatches.
  }

  return accessible;
};

router.post('/tryouts/start', requireAuth, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const userId = req.user.id;
    const packageId = Number(req.body?.packageId);
    const participantName = String(req.body?.participantName || '').trim();
    const participantProvince = String(req.body?.participantProvince || '').trim();

    if (!Number.isInteger(packageId)) {
      return res.status(400).json({ error: 'Package ID is required' });
    }

    if (participantName.length < 2) {
      return res.status(400).json({ error: 'Nama peserta wajib diisi minimal 2 karakter' });
    }

    if (!participantProvince) {
      return res.status(400).json({ error: 'Provinsi peserta wajib dipilih' });
    }

    if (!INDONESIA_PROVINCES.includes(participantProvince)) {
      return res.status(400).json({ error: 'Provinsi tidak valid' });
    }

    if (!isAdminUser(req.user)) {
      const accessiblePackageIds = await getAccessiblePackageIds(db, userId);
      if (!accessiblePackageIds.has(packageId)) {
        return res.status(403).json({ error: 'User does not have access to this package' });
      }
    }

    const schemaResult = await db.query(
      `SELECT
         EXISTS (
           SELECT 1 FROM information_schema.columns
           WHERE table_name = 'tryout_sessions' AND column_name = 'participant_name'
         ) AS has_participant_name,
         EXISTS (
           SELECT 1 FROM information_schema.columns
           WHERE table_name = 'tryout_sessions' AND column_name = 'participant_province'
         ) AS has_participant_province`
    );

    const schema = schemaResult.rows[0] || {};
    if (!schema.has_participant_name || !schema.has_participant_province) {
      return res.status(500).json({
        error: 'Database belum mendukung data ranking peserta. Jalankan migrasi terbaru terlebih dahulu.',
      });
    }

    const sessionResult = await db.query(
      `INSERT INTO tryout_sessions (user_id, package_id, participant_name, participant_province, started_at, status)
       VALUES ($1, $2, $3, $4, NOW(), 'in_progress')
       RETURNING *`,
      [userId, packageId, participantName, participantProvince]
    );

    return res.json({
      message: 'Tryout session started',
      session: sessionResult.rows[0],
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.post('/tryouts/submit-answer', requireAuth, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const userId = req.user.id;
    const sessionId = Number(req.body?.sessionId);
    const questionId = Number(req.body?.questionId);
    const selectedAnswer = String(req.body?.selectedAnswer || '').toUpperCase();

    if (!Number.isInteger(sessionId) || !Number.isInteger(questionId) || !selectedAnswer) {
      return res.status(400).json({ error: 'Session ID, question ID, and selected answer are required' });
    }

    const sessionResult = await db.query('SELECT id FROM tryout_sessions WHERE id = $1 AND user_id = $2 LIMIT 1', [sessionId, userId]);
    if (!sessionResult.rows[0]) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const questionResult = await db.query('SELECT * FROM questions WHERE id = $1 LIMIT 1', [questionId]);
    const question = questionResult.rows[0];
    if (!question) {
      return res.status(404).json({ error: 'Question not found' });
    }

    const category = String(question.category || '').toUpperCase();
    let isCorrect = null;
    if (category === 'TWK' || category === 'TIU') {
      isCorrect = selectedAnswer === String(question.correct_answer || '').toUpperCase();
    }

    const answerResult = await db.query(
      `INSERT INTO tryout_answers (session_id, question_id, user_answer, is_correct, submitted_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING *`,
      [sessionId, questionId, selectedAnswer, isCorrect]
    );

    return res.json({
      message: 'Answer submitted',
      answer: answerResult.rows[0],
      isCorrect,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.post('/tryouts/finish', requireAuth, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const userId = req.user.id;
    const sessionId = Number(req.body?.sessionId);

    if (!Number.isInteger(sessionId)) {
      return res.status(400).json({ error: 'Session ID is required' });
    }

    const sessionResult = await db.query('SELECT * FROM tryout_sessions WHERE id = $1 AND user_id = $2 LIMIT 1', [sessionId, userId]);
    const session = sessionResult.rows[0];
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const answersResult = await db.query(
      `SELECT a.user_answer, q.category, q.correct_answer, q.point_a, q.point_b, q.point_c, q.point_d, q.point_e
       FROM tryout_answers a
       JOIN questions q ON q.id = a.question_id
       WHERE a.session_id = $1`,
      [sessionId]
    );

    let twkPoints = 0;
    let tiuPoints = 0;
    let tkpPoints = 0;

    for (const row of answersResult.rows || []) {
      const category = String(row.category || '').toUpperCase();
      const answer = String(row.user_answer || '').toUpperCase();
      const correctAnswer = String(row.correct_answer || '').toUpperCase();

      if (category === 'TWK') {
        // TWK now supports manual point mapping per option; keep legacy fallback if points are not configured.
        if (hasManualPointConfig(row)) {
          twkPoints += getSelectedOptionPoint(row, answer);
        } else if (answer && answer === correctAnswer) {
          twkPoints += 5;
        }
      } else if (category === 'TIU') {
        // TIU now supports manual point mapping per option; keep legacy fallback if points are not configured.
        if (hasManualPointConfig(row)) {
          tiuPoints += getSelectedOptionPoint(row, answer);
        } else if (answer && answer === correctAnswer) {
          tiuPoints += 5;
        }
      } else if (category === 'TKP') {
        const key = `point_${answer.toLowerCase()}`;
        tkpPoints += Number(row[key] || 0);
      }
    }

  const totalScore = Math.round(twkPoints + tiuPoints + tkpPoints);

    // Use package-level pass_score if configured, else standard SKD thresholds
    let isPass;
    const pkgResult = await db.query('SELECT pass_score FROM packages WHERE id = $1 LIMIT 1', [session.package_id]).catch(() => ({ rows: [] }));
    const packagePassScore = pkgResult.rows[0]?.pass_score;
    if (packagePassScore !== null && packagePassScore !== undefined) {
      isPass = totalScore >= Number(packagePassScore);
    } else {
      isPass = twkPoints > 65 && tiuPoints > 85 && tkpPoints > 166;
    }

    const updatedResult = await db.query(
      `UPDATE tryout_sessions
       SET finished_at = NOW(),
           status = 'completed',
           twk_score = $1,
           tiu_score = $2,
           tkp_score = $3,
           total_score = $4,
           is_passed = $5
       WHERE id = $6
       RETURNING *`,
      [twkPoints, tiuPoints, tkpPoints, totalScore, isPass, sessionId]
    );

    return res.json({
      message: 'Tryout finished',
      session: updatedResult.rows[0],
      scores: {
        twk: twkPoints,
        tiu: tiuPoints,
        tkp: tkpPoints,
        total: totalScore,
      },
      isPass,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/tryouts/:sessionId/results', requireAuth, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const userId = req.user.id;
    const sessionId = Number(req.params.sessionId);

    if (!Number.isInteger(sessionId)) return res.status(400).json({ error: 'Invalid session id' });

    const result = await db.query(
      `SELECT id, user_id, package_id, started_at, finished_at, twk_score, tiu_score, tkp_score, total_score, is_passed, status
       FROM tryout_sessions
       WHERE id = $1 AND user_id = $2
       LIMIT 1`,
      [sessionId, userId]
    );

    const session = result.rows[0];
    if (!session) return res.status(404).json({ error: 'Session not found' });
    return res.json(session);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

module.exports = router;
