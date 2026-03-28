const ROLE_PERMISSIONS = {
  admin: ['upload', 'approve', 'publish', 'archive'],
  content_manager: ['upload'],
  reviewer: ['approve', 'publish', 'archive'],
};

const normalizeRole = (role) => String(role || '').trim().toLowerCase().replace(/\s+/g, '_');

const requireCmsPermission = (permissionCode) => {
  return (req, res, next) => {
    const normalizedRole = normalizeRole(req.user?.role);
    const allowed = ROLE_PERMISSIONS[normalizedRole] || [];

    if (!allowed.includes(permissionCode)) {
      return res.status(403).json({ error: `Forbidden - missing ${permissionCode} permission` });
    }

    next();
  };
};

module.exports = {
  requireCmsPermission,
};
