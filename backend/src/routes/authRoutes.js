const logger = require('../services/logger');
const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { ethers } = require('ethers');
const Joi = require('joi');

const Account = require('../models/Account');
const LoginNonce = require('../models/LoginNonce');
const authMiddleware = require('../middleware/authMiddleware');
const ipfsService = require('../services/ipfsService');
const { sha256Hex } = require('../utils/proofUtils');
const { parseStoredSignaturePng } = require('../utils/signatureUtils');

const router = express.Router();

// Validation schemas
const registerSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'Please provide a valid email address',
    'any.required': 'Email is required'
  }),
  password: Joi.string().min(8).required().messages({
    'string.min': 'Password must be at least 8 characters',
    'any.required': 'Password is required'
  }),
  name: Joi.string().trim().max(100).optional()
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required()
});

const signatureUploadSchema = Joi.object({
  signatureImageBase64: Joi.string().trim().required(),
});

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  logger.error('❌ FATAL: JWT_SECRET environment variable is required');
  process.exit(1);
}

function normalizeAddress(addr) {
  try {
    return ethers.getAddress(addr);
  } catch {
    return null;
  }
}

function buildLoginMessage(address, nonce) {
  return `Login to KYC/KYB Platform\nAddress: ${address}\nNonce: ${nonce}`;
}

function serializeAccount(account) {
  if (!account) return null;
  return {
    _id: account._id,
    email: account.email,
    name: account.name,
    role: account.role || 'user',
    address: account.address,
    createdAt: account.createdAt,
    signatureAsset: account.signatureAsset?.cid ? {
      hash: account.signatureAsset.hash || null,
      contentType: account.signatureAsset.contentType || 'image/png',
      width: account.signatureAsset.width || null,
      height: account.signatureAsset.height || null,
      uploadedAt: account.signatureAsset.uploadedAt || null,
      walletAddress: account.signatureAsset.walletAddress || null,
      hasSignature: true,
    } : {
      hasSignature: false,
    },
  };
}

// ============ EMAIL/PASSWORD AUTHENTICATION ============

/**
 * POST /api/auth/register
 * Body: { email, password, name? }
 * Creates a new account with email/password.
 */
router.post('/register', async (req, res) => {
  try {
    const { error, value } = registerSchema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({ error: error.details.map(d => d.message).join(', ') });
    }

    const { email, password, name } = value;

    // Check if email already exists
    const existing = await Account.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    // Create new account
    const account = await Account.create({
      email: email.toLowerCase(),
      password,
      name: name || undefined
    });

    // Generate JWT
    const token = jwt.sign(
      { sub: account._id, email: account.email, role: account.role || 'user', typ: 'email', iat: Math.floor(Date.now() / 1000) },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Return account without password
    const accountData = serializeAccount(account);

    res.status(201).json({ token, account: accountData });
  } catch (error) {
    logger.error('Registration error:', error.message);
    logger.error('Full error:', error);

    // Handle MongoDB duplicate key error
    if (error.code === 11000) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    res.status(500).json({ error: 'Registration failed' });
  }
});

/**
 * POST /api/auth/login
 * Body: { email, password }
 * Authenticates with email/password and returns JWT token.
 */
router.post('/login', async (req, res) => {
  try {
    const { error, value } = loginSchema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({ error: error.details.map(d => d.message).join(', ') });
    }

    const { email, password } = value;

    // Find account with password field included
    const account = await Account.findOne({ email: email.toLowerCase() }).select('+password');
    if (!account) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Verify password
    const isValid = await account.comparePassword(password);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Update last login
    account.lastLoginAt = new Date();
    await account.save();

    // Generate JWT
    const token = jwt.sign(
      { sub: account._id, email: account.email, role: account.role || 'user', typ: 'email', iat: Math.floor(Date.now() / 1000) },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Return account without password
    const accountData = serializeAccount(account);

    res.json({ token, account: accountData });
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// ============ WALLET AUTHENTICATION (for blockchain ops) ============

/**
 * GET /api/auth/nonce?address=0x...
 * Returns a short-lived nonce to sign for wallet linking.
 */
router.get('/nonce', async (req, res) => {
  const addr = normalizeAddress(req.query.address);
  if (!addr) return res.status(400).json({ error: 'Invalid address' });

  const nonce = crypto.randomBytes(16).toString('hex');
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

  // Clear old nonces for this address
  await LoginNonce.deleteMany({ address: addr });
  await LoginNonce.create({ address: addr, nonce, expiresAt });

  res.json({ address: addr, nonce, expiresAt: expiresAt.toISOString(), message: buildLoginMessage(addr, nonce) });
});

/**
 * POST /api/auth/link-wallet
 * Body: { address, nonce, signature }
 * Links a wallet address to the authenticated account.
 * Requires JWT token in Authorization header.
 */
router.post('/link-wallet', authMiddleware, async (req, res) => {
  try {
    const addr = normalizeAddress(req.body.address);
    const { nonce, signature } = req.body || {};

    if (!addr || !nonce || !signature) {
      return res.status(400).json({ error: 'Missing address, nonce, or signature' });
    }

    const record = await LoginNonce.findOne({ address: addr, nonce });
    if (!record) return res.status(401).json({ error: 'Invalid or expired nonce' });
    if (record.expiresAt.getTime() < Date.now()) {
      await LoginNonce.deleteMany({ address: addr });
      return res.status(401).json({ error: 'Nonce expired' });
    }

    const msg = buildLoginMessage(addr, nonce);
    let recovered;
    try {
      recovered = ethers.verifyMessage(msg, signature);
    } catch {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    if (normalizeAddress(recovered) !== addr) {
      return res.status(401).json({ error: 'Signature does not match address' });
    }

    // Consume nonce
    await LoginNonce.deleteMany({ address: addr });

    // Link wallet to account
    const existingAccount = await Account.findById(req.user.sub);
    if (!existingAccount) {
      return res.status(404).json({ error: 'Account not found' });
    }

    const walletChanged = existingAccount.address && normalizeAddress(existingAccount.address) !== addr;
    existingAccount.address = addr;
    if (walletChanged) {
      existingAccount.signatureAsset = undefined;
    }
    const account = await existingAccount.save();

    res.json({ success: true, address: addr, account: serializeAccount(account) });
  } catch (error) {
    logger.error('Link wallet error:', error);
    res.status(500).json({ error: 'Failed to link wallet' });
  }
});

router.get('/me', authMiddleware, async (req, res) => {
  try {
    const account = await Account.findById(req.user.sub);
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }
    res.json({ account: serializeAccount(account) });
  } catch (error) {
    logger.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to load account' });
  }
});

router.post('/signature', authMiddleware, async (req, res) => {
  try {
    const { error, value } = signatureUploadSchema.validate(req.body, { abortEarly: false, stripUnknown: true });
    if (error) {
      return res.status(400).json({ error: error.details.map((detail) => detail.message).join(', ') });
    }

    const account = await Account.findById(req.user.sub);
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }
    if (!account.address) {
      return res.status(400).json({ error: 'Link a wallet before uploading a reusable signature' });
    }

    const parsed = parseStoredSignaturePng(value.signatureImageBase64);
    const hash = sha256Hex(parsed.bytes);
    const cid = await ipfsService.uploadRaw(parsed.bytes, `account-signature-${account._id}.png`);

    account.signatureAsset = {
      cid,
      hash,
      contentType: parsed.contentType,
      width: parsed.width,
      height: parsed.height,
      uploadedAt: new Date(),
      walletAddress: account.address,
    };
    await account.save();

    res.json({
      success: true,
      account: serializeAccount(account),
    });
  } catch (error) {
    logger.error('Signature upload error:', error);
    res.status(500).json({ error: error.message || 'Failed to upload signature' });
  }
});

router.delete('/signature', authMiddleware, async (req, res) => {
  try {
    const account = await Account.findById(req.user.sub);
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    account.signatureAsset = undefined;
    await account.save();

    res.json({
      success: true,
      account: serializeAccount(account),
    });
  } catch (error) {
    logger.error('Signature delete error:', error);
    res.status(500).json({ error: 'Failed to remove signature' });
  }
});

module.exports = router;
