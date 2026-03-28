const express = require('express');
const supabase = require('../config/supabase');
const { authenticateToken } = require('../middleware/auth');
const { getUserCompletedSessions } = require('../services/dashboard/analyticsEngine');
const { computePassingProbability } = require('../services/dashboard/predictionService');

const router = express.Router();

router.get('/analytics', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const { data: latestSummary, error } = await supabase
      .from('analytics_summary')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) return res.status(400).json({ error: error.message });

    const { data: mastery, error: masteryError } = await supabase
      .from('topic_mastery')
      .select('*')
      .eq('user_id', userId)
      .order('accuracy_percent', { ascending: false });

    if (masteryError) return res.status(400).json({ error: masteryError.message });

    res.json({
      summary: latestSummary || null,
      mastery: mastery || [],
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/progress', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const { data: progress, error } = await supabase
      .from('user_progress')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) return res.status(400).json({ error: error.message });

    const sessions = await getUserCompletedSessions(userId);
    const timeline = sessions.map((session, index) => ({
      index: index + 1,
      attemptId: session.id,
      score: Number(session.total_score || 0),
      date: session.finished_at || session.created_at,
      passed: !!session.is_passed,
    }));

    res.json({
      progress: progress || null,
      timeline,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/recommendations', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const { data, error } = await supabase
      .from('study_recommendations')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('priority', { ascending: true });

    if (error) return res.status(400).json({ error: error.message });

    res.json(data || []);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/gamification', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const [xpRes, streakRes, badgeRes] = await Promise.all([
      supabase.from('user_xp').select('*').eq('user_id', userId).maybeSingle(),
      supabase.from('user_streaks').select('*').eq('user_id', userId).maybeSingle(),
      supabase.from('user_badges').select('*').eq('user_id', userId).order('earned_at', { ascending: false }),
    ]);

    if (xpRes.error) return res.status(400).json({ error: xpRes.error.message });
    if (streakRes.error) return res.status(400).json({ error: streakRes.error.message });
    if (badgeRes.error) return res.status(400).json({ error: badgeRes.error.message });

    res.json({
      xp: xpRes.data || null,
      streak: streakRes.data || null,
      badges: badgeRes.data || [],
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/prediction', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const { data: latestSummary, error } = await supabase
      .from('analytics_summary')
      .select('average_score, trend_score, pass_rate')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) return res.status(400).json({ error: error.message });

    if (!latestSummary) {
      return res.json({
        probability: 0,
        label: 'Low',
        factors: { averageScore: 0, trendScore: 0, passRate: 0 },
      });
    }

    const prediction = computePassingProbability({
      averageScore: latestSummary.average_score,
      trendScore: latestSummary.trend_score,
      passRate: latestSummary.pass_rate,
    });

    res.json(prediction);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
