const supabase = require('../config/supabase');
const fileStorageService = require('./fileStorageService');

const CONTENT_STATUS = {
  DRAFT: 'draft',
  REVIEW: 'review',
  PUBLISHED: 'published',
  ARCHIVED: 'archived',
};

const CONTENT_TYPES = ['pdf_material', 'quiz', 'tryout'];

const ensureContentType = (contentType) => {
  if (!CONTENT_TYPES.includes(contentType)) {
    throw new Error(`Invalid content type: ${contentType}`);
  }
};

const getCategories = async () => {
  const { data, error } = await supabase
    .from('categories')
    .select('id, name, description, created_at')
    .order('name', { ascending: true });

  if (error) throw new Error(error.message);
  return data || [];
};

const getPrograms = async (categoryId) => {
  let query = supabase
    .from('programs')
    .select('id, category_id, name, description, created_at, updated_at')
    .order('id', { ascending: false });

  if (categoryId) query = query.eq('category_id', Number(categoryId));

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data || [];
};

const createProgram = async ({ categoryId, name, description }) => {
  if (!categoryId || !name) throw new Error('categoryId and name are required');

  const { data, error } = await supabase
    .from('programs')
    .insert([{ category_id: Number(categoryId), name, description: description || null, updated_at: new Date().toISOString() }])
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
};

const getModules = async (programId) => {
  let query = supabase
    .from('modules')
    .select('id, program_id, name, description, sort_order, created_at, updated_at')
    .order('sort_order', { ascending: true });

  if (programId) query = query.eq('program_id', Number(programId));

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data || [];
};

const createModule = async ({ programId, name, description, sortOrder = 0 }) => {
  if (!programId || !name) throw new Error('programId and name are required');

  const { data, error } = await supabase
    .from('modules')
    .insert([{ program_id: Number(programId), name, description: description || null, sort_order: Number(sortOrder) || 0, updated_at: new Date().toISOString() }])
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
};

const getContents = async ({ moduleId, status, contentType, includeHidden = false }) => {
  let query = supabase
    .from('contents')
    .select('id, module_id, title, slug, description, content_type, status, is_hidden, current_version, created_by, reviewer_id, published_at, archived_at, created_at, updated_at')
    .order('updated_at', { ascending: false });

  if (moduleId) query = query.eq('module_id', Number(moduleId));
  if (status) query = query.eq('status', status);
  if (contentType) query = query.eq('content_type', contentType);
  if (!includeHidden) query = query.eq('is_hidden', false);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data || [];
};

const getPublishedContentsForUsers = async ({ moduleId, contentType }) => {
  let query = supabase
    .from('contents')
    .select('id, module_id, title, slug, description, content_type, status, current_version, published_at, created_at, updated_at')
    .eq('status', CONTENT_STATUS.PUBLISHED)
    .eq('is_hidden', false)
    .order('published_at', { ascending: false });

  if (moduleId) query = query.eq('module_id', Number(moduleId));
  if (contentType) query = query.eq('content_type', contentType);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data || [];
};

const uploadContent = async ({
  existingContentId,
  moduleId,
  title,
  description,
  contentType,
  status = CONTENT_STATUS.DRAFT,
  isHidden = false,
  uploadedBy,
  changeNote,
  payload,
  file,
}) => {
  ensureContentType(contentType);

  let contentRow = null;

  if (existingContentId) {
    const { data, error } = await supabase
      .from('contents')
      .select('*')
      .eq('id', existingContentId)
      .single();

    if (error || !data) throw new Error('Content not found for versioning');
    contentRow = data;
  } else {
    if (!moduleId || !title) throw new Error('moduleId and title are required for new content');

    const { data, error } = await supabase
      .from('contents')
      .insert([{
        module_id: Number(moduleId),
        title,
        slug: String(title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
        description: description || null,
        content_type: contentType,
        status,
        is_hidden: Boolean(isHidden),
        current_version: 1,
        created_by: uploadedBy || null,
        updated_at: new Date().toISOString(),
      }])
      .select()
      .single();

    if (error) throw new Error(error.message);
    contentRow = data;
  }

  const nextVersion = existingContentId ? Number(contentRow.current_version || 1) + 1 : 1;

  let uploadResult = { path: null, publicUrl: null };
  if (file) {
    const targetFolder = `cms/${contentType}`;
    try {
      uploadResult = await fileStorageService.uploadToSupabase(
        file.buffer,
        file.originalname,
        'materials',
        targetFolder
      );
    } catch (error) {
      const localPath = await fileStorageService.uploadToLocalStorage(file.buffer, file.originalname, targetFolder.replace(/\//g, '-'));
      uploadResult = {
        path: localPath,
        publicUrl: `http://localhost:5000${localPath}`,
      };
    }
  }

  const versionPayload = payload ? payload : null;

  const { data: version, error: versionError } = await supabase
    .from('content_versions')
    .insert([{
      content_id: contentRow.id,
      version_number: nextVersion,
      file_path: uploadResult.path,
      file_url: uploadResult.publicUrl,
      payload: versionPayload,
      change_note: changeNote || null,
      uploaded_by: uploadedBy || null,
      created_at: new Date().toISOString(),
    }])
    .select()
    .single();

  if (versionError) throw new Error(versionError.message);

  const { data: updatedContent, error: contentUpdateError } = await supabase
    .from('contents')
    .update({
      current_version: nextVersion,
      updated_at: new Date().toISOString(),
      status: existingContentId ? contentRow.status : status,
      is_hidden: existingContentId ? contentRow.is_hidden : Boolean(isHidden),
    })
    .eq('id', contentRow.id)
    .select()
    .single();

  if (contentUpdateError) throw new Error(contentUpdateError.message);

  return {
    content: updatedContent,
    version,
  };
};

const updateContentStatus = async ({ contentId, status, reviewerId = null }) => {
  const updates = {
    status,
    updated_at: new Date().toISOString(),
  };

  if (status === CONTENT_STATUS.PUBLISHED) updates.published_at = new Date().toISOString();
  if (status === CONTENT_STATUS.ARCHIVED) updates.archived_at = new Date().toISOString();
  if (reviewerId) updates.reviewer_id = reviewerId;

  const { data, error } = await supabase
    .from('contents')
    .update(updates)
    .eq('id', contentId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
};

const getVersionHistory = async (contentId) => {
  const { data, error } = await supabase
    .from('content_versions')
    .select('id, content_id, version_number, file_path, file_url, payload, change_note, uploaded_by, created_at')
    .eq('content_id', contentId)
    .order('version_number', { ascending: false });

  if (error) throw new Error(error.message);
  return data || [];
};

const getWorkflowReviewQueue = async () => {
  const { data, error } = await supabase
    .from('contents')
    .select('id, module_id, title, content_type, status, current_version, created_by, updated_at')
    .in('status', [CONTENT_STATUS.DRAFT, CONTENT_STATUS.REVIEW])
    .order('updated_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data || [];
};

const listBundles = async () => {
  const { data, error } = await supabase
    .from('bundles')
    .select('id, name, description, is_active, created_by, created_at, updated_at')
    .order('id', { ascending: false });

  if (error) throw new Error(error.message);
  return data || [];
};

const createBundle = async ({ name, description, createdBy }) => {
  if (!name) throw new Error('name is required');

  const { data, error } = await supabase
    .from('bundles')
    .insert([{ name, description: description || null, created_by: createdBy || null, updated_at: new Date().toISOString() }])
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
};

const addBundleItem = async ({ bundleId, contentId, sortOrder = 0, isHidden = false }) => {
  const { data, error } = await supabase
    .from('bundle_items')
    .insert([{ bundle_id: Number(bundleId), content_id: contentId, sort_order: Number(sortOrder) || 0, is_hidden: Boolean(isHidden) }])
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
};

const removeBundleItem = async ({ bundleId, itemId }) => {
  const { error } = await supabase
    .from('bundle_items')
    .delete()
    .eq('bundle_id', Number(bundleId))
    .eq('id', Number(itemId));

  if (error) throw new Error(error.message);
  return true;
};

const getBundleDetail = async (bundleId) => {
  const { data: bundle, error: bundleError } = await supabase
    .from('bundles')
    .select('id, name, description, is_active, created_by, created_at, updated_at')
    .eq('id', Number(bundleId))
    .single();

  if (bundleError || !bundle) throw new Error(bundleError?.message || 'Bundle not found');

  const { data: items, error: itemError } = await supabase
    .from('bundle_items')
    .select('id, bundle_id, content_id, sort_order, is_hidden, created_at, contents(id, title, status, content_type)')
    .eq('bundle_id', Number(bundleId))
    .order('sort_order', { ascending: true });

  if (itemError) throw new Error(itemError.message);

  return {
    bundle,
    items: items || [],
  };
};

const trackAnalytics = async ({ userId, contentId, eventType, progressPercent, sessionId, metadata }) => {
  const { data, error } = await supabase
    .from('analytics')
    .insert([{
      user_id: userId || null,
      content_id: contentId,
      event_type: eventType,
      progress_percent: progressPercent ?? null,
      session_id: sessionId || null,
      metadata: metadata || null,
    }])
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
};

const getAnalyticsOverview = async () => {
  const { count: totalViews, error: viewError } = await supabase
    .from('analytics')
    .select('id', { count: 'exact', head: true })
    .eq('event_type', 'view');

  if (viewError) throw new Error(viewError.message);

  const { data: progressData, error: progressError } = await supabase
    .from('analytics')
    .select('progress_percent')
    .eq('event_type', 'progress');

  if (progressError) throw new Error(progressError.message);

  const { count: completionCount, error: completionError } = await supabase
    .from('analytics')
    .select('id', { count: 'exact', head: true })
    .eq('event_type', 'completion');

  if (completionError) throw new Error(completionError.message);

  const avgProgress = (progressData || []).length
    ? (progressData.reduce((sum, row) => sum + Number(row.progress_percent || 0), 0) / progressData.length)
    : 0;

  const completionRate = totalViews > 0 ? (Number(completionCount || 0) / Number(totalViews || 1)) * 100 : 0;

  return {
    views: Number(totalViews || 0),
    progress: Number(avgProgress.toFixed(2)),
    completionRate: Number(completionRate.toFixed(2)),
  };
};

module.exports = {
  CONTENT_STATUS,
  CONTENT_TYPES,
  getCategories,
  getPrograms,
  createProgram,
  getModules,
  createModule,
  getContents,
  getPublishedContentsForUsers,
  uploadContent,
  updateContentStatus,
  getVersionHistory,
  getWorkflowReviewQueue,
  listBundles,
  createBundle,
  addBundleItem,
  removeBundleItem,
  getBundleDetail,
  trackAnalytics,
  getAnalyticsOverview,
};
