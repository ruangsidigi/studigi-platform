import axios from 'axios';

const isLocalHost =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

// In production, always use same-origin /api so rewrites control backend routing.
const API_BASE_URL = isLocalHost
  ? (process.env.REACT_APP_API_URL || 'http://localhost:5000/api')
  : '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// On 401: clear expired token so public endpoints don't keep failing
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      localStorage.removeItem('token');
    }
    return Promise.reject(error);
  }
);

// Auth Service
export const authService = {
  register: (email, password, name) =>
    api.post('/auth/register', { email, password, name }),
  login: (email, password) =>
    api.post('/auth/login', { email, password }),
  verifyEmail: (token) =>
    api.post('/auth/verify-email', { token }),
  resendVerification: (email) =>
    api.post('/auth/resend-verification', { email }),
  forgotPassword: (email) =>
    api.post('/auth/forgot-password', { email }),
  resetPassword: (token, newPassword) =>
    api.post('/auth/reset-password', { token, newPassword }),
};

// Package Service
export const packageService = {
  getAll: () => api.get('/packages', { params: { t: Date.now() } }),
  getById: (id) => api.get(`/packages/${id}`),
  getBundleDetails: (id) => api.get(`/bundles/${id}`),
  getLeaderboard: (id, params = {}) => api.get(`/packages/${id}/leaderboard`, { params }),
  create: (data) => api.post('/packages', data),
  update: (id, data) => api.put(`/packages/${id}`, data),
  delete: (id) => api.delete(`/packages/${id}`),
  deleteAll: () => api.delete('/packages'),
};

// Bundle Service
export const bundleService = {
  getById: (id) => api.get(`/bundles/${id}`),
};

// Question Service
export const questionService = {
  getByPackage: (packageId) => api.get(`/questions/package/${packageId}`),
  getById: (id) => api.get(`/questions/${id}`),
  upload: (packageId, file) => {
    const formData = new FormData();
    formData.append('packageId', packageId);
    formData.append('file', file);
    return api.post('/questions/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  updateQuestion: (id, data) => api.put(`/questions/${id}`, data),
  uploadQuestionImage: (id, formData) =>
    api.post(`/questions/${id}/image`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  delete: (id) => api.delete(`/questions/${id}`),
};

// Tryout Service
export const tryoutService = {
  start: (packageId, participant = {}) => api.post('/tryouts/start', { packageId, ...participant }),
  submitAnswer: (sessionId, questionId, selectedAnswer, extra = {}) =>
    api.post('/tryouts/submit-answer', { sessionId, questionId, selectedAnswer, ...extra }),
  finish: (sessionId) => api.post('/tryouts/finish', { sessionId }),
  getResults: (sessionId) => api.get(`/tryouts/${sessionId}/results`),
};

// Purchase Service
export const purchaseService = {
  getAll: () => api.get('/purchases'),
  create: (packageIds, totalPrice, paymentMethod = 'transfer') =>
    api.post('/purchases', { packageIds, totalPrice, paymentMethod }),
  getAllAdmin: () => api.get('/purchases/admin/all'),
  getAttemptsInfo: (packageId) => api.get(`/purchases/attempts/${packageId}`),
};

export const paymentService = {
  checkout: async (packageIds, paymentMethod = 'manual_transfer', extraPayload = {}) => {
    const rawPackageIds = Array.isArray(packageIds)
      ? packageIds
          .map((item) => (item === null || item === undefined ? '' : String(item).trim()))
          .filter((item) => item.length > 0)
      : [];

    const normalizedPackageIds = rawPackageIds
      .map((item) => Number(item))
      .filter((item) => Number.isInteger(item) && item > 0);

    const preferredPackageIds = normalizedPackageIds.length > 0 ? normalizedPackageIds : rawPackageIds;
    const primaryId = rawPackageIds[0] || normalizedPackageIds[0] || null;

    const { voucherCode, ...rest } = extraPayload;

    const payload = {
      packageIds: preferredPackageIds,
      package_ids: preferredPackageIds,
      rawPackageIds,
      paymentMethod,
      payment_method: paymentMethod,
      ...rest,
    };

    if (voucherCode && String(voucherCode).trim()) {
      payload.voucherCode = String(voucherCode).trim().toUpperCase();
    }

    if (primaryId && rawPackageIds.length === 1) {
      payload.bundle_id = primaryId;
      payload.bundleId = primaryId;
      payload.package_id = primaryId;
    }

    return api.post('/payments/checkout', payload);
  },
  getById: (id) => api.get(`/payments/${id}`),
  confirm: (id, status = 'paid') => api.post(`/payments/${id}/confirm`, { status }),
};

// User Service
export const userService = {
  getProfile: () => api.get('/users/profile'),
  updateProfile: (data) => api.put('/users/profile', data),
};

// Voucher Service
export const voucherService = {
  validate: (code, subtotal) => api.post('/vouchers/validate', { code, subtotal }),
  getAll: () => api.get('/vouchers'),
  getMine: () => api.get('/vouchers/my'),
  create: (data) => api.post('/vouchers', data),
  update: (id, data) => api.put(`/vouchers/${id}`, data),
  remove: (id) => api.delete(`/vouchers/${id}`),
  getUsages: (id) => api.get(`/vouchers/${id}/usages`),
  getReviewRewardConfig: () => api.get('/vouchers/review-reward-config'),
  updateReviewRewardConfig: (data) => api.put('/vouchers/review-reward-config', data),
};

// Admin Service
export const adminService = {
  getStats: () => api.get('/admin/stats'),
  getAllUsers: () => api.get('/admin/users'),
  getTryoutResults: () => api.get('/admin/tryout-results'),
  getRankingByPackage: (packageId) => api.get(`/admin/rankings/package/${packageId}`),
};

// Category Service
export const categoryService = {
  getAll: () => api.get('/categories'),
  getWithPackages: () => api.get('/categories/with-packages'),
  getPackagesByCategory: (id) => api.get(`/categories/${id}/packages`),
  create: (data) => api.post('/categories', data),
  update: (id, data) => api.put(`/categories/${id}`, data),
  delete: (id) => api.delete(`/categories/${id}`),
};

// Material Service
export const materialService = {
  upload: (file, meta = {}) => {
    const formData = new FormData();
    formData.append('file', file);
    if (meta.categoryId) formData.append('categoryId', meta.categoryId);
    if (meta.packageId) formData.append('packageId', meta.packageId);
    if (meta.packageIds) formData.append('packageIds', JSON.stringify(meta.packageIds));
    if (meta.title) formData.append('title', meta.title);
    if (meta.description) formData.append('description', meta.description);
    return api.post('/materials/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  listAdmin: () => api.get('/materials/admin'),
  update: (id, payload) => api.put(`/materials/${id}`, payload),
  delete: (id) => api.delete(`/materials/${id}`),
  attachPackage: (id, packageId) => api.post(`/materials/${id}/packages`, { packageId }),
  detachPackage: (id, packageId) => api.delete(`/materials/${id}/packages/${packageId}`),
  listByPackage: (packageId) => api.get(`/materials/package/${packageId}`),
  listByPackagePreview: (packageId) => api.get(`/materials/package/${packageId}/preview`),
  listMyMaterials: () => api.get('/materials/my'),
  getAccessUrl: (id) => api.get(`/materials/${id}/access`),
  downloadFile: (id) => api.get(`/materials/${id}/file`, { responseType: 'blob' }),
};

// Report Service
export const reportService = {
  getOverview: () => api.get('/reports/overview'),
  getHistory: (page = 1, limit = 10) => api.get(`/reports/history?page=${page}&limit=${limit}`),
  getDetail: (attemptId) => api.get(`/reports/${attemptId}`),
  getAnalytics: () => api.get('/reports/analytics'),
  getQuestionDetail: (attemptId, questionNumber) => 
    api.get(`/reports/attempt/${attemptId}/question/${questionNumber}`),
  getMyRankings: () => api.get('/reports/my-rankings'),
};

// Review Service
export const reviewService = {
  getAttemptReview: (attemptId) => api.get(`/reviews/attempt/${attemptId}`),
  getQuestionDetail: (attemptId, questionNumber) =>
    api.get(`/reviews/attempt/${attemptId}/question/${questionNumber}`),
  toggleBookmark: (attemptId, questionId, notes) =>
    api.post(`/reviews/attempt/${attemptId}/bookmark`, { questionId, notes }),
  getBookmarks: (attemptId) => api.get(`/reviews/attempt/${attemptId}/bookmarks`),
};

export const ratingService = {
  getSessionStatus: (sessionId) => api.get(`/ratings/session/${sessionId}/status`),
  submitSessionReview: (sessionId, payload) => api.post(`/ratings/session/${sessionId}/submit`, payload),
  getPackageReviews: (packageId) => api.get(`/ratings/package/${packageId}`),
  getHighlights: () => api.get('/ratings/highlights'),
};

// Retention Dashboard Service
export const retentionDashboardService = {
  getAnalytics: () => api.get('/dashboard/analytics'),
  getProgress: () => api.get('/dashboard/progress'),
  getRecommendations: () => api.get('/dashboard/recommendations'),
  getGamification: () => api.get('/dashboard/gamification'),
  getPrediction: () => api.get('/dashboard/prediction'),
};

// Content Service (Materials & Questions Upload)
export const contentService = {
  upload: (formData, config = {}) => 
    api.post('/content/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      ...config,
    }),
  getInfo: (packageId) => api.get(`/content/info/${packageId}`),
  updateVisibility: (packageId, visibility) =>
    api.patch(`/content/${packageId}/visibility`, { visibility }),
  getList: (params) => api.get('/content/list', { params }),
};

export const cmsService = {
  getCategories: () => api.get('/cms/categories'),
  getPrograms: (params = {}) => api.get('/cms/programs', { params }),
  createProgram: (payload) => api.post('/cms/programs', payload),
  getModules: (params = {}) => api.get('/cms/modules', { params }),
  createModule: (payload) => api.post('/cms/modules', payload),
  getContents: (params = {}) => api.get('/cms/contents', { params }),
  uploadContent: (formData, config = {}) =>
    api.post('/cms/contents/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      ...config,
    }),
  approveContent: (contentId) => api.post(`/cms/contents/${contentId}/approve`),
  publishContent: (contentId) => api.post(`/cms/contents/${contentId}/publish`),
  archiveContent: (contentId) => api.post(`/cms/contents/${contentId}/archive`),
  getVersionHistory: (contentId) => api.get(`/cms/contents/${contentId}/versions`),
  getWorkflowQueue: () => api.get('/cms/workflow/pending-review'),
  listBundles: () => api.get('/cms/bundles'),
  createBundle: (payload) => api.post('/cms/bundles', payload),
  getBundleDetail: (bundleId) => api.get(`/cms/bundles/${bundleId}`),
  addBundleItem: (bundleId, payload) => api.post(`/cms/bundles/${bundleId}/items`, payload),
  removeBundleItem: (bundleId, itemId) => api.delete(`/cms/bundles/${bundleId}/items/${itemId}`),
  trackAnalytics: (payload) => api.post('/cms/analytics/track', payload),
  getAnalyticsOverview: () => api.get('/cms/analytics/overview'),
};

export const adaptiveService = {
  submitAnswer: (payload) => api.post('/adaptive/submit-answer', payload),
  updateSkill: (payload) => api.post('/adaptive/update-skill', payload),
  getRecommendation: (limit = 5) => api.get(`/adaptive/recommendation?limit=${limit}`),
  getStudyPlan: () => api.get('/adaptive/study-plan'),
  getDashboard: () => api.get('/adaptive/dashboard'),
  backfill: () => api.post('/adaptive/backfill'),
};

export const brandingService = {
  getSettings: () => api.get(`/branding?t=${Date.now()}`),
  updateSettings: (payload) => api.put('/branding', payload),
  uploadLogo: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/branding/logo', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  uploadFavicon: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/admin/upload-favicon', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

export const campaignService = {
  create: (payload) => api.post('/campaigns', payload),
  listAdmin: () => api.get('/campaigns/admin'),
  update: (id, payload) => api.put(`/campaigns/${id}`, payload),
  delete: (id) => api.delete(`/campaigns/${id}`),
  uploadBanner: (id, file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(`/campaigns/${id}/assets`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  evaluate: (triggerSource = 'dashboard') => api.post('/campaigns/evaluate', { triggerSource }),
  getPersonalized: (triggerSource = 'dashboard') => api.get(`/campaigns/personalized?triggerSource=${encodeURIComponent(triggerSource)}`),
  logClick: (campaignId, payload = {}) => api.post(`/campaigns/${campaignId}/click`, payload),
  trackEvent: (eventType, eventData = {}, source = 'frontend') =>
    api.post('/campaigns/events', { eventType, eventData, source }),
};

export default api;
