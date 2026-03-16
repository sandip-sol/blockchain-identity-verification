const logger = require('../services/logger');
const jwt = require('jsonwebtoken');
const Account = require('../models/Account');

const JWT_SECRET = process.env.JWT_SECRET;

/**
 * Admin middleware.
 * Validates JWT, then checks that the account has role === 'admin'.
 * Must be used AFTER body parsing. Attaches req.user on success.
 */
async function adminMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.split(' ')[1];
    let decoded;
    try {
        decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Check role from JWT payload first (fast path)
    if (decoded.role === 'admin') {
        req.user = decoded;
        return next();
    }

    // Fallback: verify against database in case JWT was issued before role promotion
    try {
        const account = await Account.findById(decoded.sub);
        if (!account || account.role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(500).json({ error: 'Authorization check failed' });
    }
}

module.exports = adminMiddleware;
