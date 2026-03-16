const logger = require('../services/logger');
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
        logger.error('Access request error:', error);
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
        const { accessId, walletAddress, signature, onchainTxHash } = req.body;

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

        // Verify EIP-712 typed-data signature (matches DataAccessControl.grantAccess)
        const domain = await web3Service.getAccessControlDomain();
        const nonce = await web3Service.getAccessNonce(walletAddress);
        const expiresAt = Math.floor(new Date(accessLog.expiresAt).getTime() / 1000);
        const value = {
            requester: accessLog.requester,
            tokenIds: accessLog.tokenIds,
            expiresAt,
            purpose: accessLog.purpose,
            nonce
        };

        const types = {
            AccessGrant: [
                { name: 'requester', type: 'address' },
                { name: 'tokenIds', type: 'uint256[]' },
                { name: 'expiresAt', type: 'uint256' },
                { name: 'purpose', type: 'string' },
                { name: 'nonce', type: 'uint256' }
            ]
        };

        const isValid = web3Service.verifyTypedDataSignature(domain, types, value, signature, walletAddress);
        if (!isValid) return res.status(401).json({ error: 'Invalid EIP-712 signature' });

        // IMPORTANT: The DataAccessControl contract requires msg.sender == dataOwner.
        // So the on-chain grant must be submitted by the user's wallet.
        // If the frontend provides an on-chain tx hash, we will confirm it and store the on-chain accessId.
        let onchainAccessId = null;
        if (onchainTxHash) {
            const receipt = await web3Service.getTxReceipt(onchainTxHash);
            if (!receipt) return res.status(400).json({ error: 'Invalid onchainTxHash (receipt not found)' });

            const eventLog = receipt.logs.find((log) => {
                try {
                    const parsed = web3Service.contracts.accessControl.interface.parseLog(log);
                    return parsed.name === 'AccessGranted';
                } catch {
                    return false;
                }
            });

            if (!eventLog) {
                return res.status(400).json({ error: 'AccessGranted event not found in tx receipt' });
            }

            const parsed = web3Service.contracts.accessControl.interface.parseLog(eventLog);
            const { accessId: emittedAccessId, dataOwner, requester, tokenIds, expiresAt: emittedExpiresAt, purpose } = parsed.args;

            if (dataOwner.toLowerCase() !== walletAddress.toLowerCase()) {
                return res.status(400).json({ error: 'On-chain dataOwner mismatch' });
            }
            if (requester.toLowerCase() !== accessLog.requester.toLowerCase()) {
                return res.status(400).json({ error: 'On-chain requester mismatch' });
            }
            if (purpose !== accessLog.purpose) {
                return res.status(400).json({ error: 'On-chain purpose mismatch' });
            }
            if (Number(emittedExpiresAt) !== expiresAt) {
                return res.status(400).json({ error: 'On-chain expiry mismatch' });
            }
            // tokenIds compare (string compare for safety)
            const a = tokenIds.map((x) => x.toString());
            const b = accessLog.tokenIds.map((x) => x.toString());
            if (a.length !== b.length || a.some((x, i) => x !== b[i])) {
                return res.status(400).json({ error: 'On-chain tokenIds mismatch' });
            }

            onchainAccessId = emittedAccessId;
        }

        // Update access log
        accessLog.status = 'GRANTED';
        accessLog.grantedAt = new Date();
        if (onchainAccessId) accessLog.onchainAccessId = onchainAccessId;
        await accessLog.save();

        res.status(200).json({
            success: true,
            message: 'Access granted successfully',
            accessId,
            onchainAccessId,
            expiresAt: accessLog.expiresAt
        });
    } catch (error) {
        logger.error('Access grant error:', error);
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
        const { accessId, walletAddress, signature, onchainTxHash } = req.body;

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

        // As with grant, revoke must be sent by the data owner's wallet.
        // If the frontend provides an on-chain tx hash, we will confirm AccessRevoked event.
        if (onchainTxHash) {
            const receipt = await web3Service.getTxReceipt(onchainTxHash);
            if (!receipt) return res.status(400).json({ error: 'Invalid onchainTxHash (receipt not found)' });

            const eventLog = receipt.logs.find((log) => {
                try {
                    const parsed = web3Service.contracts.accessControl.interface.parseLog(log);
                    return parsed.name === 'AccessRevoked';
                } catch {
                    return false;
                }
            });

            if (!eventLog) {
                return res.status(400).json({ error: 'AccessRevoked event not found in tx receipt' });
            }

            const parsed = web3Service.contracts.accessControl.interface.parseLog(eventLog);
            const { accessId: emittedAccessId, dataOwner, requester } = parsed.args;

            if (dataOwner.toLowerCase() !== walletAddress.toLowerCase()) {
                return res.status(400).json({ error: 'On-chain dataOwner mismatch' });
            }
            if (requester.toLowerCase() !== accessLog.requester.toLowerCase()) {
                return res.status(400).json({ error: 'On-chain requester mismatch' });
            }

            // If we have stored onchainAccessId, it should match. If not, store it.
            if (accessLog.onchainAccessId && accessLog.onchainAccessId !== emittedAccessId) {
                return res.status(400).json({ error: 'On-chain accessId mismatch' });
            }
            accessLog.onchainAccessId = emittedAccessId;
        }

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
        logger.error('Access revoke error:', error);
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
        logger.error('Access logs error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * @route   GET /api/access/typed-data/:accessId
 * @desc    Return EIP-712 typed data payload for DataAccessControl.grantAccess
 * @access  Public (wallet must sign & send tx themselves)
 */
router.get('/typed-data/:accessId', async (req, res) => {
    try {
        const { accessId } = req.params;
        const accessLog = await AccessLog.findOne({ accessId });
        if (!accessLog) return res.status(404).json({ error: 'Access request not found' });

        const domain = await web3Service.getAccessControlDomain();
        const nonce = await web3Service.getAccessNonce(accessLog.dataOwner);
        const expiresAt = Math.floor(new Date(accessLog.expiresAt).getTime() / 1000);

        const types = {
            AccessGrant: [
                { name: 'requester', type: 'address' },
                { name: 'tokenIds', type: 'uint256[]' },
                { name: 'expiresAt', type: 'uint256' },
                { name: 'purpose', type: 'string' },
                { name: 'nonce', type: 'uint256' }
            ]
        };

        const value = {
            requester: accessLog.requester,
            tokenIds: accessLog.tokenIds,
            expiresAt,
            purpose: accessLog.purpose,
            nonce
        };

        res.status(200).json({ success: true, domain, types, value });
    } catch (error) {
        logger.error('Typed data error:', error);
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

        // Enforce on-chain access control when possible.
        // The on-chain contract tracks grants per-tokenId. We'll allow decrypt only if
        // requester has access to at least one of the requested tokenIds.
        try {
            const checks = await Promise.all(
                accessLog.tokenIds.map((tokenId) =>
                    web3Service.hasAccess(accessLog.requester, accessLog.dataOwner, tokenId)
                )
            );

            const anyAllowed = checks.some(Boolean);
            if (!anyAllowed) {
                return res.status(403).json({ error: 'No valid on-chain access grant found' });
            }
        } catch (e) {
            // If contracts aren't configured (e.g., missing deployment file), fall back to DB checks.
            logger.warn('⚠️ On-chain access check skipped:', e.message);
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
        logger.error('Decryption error:', error);
        res.status(500).json({ error: 'Decryption failed: ' + error.message });
    }
});

module.exports = router;
