const express = require('express');
const router = express.Router();
const AccessLog = require('../models/AccessLog');
const User = require('../models/User');
const EncryptionService = require('../services/encryptionService');
const ipfsService = require('../services/ipfsService');
const web3Service = require('../services/web3Service');

/**
 * @route   POST /api/access/request
 * @desc    External party requests access to data
 * @access  Public
 */
router.post('/request', async (req, res) => {
    try {
        const { requester, dataOwner, tokenIds, purpose, expiryHours = 24 } = req.body;

        if (!requester || !dataOwner || !tokenIds || !purpose) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Create access request
        const accessId = `0x${Date.now().toString(16)}${Math.random().toString(16).slice(2, 10)}`;
        const expiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000);

        const accessLog = new AccessLog({
            accessId,
            dataOwner: dataOwner.toLowerCase(),
            requester: requester.toLowerCase(),
            tokenIds,
            purpose,
            status: 'PENDING',
            expiresAt,
            ipAddress: req.ip,
            userAgent: req.get('user-agent')
        });

        await accessLog.save();

        res.status(200).json({
            success: true,
            message: 'Access request created',
            accessId,
            status: 'PENDING',
            expiresAt
        });
    } catch (error) {
        console.error('Access request error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * @route   POST /api/access/grant
 * @desc    User grants access with EIP-712 signature
 * @access  Data owner
 */
router.post('/grant', async (req, res) => {
    try {
        const { accessId, walletAddress, signature } = req.body;

        if (!accessId || !walletAddress || !signature) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const accessLog = await AccessLog.findOne({ accessId });

        if (!accessLog) {
            return res.status(404).json({ error: 'Access request not found' });
        }

        if (accessLog.dataOwner !== walletAddress.toLowerCase()) {
            return res.status(403).json({ error: 'Not authorized' });
        }

        // Verify EIP-712 signature
        // In production, implement proper EIP-712 typed data signature
        const message = `Grant access ${accessId} to ${accessLog.requester}`;
        const isValid = web3Service.verifySignature(message, signature, walletAddress);

        if (!isValid) {
            return res.status(401).json({ error: 'Invalid signature' });
        }

        // Grant access on blockchain (if using AccessControl contract)
        // TODO: Call contract's grantAccess function

        // Update access log
        accessLog.status = 'GRANTED';
        accessLog.grantedAt = new Date();
        await accessLog.save();

        res.status(200).json({
            success: true,
            message: 'Access granted successfully',
            accessId,
            expiresAt: accessLog.expiresAt
        });
    } catch (error) {
        console.error('Access grant error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * @route   POST /api/access/revoke
 * @desc    Revoke previously granted access
 * @access  Data owner
 */
router.post('/revoke', async (req, res) => {
    try {
        const { accessId, walletAddress, signature } = req.body;

        if (!accessId || !walletAddress || !signature) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const accessLog = await AccessLog.findOne({ accessId });

        if (!accessLog) {
            return res.status(404).json({ error: 'Access request not found' });
        }

        if (accessLog.dataOwner !== walletAddress.toLowerCase()) {
            return res.status(403).json({ error: 'Not authorized' });
        }

        // Verify signature
        const message = `Revoke access ${accessId}`;
        const isValid = web3Service.verifySignature(message, signature, walletAddress);

        if (!isValid) {
            return res.status(401).json({ error: 'Invalid signature' });
        }

        // Revoke on blockchain
        // TODO: Call contract's revokeAccess function

        // Update access log
        accessLog.status = 'REVOKED';
        accessLog.revokedAt = new Date();
        await accessLog.save();

        res.status(200).json({
            success: true,
            message: 'Access revoked successfully',
            accessId
        });
    } catch (error) {
        console.error('Access revoke error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * @route   GET /api/access/logs/:address
 * @desc    Get access logs for a user
 * @access  Public (filtered by address)
 */
router.get('/logs/:address', async (req, res) => {
    try {
        const { address } = req.params;
        const { type = 'owner' } = req.query; // 'owner' or 'requester'

        const query = type === 'owner'
            ? { dataOwner: address.toLowerCase() }
            : { requester: address.toLowerCase() };

        const logs = await AccessLog.find(query).sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: logs.length,
            logs
        });
    } catch (error) {
        console.error('Access logs error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * @route   POST /api/access/decrypt
 * @desc    Request decryption of data with valid access
 * @access  Authorized requesters
 */
router.post('/decrypt', async (req, res) => {
    try {
        const { accessId, requester, dataOwnerSignature } = req.body;

        if (!accessId || !requester || !dataOwnerSignature) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const accessLog = await AccessLog.findOne({ accessId });

        if (!accessLog) {
            return res.status(404).json({ error: 'Access request not found' });
        }

        if (!accessLog.isValid()) {
            return res.status(403).json({ error: 'Access expired or revoked' });
        }

        if (accessLog.requester !== requester.toLowerCase()) {
            return res.status(403).json({ error: 'Not authorized' });
        }

        // Get user data
        const user = await User.findOne({ walletAddress: accessLog.dataOwner });

        if (!user || !user.ipfsCID) {
            return res.status(404).json({ error: 'Data not found' });
        }

        // Retrieve encrypted data from IPFS
        const encryptedData = await ipfsService.retrieveFromIPFS(user.ipfsCID);

        // Decrypt data
        const decryptedData = EncryptionService.decryptData(encryptedData, dataOwnerSignature);

        // Update access log
        accessLog.accessCount += 1;
        accessLog.lastAccessedAt = new Date();
        await accessLog.save();

        // Return only non-sensitive metadata or requested fields
        // In production, implement granular field-level access control
        res.status(200).json({
            success: true,
            data: decryptedData,
            accessId,
            accessCount: accessLog.accessCount
        });
    } catch (error) {
        console.error('Decryption error:', error);
        res.status(500).json({ error: 'Decryption failed: ' + error.message });
    }
});

module.exports = router;
