const express = require('express');

const router = express.Router();

const requireAuth = (req, res, next) => {
  if (!req.user || !req.user.id) return res.status(401).json({ error: 'Access token required' });
  return next();
};

const CORE_TOPICS = new Set(['TWK', 'TIU', 'TKP']);

const normalizePackageTopic = (category, packageName) => {
  const normalizedCategory = String(category || '').trim().toUpperCase();
  if (CORE_TOPICS.has(normalizedCategory)) return normalizedCategory;
  const safePackageName = String(packageName || '').trim();
  return safePackageName || 'LAINNYA';
};

const rewriteReasonTopic = (reason, originalTopic, displayTopic) => {
  const text = String(reason || '');
  if (!text) return text;
  const source = String(originalTopic || '').trim();
  const target = String(displayTopic || '').trim();
  if (!source || !target || source === target) return text;
  return text.split(source).join(target);
};

const getLatestNonCorePackageName = async (db, userId) => {
  const rows = await safeQuery(
    db,
    `SELECT p.name AS package_name
     FROM tryout_sessions ts
     JOIN packages p ON p.id = ts.package_id
     WHERE ts.user_id = $1
       AND ts.status = 'completed'
       AND EXISTS (
         SELECT 1
         FROM questions q
         WHERE q.package_id = ts.package_id
           AND UPPER(COALESCE(q.category, '')) NOT IN ('TWK', 'TIU', 'TKP')
       )
     ORDER BY ts.finished_at DESC NULLS LAST, ts.id DESC
     LIMIT 1`,
    [userId]
  );
  return String(rows[0]?.package_name || '').trim();
};

const safeQuery = async (db, queryText, params = []) => {
  try {
    const result = await db.query(queryText, params);
    return result.rows || [];
  } catch (_) {
    return [];
  }
};

const computeAdaptiveFromSessions = async (db, userId) => {
  const sessionRows = await safeQuery(
    db,
    `SELECT id, twk_score, tiu_score, tkp_score, total_score
     FROM tryout_sessions
     WHERE user_id = $1 AND status = 'completed'
     ORDER BY id ASC`,
    [userId]
  );

  if (!sessionRows.length) {
    return null;
  }

  const n = sessionRows.length;
  const avgTwk = sessionRows.reduce((sum, s) => sum + Number(s.twk_score || 0), 0) / n;
  const avgTiu = sessionRows.reduce((sum, s) => sum + Number(s.tiu_score || 0), 0) / n;
  const avgTkp = sessionRows.reduce((sum, s) => sum + Number(s.tkp_score || 0), 0) / n;

  const TWK_MAX = 150;
  const TIU_MAX = 175;
  const TKP_MAX = 225;

  let categoryData = [
    { topic: 'TWK', skillScore: Math.min(100, Math.round((avgTwk / TWK_MAX) * 100)) },
    { topic: 'TIU', skillScore: Math.min(100, Math.round((avgTiu / TIU_MAX) * 100)) },
    { topic: 'TKP', skillScore: Math.min(100, Math.round((avgTkp / TKP_MAX) * 100)) },
  ].filter((item) => item.skillScore > 0);

  // Non-CPNS type: compute accuracy per category from answers
  if (!categoryData.length) {
    const sessionIds = sessionRows.map((s) => Number(s.id));
    const catAgg = await safeQuery(
      db,
      `SELECT CASE
                WHEN UPPER(COALESCE(q.category, '')) IN ('TWK', 'TIU', 'TKP')
                  THEN UPPER(COALESCE(q.category, ''))
                ELSE COALESCE(NULLIF(TRIM(p.name), ''), 'LAINNYA')
              END AS topic,
              COUNT(*)::int AS total_answered,
              SUM(CASE WHEN a.is_correct = true THEN 1 ELSE 0 END)::int AS correct_count
       FROM tryout_answers a
       JOIN tryout_sessions ts ON ts.id = a.session_id
       JOIN questions q ON q.id = a.question_id
       LEFT JOIN packages p ON p.id = ts.package_id
       WHERE a.session_id = ANY($1::int[])
       GROUP BY 1`,
      [sessionIds]
    );
    categoryData = catAgg
      .filter((row) => Number(row.total_answered || 0) > 0)
      .map((row) => ({
        topic: String(row.topic || 'LAINNYA').trim(),
        skillScore: Math.round((Number(row.correct_count || 0) / Number(row.total_answered)) * 100),
      }));
  }

  if (!categoryData.length) return null;

  const progressChart = categoryData.map((c) => ({ topic: c.topic, skillScore: c.skillScore }));

  const weaknessInsights = progressChart
    .filter((row) => row.skillScore < 70)
    .map((row) => ({
      topic: row.topic,
      skill_score: row.skillScore,
      weakness_level: row.skillScore < 50 ? 'high' : 'medium',
    }));

  const recommendedNextAction = weaknessInsights.map((row, idx) => ({
    id: idx + 1,
    topic: row.topic,
    recommendation_type: 'review',
    reason:
      row.weakness_level === 'high'
        ? `Tingkatkan latihan ${row.topic}. Capaian saat ini ${row.skill_score}% dari nilai optimal.`
        : `Perbaiki strategi pengerjaan ${row.topic}. Capaian saat ini ${row.skill_score}%.`,
    priority: row.weakness_level === 'high' ? 3 : 2,
  }));

  const studyPlan = [...progressChart]
    .sort((a, b) => a.skillScore - b.skillScore)
    .map((row, index) => ({
      priority: index + 1,
      topic: row.topic,
      action:
        row.skillScore < 50
          ? 'Kerjakan 15 soal latihan dasar + review konsep inti'
          : row.skillScore < 70
            ? 'Kerjakan 10 soal campuran + evaluasi kesalahan'
            : 'Naikkan difficulty dan lakukan challenge set 10 soal',
      targetAccuracy: Math.min(95, row.skillScore + 15),
    }));

  return { progressChart, weaknessInsights, recommendedNextAction, studyPlan };
};

router.get('/adaptive/dashboard', requireAuth, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const userId = req.user.id;

    const performanceRows = await safeQuery(
      db,
      `SELECT topic, skill_score, weakness_level, recommended_difficulty, accuracy, avg_time_ms, total_answered
       FROM topic_performance
       WHERE user_id = $1
       ORDER BY skill_score ASC NULLS LAST`,
      [userId]
    );

    const fallbackSkillRows = performanceRows.length
      ? []
      : await safeQuery(
          db,
          `SELECT topic, skill_score, accuracy, avg_time_ms, total_answered
           FROM user_skills
           WHERE user_id = $1
           ORDER BY skill_score ASC NULLS LAST`,
          [userId]
        );

    const sourceRows = performanceRows.length ? performanceRows : fallbackSkillRows;
    const latestNonCorePackageName = await getLatestNonCorePackageName(db, userId);
    const toDisplayTopic = (topic, packageName) => normalizePackageTopic(topic, packageName || latestNonCorePackageName);

    // No pre-computed data: compute from actual tryout sessions
    if (!sourceRows.length) {
      const computed = await computeAdaptiveFromSessions(db, userId);
      if (computed) return res.json(computed);
      return res.json({ progressChart: [], weaknessInsights: [], recommendedNextAction: [], studyPlan: [] });
    }

    const progressChart = sourceRows.map((row) => ({
      topic: toDisplayTopic(row.topic, row.package_name),
      skillScore: Number(row.skill_score || 0),
    }));

    const weaknessInsights = sourceRows
      .filter((row) => {
        const weakness = String(row.weakness_level || '').toLowerCase();
        if (weakness) return weakness === 'high' || weakness === 'medium';
        return Number(row.skill_score || 0) < 70;
      })
      .map((row) => ({
        topic: toDisplayTopic(row.topic, row.package_name),
        skill_score: Number(row.skill_score || 0),
        weakness_level: row.weakness_level || (Number(row.skill_score || 0) < 55 ? 'high' : 'medium'),
      }));

    const recommendationRows = await safeQuery(
      db,
      `SELECT id, topic, recommendation_type, reason, priority
       FROM recommendations
       WHERE user_id = $1
         AND (status = 'active' OR status IS NULL)
       ORDER BY priority DESC NULLS LAST, created_at DESC NULLS LAST
       LIMIT 5`,
      [userId]
    );

    const recommendedNextAction = recommendationRows.map((row) => {
      const topic = toDisplayTopic(row.topic, row.package_name);
      return {
        id: row.id,
        topic,
        recommendation_type: row.recommendation_type || 'review',
        reason: rewriteReasonTopic(row.reason || 'Lanjutkan latihan bertahap pada topik ini.', row.topic, topic),
        priority: row.priority || 1,
      };
    });

    const studyPlan = sourceRows.slice(0, 5).map((row, index) => {
      const weakness = String(row.weakness_level || '').toLowerCase();
      const action = weakness === 'high'
        ? 'Kerjakan 15 soal latihan dasar + review konsep inti'
        : weakness === 'medium'
          ? 'Kerjakan 10 soal campuran + evaluasi kesalahan'
          : 'Naikkan difficulty dan lakukan challenge set 10 soal';

      return {
        priority: index + 1,
        topic: toDisplayTopic(row.topic, row.package_name),
        action,
        targetAccuracy: Math.min(95, Math.max(70, Math.round(Number(row.accuracy || 0) * 100) + 10)),
      };
    });

    return res.json({
      progressChart,
      weaknessInsights,
      recommendedNextAction,
      studyPlan,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/adaptive/recommendation', requireAuth, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const userId = req.user.id;
    const limit = Math.max(1, Math.min(20, Number(req.query.limit || 5)));
    const rows = await safeQuery(
      db,
      `SELECT id, topic, recommendation_type, reason, priority
       FROM recommendations
       WHERE user_id = $1
         AND (status = 'active' OR status IS NULL)
       ORDER BY priority DESC NULLS LAST, created_at DESC NULLS LAST
       LIMIT $2`,
      [userId, limit]
    );
    return res.json(rows);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/adaptive/study-plan', requireAuth, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const userId = req.user.id;
    const rows = await safeQuery(
      db,
      `SELECT topic, skill_score, weakness_level, accuracy
       FROM topic_performance
       WHERE user_id = $1
       ORDER BY skill_score ASC NULLS LAST
       LIMIT 5`,
      [userId]
    );

    const plan = rows.map((row, index) => ({
      priority: index + 1,
      topic: row.topic,
      action: Number(row.skill_score || 0) < 55
        ? 'Kerjakan 15 soal latihan dasar + review konsep inti'
        : 'Kerjakan 10 soal campuran + evaluasi kesalahan',
      targetAccuracy: Math.min(95, Math.max(70, Math.round(Number(row.accuracy || 0) * 100) + 10)),
    }));

    return res.json(plan);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.post('/adaptive/backfill', requireAuth, async (_req, res) => {
  return res.json({
    message: 'Backfill completed',
    result: { skipped: true, reason: 'Native adaptive service does not require manual backfill' },
  });
});

router.post('/adaptive/submit-answer', requireAuth, async (_req, res) => {
  return res.json({ message: 'Answer processed', result: { skipped: true } });
});

router.post('/adaptive/update-skill', requireAuth, async (_req, res) => {
  return res.json({ message: 'Skill updated', result: { skipped: true } });
});

module.exports = router;
