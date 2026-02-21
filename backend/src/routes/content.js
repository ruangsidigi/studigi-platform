/**
 * Content Routes
 * Handles uploads and management of materials and questions
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const { authenticateToken } = require('../middleware/auth');
const contentController = require('../controllers/contentController');

// Multer configuration for file uploads
const storage = multer.memoryStorage(); // Store in memory before processing
const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max
  },
  fileFilter: (req, file, cb) => {
    const contentType = req.body.contentType;

    if (contentType === 'material') {
      // Only allow PDF
      if (!file.originalname.toLowerCase().endsWith('.pdf')) {
        return cb(new Error('Only PDF files allowed for materials'));
      }
    } else if (contentType === 'question') {
      // Only allow Excel
      const validExtensions = ['.xlsx', '.xls', '.csv'];
      const hasValidExtension = validExtensions.some(ext =>
        file.originalname.toLowerCase().endsWith(ext)
      );
      if (!hasValidExtension) {
        return cb(new Error(`Only Excel files allowed. Supported: ${validExtensions.join(', ')}`));
      }
    }

    cb(null, true);
  },
});

/**
 * POST /api/content/upload
 * Upload content (PDF for material, Excel for questions)
 * Body: { packageId, contentType, visibility, packageName }
 * File: multipart file
 */
router.post(
  '/upload',
  authenticateToken,
  upload.single('file'),
  contentController.uploadContent
);

/**
 * GET /api/content/info/:packageId
 * Get content info for a package
 */
router.get(
  '/info/:packageId',
  authenticateToken,
  contentController.getContentInfo
);

/**
 * PATCH /api/content/:packageId/visibility
 * Update package visibility
 * Body: { visibility }
 */
router.patch(
  '/:packageId/visibility',
  authenticateToken,
  contentController.updateVisibility
);

/**
 * GET /api/content/list
 * Get list of packages with filters
 * Query: ?visibility=visible&contentType=question
 */
router.get(
  '/list',
  authenticateToken,
  contentController.getPackagesList
);

// Error handling middleware for this route
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File size exceeds 50MB limit' });
    }
    return res.status(400).json({ error: error.message });
  }

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  next();
});

module.exports = router;
