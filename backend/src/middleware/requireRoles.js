const Account = require('../models/Account');
const { normalizeRole, hasAnyRole } = require('../services/rbacService');

function requireRoles(allowedRoles = []) {
  return async function roleGuard(req, res, next) {
    try {
      if (!req.user?.sub) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const account = await Account.findById(req.user.sub);
      if (!account) {
        return res.status(401).json({ error: 'Account not found' });
      }

      const normalizedRole = normalizeRole(account.role || req.user.role);
      if (!hasAnyRole(normalizedRole, allowedRoles)) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      req.account = account;
      req.user.role = normalizedRole;
      next();
    } catch (error) {
      next(error);
    }
  };
}

module.exports = requireRoles;
