const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { ethers } = require('ethers');

const Account = require('../models/Account');
const LoginNonce = require('../models/LoginNonce');

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

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

// ============ EMAIL/PASSWORD AUTHENTICATION ============

/**
 * POST /api/auth/register
 * Body: { email, password, name? }
 * Creates a new account with email/password.
 */
router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

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
      { sub: account._id, email: account.email, typ: 'email', iat: Math.floor(Date.now() / 1000) },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Return account without password
    const accountData = { _id: account._id, email: account.email, name: account.name, createdAt: account.createdAt };

    res.status(201).json({ token, account: accountData });
  } catch (error) {
    console.error('Registration error:', error.message);
    console.error('Full error:', error);

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
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

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
      { sub: account._id, email: account.email, typ: 'email', iat: Math.floor(Date.now() / 1000) },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Return account without password
    const accountData = {
      _id: account._id,
      email: account.email,
      name: account.name,
      address: account.address,
      createdAt: account.createdAt
    };

    res.json({ token, account: accountData });
  } catch (error) {
    console.error('Login error:', error);
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
router.post('/link-wallet', async (req, res) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.split(' ')[1];
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch {
      return res.status(401).json({ error: 'Invalid token' });
    }

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
    const account = await Account.findByIdAndUpdate(
      decoded.sub,
      { $set: { address: addr } },
      { new: true }
    );

    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    res.json({ success: true, address: addr, account: { _id: account._id, email: account.email, address: account.address } });
  } catch (error) {
    console.error('Link wallet error:', error);
    res.status(500).json({ error: 'Failed to link wallet' });
  }
});

module.exports = router;
