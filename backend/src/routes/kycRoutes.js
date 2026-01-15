const express = require('express');
const router = express.Router();
const User = require('../models/User');
const EncryptionService = require('../services/encryptionService');
const ipfsService = require('../services/ipfsService');
const web3Service = require('../services/web3Service');
const multer = require('multer');

// Configure multer for file uploads
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

/**
 * @route   POST /api/kyc/submit
 * @desc    Submit KYC data for verification
 * @access  Public (with wallet signature)
 */
router.post('/submit', upload.fields([
    { name: 'governmentId', maxCount: 1 },
    { name: 'addressProof', maxCount: 1 },
    { name: 'selfie', maxCount: 1 }
]), async (req, res) => {
    try {
        const { walletAddress, signature, kycData } = req.body;

        if (!walletAddress || !signature || !kycData) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Verify signature
        const message = `Submit KYC for ${walletAddress}`;
        const isValid = web3Service.verifySignature(message, signature, walletAddress);

        if (!isValid) {
            return res.status(401).json({ error: 'Invalid signature' });
        }

        // Parse KYC data
        const parsedKycData = JSON.parse(kycData);

        // Combine all data including files
        const fullKycData = {
            ...parsedKycData,
            governmentId: req.files.governmentId ? req.files.governmentId[0].buffer.toString('base64') : null,
            addressProof: req.files.addressProof ? req.files.addressProof[0].buffer.toString('base64') : null,
            selfie: req.files.selfie ? req.files.selfie[0].buffer.toString('base64') : null,
            submittedAt: new Date().toISOString()
        };

        // Encrypt data
        const encrypted = EncryptionService.encryptData(fullKycData, walletAddress, signature);

        // Upload to IPFS
        const ipfsCID = await ipfsService.uploadToIPFS(encrypted);
        await ipfsService.pinDocument(ipfsCID);

        // Create hash for blockchain
        const dataHash = EncryptionService.hashDataForBlockchain(fullKycData);

        // Save to database
        let user = await User.findOne({ walletAddress: walletAddress.toLowerCase() });

        if (!user) {
            user = new User({
                walletAddress: walletAddress.toLowerCase(),
                verificationType: 'KYC',
                verificationStatus: 'PENDING',
                dataHash,
                ipfsCID,
                kycData: {
                    fullName: parsedKycData.fullName,
                    email: parsedKycData.email,
                    phoneNumber: parsedKycData.phoneNumber,
                    nationality: parsedKycData.nationality
                }
            });
        } else {
            user.verificationType = 'KYC';
            user.verificationStatus = 'PENDING';
            user.dataHash = dataHash;
            user.ipfsCID = ipfsCID;
            user.kycData = {
                fullName: parsedKycData.fullName,
                email: parsedKycData.email,
                phoneNumber: parsedKycData.phoneNumber,
                nationality: parsedKycData.nationality
            };
        }

        await user.save();

        res.status(200).json({
            success: true,
            message: 'KYC submitted successfully',
            dataHash,
            ipfsCID,
            status: 'PENDING'
        });
    } catch (error) {
        console.error('KYC submission error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * @route   POST /api/kyc/verify
 * @desc    Verifier approves KYC and mints token
 * @access  Verifier only
 */
router.post('/verify', async (req, res) => {
    try {
        const { walletAddress, expiryYears = 2 } = req.body;

        const user = await User.findOne({ walletAddress: walletAddress.toLowerCase() });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (user.verificationStatus === 'VERIFIED') {
            return res.status(400).json({ error: 'User already verified' });
        }

        // Calculate expiry date
        const expiryDate = Math.floor(Date.now() / 1000) + (expiryYears * 365 * 24 * 60 * 60);

        // Mint identity token on blockchain
        const result = await web3Service.mintIdentityToken(
            walletAddress,
            user.dataHash,
            'KYC',
            expiryDate
        );

        // Update user record
        user.verificationStatus = 'VERIFIED';
        user.identityTokenId = result.tokenId;
        user.verifiedAt = new Date();
        user.expiryDate = new Date(expiryDate * 1000);
        user.verifier = (await web3Service.signer.getAddress());

        await user.save();

        res.status(200).json({
            success: true,
            message: 'KYC verified and token minted',
            tokenId: result.tokenId,
            txHash: result.txHash,
            blockNumber: result.blockNumber
        });
    } catch (error) {
        console.error('KYC verification error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * @route   GET /api/kyc/status/:address
 * @desc    Get KYC verification status
 * @access  Public
 */
router.get('/status/:address', async (req, res) => {
    try {
        const { address } = req.params;

        const user = await User.findOne({ walletAddress: address.toLowerCase() });

        if (!user) {
            return res.status(404).json({
                verified: false,
                status: 'NOT_FOUND'
            });
        }

        // Also check on-chain status
        const isVerifiedOnChain = await web3Service.isVerified(address);

        res.status(200).json({
            verified: isVerifiedOnChain,
            status: user.verificationStatus,
            verificationType: user.verificationType,
            identityTokenId: user.identityTokenId,
            verifiedAt: user.verifiedAt,
            expiryDate: user.expiryDate
        });
    } catch (error) {
        console.error('Status check error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * @route   GET /api/kyc/token/:tokenId
 * @desc    Get token metadata
 * @access  Public
 */
router.get('/token/:tokenId', async (req, res) => {
    try {
        const { tokenId } = req.params;

        const metadata = await web3Service.getTokenMetadata(tokenId);

        res.status(200).json({
            success: true,
            metadata
        });
    } catch (error) {
        console.error('Token metadata error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
