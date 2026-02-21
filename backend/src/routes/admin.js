const express = require('express');
const multer = require('multer');
const supabase = require('../config/supabase');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// Dashboard stats
router.get('/stats', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    // Total users
    const { count: totalUsers } = await supabase
      .from('users')
      .select('id', { count: 'exact', head: true });

    // Total packages
    const { count: totalPackages } = await supabase
      .from('packages')
      .select('id', { count: 'exact', head: true });

    // Total purchases
    const { count: totalPurchases } = await supabase
      .from('purchases')
      .select('id', { count: 'exact', head: true });

    // Revenue
    const { data: revenueData } = await supabase
      .from('purchases')
      .select('total_price');

    const totalRevenue = revenueData ? revenueData.reduce((sum, p) => sum + (p.total_price || 0), 0) : 0;

    // Recent purchases
    const { data: recentPurchases } = await supabase
      .from('purchases')
      .select('*, users(name, email), packages(name)')
      .order('created_at', { ascending: false })
      .limit(5);

    res.json({
      stats: {
        totalUsers,
        totalPackages,
        totalPurchases,
        totalRevenue,
      },
      recentPurchases,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all users
router.get('/users', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const { data: users, error } = await supabase
      .from('users')
      .select('id, name, email, role, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get tryout results
router.get('/tryout-results', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const { data: results, error } = await supabase
      .from('tryout_sessions')
      .select('*, users(name, email), packages(name, type)')
      .eq('status', 'completed')
      .order('finished_at', { ascending: false });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get ranking by package (best attempt per user)
router.get('/rankings/package/:packageId', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const { packageId } = req.params;

    const { data: sessions, error } = await supabase
      .from('tryout_sessions')
      .select('id, user_id, package_id, started_at, finished_at, twk_score, tiu_score, tkp_score, total_score, is_passed, users(name, email), packages(name)')
      .eq('package_id', packageId)
      .eq('status', 'completed');

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    const bestByUser = new Map();

    (sessions || []).forEach((session) => {
      const userId = session.user_id;
      const current = bestByUser.get(userId);

      const totalScore = Number(session.total_score || 0);
      const currentScore = Number(current?.total_score || 0);

      const sessionDuration = session.started_at && session.finished_at
        ? Math.max(0, new Date(session.finished_at).getTime() - new Date(session.started_at).getTime())
        : Number.MAX_SAFE_INTEGER;
      const currentDuration = current?.started_at && current?.finished_at
        ? Math.max(0, new Date(current.finished_at).getTime() - new Date(current.started_at).getTime())
        : Number.MAX_SAFE_INTEGER;

      if (!current || totalScore > currentScore || (totalScore === currentScore && sessionDuration < currentDuration)) {
        bestByUser.set(userId, session);
      }
    });

    const ranking = Array.from(bestByUser.values())
      .sort((a, b) => {
        const scoreDiff = Number(b.total_score || 0) - Number(a.total_score || 0);
        if (scoreDiff !== 0) return scoreDiff;

        const durationA = a.started_at && a.finished_at
          ? Math.max(0, new Date(a.finished_at).getTime() - new Date(a.started_at).getTime())
          : Number.MAX_SAFE_INTEGER;
        const durationB = b.started_at && b.finished_at
          ? Math.max(0, new Date(b.finished_at).getTime() - new Date(b.started_at).getTime())
          : Number.MAX_SAFE_INTEGER;

        return durationA - durationB;
      })
      .map((session, index) => {
        const durationMs = session.started_at && session.finished_at
          ? Math.max(0, new Date(session.finished_at).getTime() - new Date(session.started_at).getTime())
          : null;

        return {
          rank: index + 1,
          session_id: session.id,
          user_id: session.user_id,
          user_name: session.users?.name || '-',
          user_email: session.users?.email || '-',
          package_id: session.package_id,
          package_name: session.packages?.name || '-',
          twk_score: session.twk_score || 0,
          tiu_score: session.tiu_score || 0,
          tkp_score: session.tkp_score || 0,
          total_score: session.total_score || 0,
          is_passed: session.is_passed,
          finished_at: session.finished_at,
          duration_ms: durationMs,
        };
      });

    res.json({
      packageId: Number(packageId),
      participant_count: ranking.length,
      ranking,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Upload favicon (admin)
router.post('/upload-favicon', authenticateToken, authorizeRole(['admin']), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'File is required' });
    const fileExt = (req.file.originalname.split('.').pop() || 'ico').toLowerCase();
    const filename = `favicon/favicon.${fileExt}`;

    // upload to 'materials' bucket so we reuse existing storage
    const { data: uploadData, error: uploadError } = await supabase.storage.from('materials').upload(filename, req.file.buffer, { contentType: req.file.mimetype, upsert: true });
    if (uploadError) return res.status(500).json({ error: uploadError.message });

    const { data: publicUrlData } = supabase.storage.from('materials').getPublicUrl(filename);
    const publicUrl = publicUrlData?.publicUrl || null;
    res.json({ message: 'Favicon uploaded', publicUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

