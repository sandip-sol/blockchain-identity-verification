const logger = require('../services/logger');
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Account = require('../models/Account');
const KYCApplication = require('../models/KYCApplication');
const adminMiddleware = require('../middleware/adminMiddleware');

const router = express.Router();

// All admin routes require admin authentication
router.use(adminMiddleware);

// ────────────── STATS ──────────────

/**
 * GET /api/admin/stats
 * Returns platform-wide statistics.
 */
router.get('/stats', async (req, res) => {
    try {
        const [totalAccounts, todayAccounts, UserModel] = await Promise.all([
            Account.countDocuments(),
            Account.countDocuments({
                createdAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) }
            }),
            getMongoUserModel()
        ]);

        let kycStats = { total: 0, verified: 0, pending: 0, rejected: 0 };
        if (UserModel) {
            const [total, verified, pending, rejected] = await Promise.all([
                UserModel.countDocuments(),
                UserModel.countDocuments({ verificationStatus: 'VERIFIED' }),
                UserModel.countDocuments({ verificationStatus: 'PENDING' }),
                UserModel.countDocuments({ verificationStatus: 'REJECTED' })
            ]);
            kycStats = { total, verified, pending, rejected };
        }

        res.json({
            accounts: {
                total: totalAccounts,
                today: todayAccounts
            },
            kyc: kycStats
        });
    } catch (error) {
        logger.error('Admin stats error:', error);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

// ────────────── ACCOUNTS ──────────────

/**
 * GET /api/admin/accounts
 * List all accounts with pagination and search.
 * Query params: page (default 1), limit (default 20), search (optional)
 */
router.get('/accounts', async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
        const search = req.query.search?.trim();

        const filter = {};
        if (search) {
            filter.$or = [
                { email: { $regex: search, $options: 'i' } },
                { name: { $regex: search, $options: 'i' } }
            ];
        }

        const [accounts, total] = await Promise.all([
            Account.find(filter)
                .select('-password')
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean(),
            Account.countDocuments(filter)
        ]);

        res.json({
            accounts,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        logger.error('Admin list accounts error:', error);
        res.status(500).json({ error: 'Failed to fetch accounts' });
    }
});

/**
 * GET /api/admin/accounts/:id
 * Get single account details.
 */
router.get('/accounts/:id', async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ error: 'Invalid account ID' });
        }

        const account = await Account.findById(req.params.id).select('-password').lean();
        if (!account) {
            return res.status(404).json({ error: 'Account not found' });
        }

        // If the account has a linked wallet, try to fetch KYC user data
        let kycUser = null;
        let kycApplication = null;
        if (account.address) {
            const UserModel = await getMongoUserModel();
            if (UserModel) {
                kycUser = await UserModel.findOne({ walletAddress: account.address.toLowerCase() }).lean();
            }
            kycApplication = await KYCApplication.findOne({ walletAddress: account.address.toLowerCase() })
                .sort({ createdAt: -1 })
                .lean();
        }

        res.json({ account, kycUser, kycApplication });
    } catch (error) {
        logger.error('Admin get account error:', error);
        res.status(500).json({ error: 'Failed to fetch account' });
    }
});

/**
 * DELETE /api/admin/accounts/:id
 * Delete an account. Cannot delete yourself.
 */
router.delete('/accounts/:id', async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ error: 'Invalid account ID' });
        }

        if (req.params.id === req.user.sub) {
            return res.status(400).json({ error: 'Cannot delete your own account' });
        }

        const account = await Account.findByIdAndDelete(req.params.id);
        if (!account) {
            return res.status(404).json({ error: 'Account not found' });
        }

        res.json({ success: true, message: 'Account deleted' });
    } catch (error) {
        logger.error('Admin delete account error:', error);
        res.status(500).json({ error: 'Failed to delete account' });
    }
});

/**
 * POST /api/admin/accounts/:id/reset-password
 * Reset password for an account.
 * Body: { newPassword }
 */
router.post('/accounts/:id/reset-password', async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ error: 'Invalid account ID' });
        }

        const { newPassword } = req.body;
        if (!newPassword || newPassword.length < 8) {
            return res.status(400).json({ error: 'Password must be at least 8 characters' });
        }

        const account = await Account.findById(req.params.id).select('+password');
        if (!account) {
            return res.status(404).json({ error: 'Account not found' });
        }

        account.password = newPassword; // pre-save hook will hash it
        await account.save();

        res.json({ success: true, message: 'Password reset successfully' });
    } catch (error) {
        logger.error('Admin reset password error:', error);
        res.status(500).json({ error: 'Failed to reset password' });
    }
});

// ────────────── KYC USERS ──────────────

/**
 * GET /api/admin/users
 * List all KYC/KYB users from the users collection.
 * Query params: page, limit, status (PENDING/VERIFIED/REJECTED)
 */
router.get('/users', async (req, res) => {
    try {
        const UserModel = await getMongoUserModel();
        if (!UserModel) {
            return res.json({ users: [], pagination: { page: 1, limit: 20, total: 0, pages: 0 } });
        }

        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));

        const filter = {};
        if (req.query.status) {
            filter.verificationStatus = req.query.status.toUpperCase();
        }

        const [users, total] = await Promise.all([
            UserModel.find(filter)
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean(),
            UserModel.countDocuments(filter)
        ]);

        res.json({
            users,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        logger.error('Admin list users error:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

// ────────────── HELPERS ──────────────

/**
 * Safely get the Mongoose User model if MongoDB is connected.
 */
async function getMongoUserModel() {
    if (mongoose.connection.readyState !== 1) return null;
    try {
        return mongoose.model('User');
    } catch {
        return null;
    }
}

module.exports = router;
