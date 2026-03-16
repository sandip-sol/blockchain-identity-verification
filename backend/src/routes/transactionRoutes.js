const logger = require('../services/logger');
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const EncryptionService = require('../services/encryptionService');
const ipfsService = require('../services/ipfsService');
const web3Service = require('../services/web3Service');
const multer = require('multer');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

/**
 * @route   POST /api/transaction/tokenize
 * @desc    Tokenize a single transaction
 * @access  Authenticated users
 */
router.post('/tokenize', upload.single('document'), async (req, res) => {
    try {
        const { walletAddress, signature, txType, metadata } = req.body;

        if (!walletAddress || !signature || !txType) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Verify user is KYC verified
        const isVerified = await web3Service.isVerified(walletAddress);
        if (!isVerified) {
            return res.status(403).json({ error: 'User not KYC verified' });
        }

        // Verify signature
        const message = `Tokenize ${txType} transaction for ${walletAddress}`;
        const isValid = web3Service.verifySignature(message, signature, walletAddress);

        if (!isValid) {
            return res.status(401).json({ error: 'Invalid signature' });
        }

        // Prepare transaction data
        const txData = {
            type: txType,
            metadata: JSON.parse(metadata || '{}'),
            document: req.file ? req.file.buffer.toString('base64') : null,
            timestamp: new Date().toISOString(),
            submittedBy: walletAddress
        };

        // Encrypt transaction data
        const encrypted = EncryptionService.encryptData(txData, walletAddress, signature);

        // Upload to IPFS
        const ipfsCID = await ipfsService.uploadToIPFS(encrypted);
        await ipfsService.pinDocument(ipfsCID);

        // Create hashes for blockchain
        const txHash = EncryptionService.hashDataForBlockchain(txData);
        const metadataHash = EncryptionService.hashDataForBlockchain(metadata || '{}');

        // Register transaction on blockchain
        const result = await web3Service.registerTransaction(txHash, txType, metadataHash);

        // Save to user record
        const user = await User.findOne({ walletAddress: walletAddress.toLowerCase() });
        if (user) {
            user.transactionTokens.push({
                tokenId: result.tokenId || 'pending',
                txHash,
                txType,
                timestamp: new Date(),
                blockchainTxHash: result.txHash || null,
                blockNumber: result.blockNumber || null
            });
            await user.save();
        }

        res.status(200).json({
            success: true,
            message: 'Transaction tokenized successfully',
            txHash,
            ipfsCID,
            blockchainTxHash: result.txHash,
            blockNumber: result.blockNumber
        });
    } catch (error) {
        logger.error('Transaction tokenization error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * @route   POST /api/transaction/batch-tokenize
 * @desc    Tokenize multiple transactions in batch
 * @access  Authenticated users
 */
router.post('/batch-tokenize', async (req, res) => {
    try {
        const { walletAddress, signature, transactions } = req.body;

        if (!walletAddress || !signature || !Array.isArray(transactions)) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Verify user is KYC verified
        const isVerified = await web3Service.isVerified(walletAddress);
        if (!isVerified) {
            return res.status(403).json({ error: 'User not KYC verified' });
        }

        const results = [];
        const txHashes = [];
        const txTypes = [];
        const metadataHashes = [];

        for (const tx of transactions) {
            const txData = {
                type: tx.type,
                metadata: tx.metadata || {},
                timestamp: new Date().toISOString(),
                submittedBy: walletAddress
            };

            // Encrypt and upload to IPFS
            const encrypted = EncryptionService.encryptData(txData, walletAddress, signature);
            const ipfsCID = await ipfsService.uploadToIPFS(encrypted);

            // Create hashes
            const txHash = EncryptionService.hashDataForBlockchain(txData);
            const metadataHash = EncryptionService.hashDataForBlockchain(tx.metadata || {});

            txHashes.push(txHash);
            txTypes.push(tx.type);
            metadataHashes.push(metadataHash);

            results.push({ txHash, ipfsCID });
        }

        // Batch register on blockchain (supported by TransactionRegistry)
        const onchain = await web3Service.batchRegisterTransactions(txHashes, txTypes, metadataHashes);

        // Save to user record (best-effort)
        const user = await User.findOne({ walletAddress: walletAddress.toLowerCase() });
        if (user) {
            const tokenIds = Array.isArray(onchain.tokenIds) ? onchain.tokenIds : [];
            results.forEach((r, idx) => {
                user.transactionTokens.push({
                    tokenId: tokenIds[idx] ? String(tokenIds[idx]) : 'pending',
                    txHash: r.txHash,
                    txType: transactions[idx]?.type,
                    timestamp: new Date(),
                    blockchainTxHash: onchain.txHash || null,
                    blockNumber: onchain.blockNumber || null
                });
            });
            await user.save();
        }

        res.status(200).json({
            success: true,
            message: `${transactions.length} transactions processed`,
            results,
            blockchainTxHash: onchain.txHash,
            tokenIds: onchain.tokenIds || [],
            blockNumber: onchain.blockNumber
        });
    } catch (error) {
        logger.error('Batch tokenization error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * @route   POST /api/transaction/verify
 * @desc    Verify transaction exists on-chain
 * @access  Public
 */
router.post('/verify', async (req, res) => {
    try {
        const { txHash } = req.body;

        if (!txHash) {
            return res.status(400).json({ error: 'Transaction hash required' });
        }

        // Verify on blockchain
        const txRegistry = web3Service.contracts.transactionRegistry;
        const result = await txRegistry.verifyTransaction(txHash);

        // ethers v6 returns a Result (array-like). Solidity returns (bool exists, uint256 tokenId, bool isValid).
        const exists = Boolean(result[0]);
        const tokenId = result[1] ? result[1].toString() : '0';
        const isValid = Boolean(result[2]);

        res.status(200).json({ exists, tokenId, isValid });
    } catch (error) {
        logger.error('Transaction verification error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * @route   GET /api/transaction/history/:address
 * @desc    Get user's transaction tokens
 * @access  Public
 */
router.get('/history/:address', async (req, res) => {
    try {
        const { address } = req.params;

        const user = await User.findOne({ walletAddress: address.toLowerCase() });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.status(200).json({
            success: true,
            transactions: user.transactionTokens
        });
    } catch (error) {
        logger.error('Transaction history error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
