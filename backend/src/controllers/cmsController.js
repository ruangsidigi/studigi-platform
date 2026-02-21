const cmsService = require('../services/cmsService');

const parseJsonMaybe = (value) => {
  if (!value) return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch (_) {
    return null;
  }
};

const getCategories = async (req, res) => {
  try {
    const data = await cmsService.getCategories();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getPrograms = async (req, res) => {
  try {
    const data = await cmsService.getPrograms(req.query.categoryId);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const createProgram = async (req, res) => {
  try {
    const data = await cmsService.createProgram(req.body);
    res.status(201).json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const getModules = async (req, res) => {
  try {
    const data = await cmsService.getModules(req.query.programId);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const createModule = async (req, res) => {
  try {
    const data = await cmsService.createModule(req.body);
    res.status(201).json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const getContents = async (req, res) => {
  try {
    const data = await cmsService.getContents({
      moduleId: req.query.moduleId,
      status: req.query.status,
      contentType: req.query.contentType,
      includeHidden: String(req.query.includeHidden || 'false') === 'true',
    });
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getPublishedContentsForUsers = async (req, res) => {
  try {
    const data = await cmsService.getPublishedContentsForUsers({
      moduleId: req.query.moduleId,
      contentType: req.query.contentType,
    });
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const uploadContent = async (req, res) => {
  try {
    const payload = parseJsonMaybe(req.body.payload);

    const data = await cmsService.uploadContent({
      existingContentId: req.body.contentId,
      moduleId: req.body.moduleId,
      title: req.body.title,
      description: req.body.description,
      contentType: req.body.contentType,
      status: req.body.status,
      isHidden: String(req.body.isHidden || 'false') === 'true',
      uploadedBy: req.user?.id,
      changeNote: req.body.changeNote,
      payload,
      file: req.file,
    });

    res.status(201).json({
      message: 'Content uploaded with versioning',
      ...data,
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const approveContent = async (req, res) => {
  try {
    const data = await cmsService.updateContentStatus({
      contentId: req.params.contentId,
      status: cmsService.CONTENT_STATUS.REVIEW,
      reviewerId: req.user?.id,
    });
    res.json({ message: 'Content moved to review', content: data });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const publishContent = async (req, res) => {
  try {
    const data = await cmsService.updateContentStatus({
      contentId: req.params.contentId,
      status: cmsService.CONTENT_STATUS.PUBLISHED,
      reviewerId: req.user?.id,
    });
    res.json({ message: 'Content published', content: data });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const archiveContent = async (req, res) => {
  try {
    const data = await cmsService.updateContentStatus({
      contentId: req.params.contentId,
      status: cmsService.CONTENT_STATUS.ARCHIVED,
      reviewerId: req.user?.id,
    });
    res.json({ message: 'Content archived', content: data });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const getVersionHistory = async (req, res) => {
  try {
    const data = await cmsService.getVersionHistory(req.params.contentId);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getWorkflowQueue = async (req, res) => {
  try {
    const data = await cmsService.getWorkflowReviewQueue();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const listBundles = async (req, res) => {
  try {
    const data = await cmsService.listBundles();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const createBundle = async (req, res) => {
  try {
    const data = await cmsService.createBundle({
      name: req.body.name,
      description: req.body.description,
      createdBy: req.user?.id,
    });
    res.status(201).json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const getBundleDetail = async (req, res) => {
  try {
    const data = await cmsService.getBundleDetail(req.params.bundleId);
    res.json(data);
  } catch (error) {
    const status = String(error.message || '').toLowerCase().includes('not found') ? 404 : 500;
    res.status(status).json({ error: error.message });
  }
};

const addBundleItem = async (req, res) => {
  try {
    const data = await cmsService.addBundleItem({
      bundleId: req.params.bundleId,
      contentId: req.body.contentId,
      sortOrder: req.body.sortOrder,
      isHidden: req.body.isHidden,
    });
    res.status(201).json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const removeBundleItem = async (req, res) => {
  try {
    await cmsService.removeBundleItem({ bundleId: req.params.bundleId, itemId: req.params.itemId });
    res.json({ message: 'Bundle item removed' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const trackAnalytics = async (req, res) => {
  try {
    const data = await cmsService.trackAnalytics({
      userId: req.user?.id,
      contentId: req.body.contentId,
      eventType: req.body.eventType,
      progressPercent: req.body.progressPercent,
      sessionId: req.body.sessionId,
      metadata: req.body.metadata,
    });
    res.status(201).json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const getAnalyticsOverview = async (req, res) => {
  try {
    const data = await cmsService.getAnalyticsOverview();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getCategories,
  getPrograms,
  createProgram,
  getModules,
  createModule,
  getContents,
  getPublishedContentsForUsers,
  uploadContent,
  approveContent,
  publishContent,
  archiveContent,
  getVersionHistory,
  getWorkflowQueue,
  listBundles,
  createBundle,
  getBundleDetail,
  addBundleItem,
  removeBundleItem,
  trackAnalytics,
  getAnalyticsOverview,
};
