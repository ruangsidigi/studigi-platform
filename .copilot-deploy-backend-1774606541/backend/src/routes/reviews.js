/**
 * Review Routes
 * GET  /reviews/attempt/:attemptId - Get review grid data
 * GET  /reviews/attempt/:attemptId/question/:questionNumber - Get question detail
 * POST /reviews/attempt/:attemptId/bookmark - Toggle bookmark
 * GET  /reviews/attempt/:attemptId/bookmarks - Get bookmarked questions
 */

const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const reviewService = require('../services/reviewService');

const router = express.Router();

// GET /reviews/attempt/:attemptId
// Get all questions for review (for sidebar navigation grid)
router.get('/attempt/:attemptId', authenticateToken, async (req, res) => {
  try {
    const { attemptId } = req.params;
    const userId = req.user.id;

    console.log(`[Review] Fetching attempt ${attemptId} for user ${userId}`);

    const result = await reviewService.getAttemptReview(attemptId, userId);
    
    if (!result.review || result.review.length === 0) {
      return res.status(400).json({ 
        error: 'Attempt tidak memiliki jawaban atau tidak ditemukan',
        attemptId,
        userId
      });
    }

    res.json(result);
  } catch (error) {
    console.error('[Review] Error fetching attempt review:', error.message);
    res.status(400).json({ error: error.message || 'Gagal memuat review' });
  }
});

// GET /reviews/attempt/:attemptId/question/:questionNumber
// Get detailed question data for viewer
router.get('/attempt/:attemptId/question/:questionNumber', authenticateToken, async (req, res) => {
  try {
    const { attemptId, questionNumber } = req.params;
    const userId = req.user.id;

    const result = await reviewService.getQuestionDetail(
      attemptId,
      questionNumber,
      userId
    );
    res.json(result);
  } catch (error) {
    console.error('Error fetching question detail:', error);
    res.status(404).json({ error: error.message });
  }
});

// POST /reviews/attempt/:attemptId/bookmark
// Toggle bookmark for a question
router.post('/attempt/:attemptId/bookmark', authenticateToken, async (req, res) => {
  try {
    const { attemptId } = req.params;
    const { questionId, notes } = req.body;
    const userId = req.user.id;

    if (!questionId) {
      return res.status(400).json({ error: 'questionId required' });
    }

    const result = await reviewService.toggleBookmark(
      attemptId,
      questionId,
      userId,
      notes
    );
    res.json(result);
  } catch (error) {
    console.error('Error toggling bookmark:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /reviews/attempt/:attemptId/bookmarks
// Get all bookmarked questions for a session
router.get('/attempt/:attemptId/bookmarks', authenticateToken, async (req, res) => {
  try {
    const { attemptId } = req.params;
    const userId = req.user.id;

    const bookmarks = await reviewService.getBookmarkedQuestions(attemptId, userId);
    res.json({ bookmarks });
  } catch (error) {
    console.error('Error fetching bookmarks:', error);
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
