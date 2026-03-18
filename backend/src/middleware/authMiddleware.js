const logger = require('../services/logger');
const jwt = require('jsonwebtoken');
const { normalizeRole } = require('../constants/rbac');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    logger.error('❌ FATAL: JWT_SECRET environment variable is required');
    process.exit(1);
}

/**
 * Authentication middleware.
 * Validates JWT from Authorization: Bearer <token> header.
 * Attaches decoded payload to req.user on success.
 */
function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = { ...decoded, role: normalizeRole(decoded.role) };
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
}

module.exports = authMiddleware;
