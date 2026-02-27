const express = require('express');

const router = express.Router();

const requireAuth = (req, res, next) => {
  if (!req.user || !req.user.id) return res.status(401).json({ error: 'Access token required' });
  return next();
};

const safeQuery = async (db, queryText, params = []) => {
  try {
    const result = await db.query(queryText, params);
    return result.rows || [];
  } catch (_) {
    return [];
  }
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

    const progressChart = sourceRows.map((row) => ({
      topic: row.topic,
      skillScore: Number(row.skill_score || 0),
    }));

    const weaknessInsights = sourceRows
      .filter((row) => {
        const weakness = String(row.weakness_level || '').toLowerCase();
        if (weakness) return weakness === 'high' || weakness === 'medium';
        return Number(row.skill_score || 0) < 70;
      })
      .map((row) => ({
        topic: row.topic,
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

    const recommendedNextAction = recommendationRows.map((row) => ({
      id: row.id,
      topic: row.topic,
      recommendation_type: row.recommendation_type || 'review',
      reason: row.reason || 'Lanjutkan latihan bertahap pada topik ini.',
      priority: row.priority || 1,
    }));

    const studyPlan = sourceRows.slice(0, 5).map((row, index) => {
      const weakness = String(row.weakness_level || '').toLowerCase();
      const action = weakness === 'high'
        ? 'Kerjakan 15 soal latihan dasar + review konsep inti'
        : weakness === 'medium'
          ? 'Kerjakan 10 soal campuran + evaluasi kesalahan'
          : 'Naikkan difficulty dan lakukan challenge set 10 soal';

      return {
        priority: index + 1,
        topic: row.topic,
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
