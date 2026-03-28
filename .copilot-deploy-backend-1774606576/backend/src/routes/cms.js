const express = require('express');
const multer = require('multer');
const { authenticateToken } = require('../middleware/auth');
const { requireCmsPermission } = require('../middleware/cmsPermissions');
const cmsController = require('../controllers/cmsController');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 },
});

router.get('/public/contents', cmsController.getPublishedContentsForUsers);

router.use(authenticateToken);

router.get('/categories', cmsController.getCategories);

router.get('/programs', cmsController.getPrograms);
router.post('/programs', requireCmsPermission('upload'), cmsController.createProgram);

router.get('/modules', cmsController.getModules);
router.post('/modules', requireCmsPermission('upload'), cmsController.createModule);

router.get('/contents', cmsController.getContents);
router.post('/contents/upload', requireCmsPermission('upload'), upload.single('file'), cmsController.uploadContent);
router.post('/contents/:contentId/approve', requireCmsPermission('approve'), cmsController.approveContent);
router.post('/contents/:contentId/publish', requireCmsPermission('publish'), cmsController.publishContent);
router.post('/contents/:contentId/archive', requireCmsPermission('archive'), cmsController.archiveContent);
router.get('/contents/:contentId/versions', cmsController.getVersionHistory);

router.get('/workflow/pending-review', cmsController.getWorkflowQueue);

router.get('/bundles', cmsController.listBundles);
router.post('/bundles', requireCmsPermission('upload'), cmsController.createBundle);
router.get('/bundles/:bundleId', cmsController.getBundleDetail);
router.post('/bundles/:bundleId/items', requireCmsPermission('upload'), cmsController.addBundleItem);
router.delete('/bundles/:bundleId/items/:itemId', requireCmsPermission('upload'), cmsController.removeBundleItem);

router.post('/analytics/track', cmsController.trackAnalytics);
router.get('/analytics/overview', cmsController.getAnalyticsOverview);

router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File size exceeds 100MB limit' });
    }
    return res.status(400).json({ error: error.message });
  }

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  next();
});

module.exports = router;
