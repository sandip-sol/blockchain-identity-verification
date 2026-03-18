const logger = require('../services/logger');
const express = require('express');
const multer = require('multer');
const rateLimit = require('express-rate-limit');

const User = require('../models/User');
const KYCApplication = require('../models/KYCApplication');
const EncryptionService = require('../services/encryptionService');
const ipfsService = require('../services/ipfsService');
const web3Service = require('../services/web3Service');
const {
  createOrUpdateSubmission,
  getApplicationDetail,
  approveApplication,
  verifyApplicationOnChain,
} = require('../services/kycWorkflowService');
const { submitKycSchema, validate } = require('../validators/kycValidators');
const { normalizeRole } = require('../constants/rbac');
const { ROLES } = require('../services/rbacService');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const isProduction = process.env.NODE_ENV === 'production';
const submitWindowMs = parseInt(process.env.KYC_SUBMIT_RATE_WINDOW_MS || '', 10)
  || 15 * 60 * 1000;
const submitMax = parseInt(process.env.KYC_SUBMIT_RATE_MAX || '', 10)
  || (isProduction ? 10 : 50);

const submitLimiter = isProduction
  ? rateLimit({
      windowMs: submitWindowMs,
      max: submitMax,
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: (req) => {
        try {
          const walletAddress = String(req.body?.walletAddress || '').trim().toLowerCase();
          if (walletAddress) return `kyc-submit:${walletAddress}`;
          return `kyc-submit:${String(req.ip || 'unknown-ip')}`;
        } catch (error) {
          logger.warn('KYC submit rate-limit key generation failed', { error: error.message });
          return `kyc-submit:${String(req.ip || 'unknown-ip')}`;
        }
      },
      message: {
        error: 'Too many KYC submission attempts for this wallet. Please wait before trying again.',
      },
    })
  : (req, res, next) => next();

function buildSystemActor() {
  return {
    _id: null,
    role: ROLES.SUPER_ADMIN,
  };
}

router.post('/submit', submitLimiter, upload.fields([
  { name: 'governmentId', maxCount: 1 },
  { name: 'addressProof', maxCount: 1 },
  { name: 'selfie', maxCount: 1 }
]), async (req, res) => {
  try {
    const value = validate(submitKycSchema, req.body);
    const { walletAddress, signature } = value;
    const parsedKycData = typeof value.kycData === 'string' ? JSON.parse(value.kycData) : value.kycData;

    const message = `Submit KYC for ${walletAddress}`;
    const isValid = web3Service.verifySignature(message, signature, walletAddress);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const fullKycData = {
      ...parsedKycData,
      governmentId: req.files?.governmentId ? req.files.governmentId[0].buffer.toString('base64') : null,
      addressProof: req.files?.addressProof ? req.files.addressProof[0].buffer.toString('base64') : null,
      selfie: req.files?.selfie ? req.files.selfie[0].buffer.toString('base64') : null,
      submittedAt: new Date().toISOString(),
    };

    const encrypted = EncryptionService.encryptData(fullKycData, walletAddress, signature);
    const ipfsCID = await ipfsService.uploadToIPFS(encrypted);
    await ipfsService.pinDocument(ipfsCID);

    const dataHash = EncryptionService.hashDataForBlockchain(fullKycData);

    const application = await createOrUpdateSubmission({
      walletAddress,
      verificationType: parsedKycData.verificationType || 'KYC',
      dataHash,
      ipfsCID,
      parsedKycData,
      files: req.files,
      req,
    });

    let user = await User.findOne({ walletAddress: walletAddress.toLowerCase() });
    if (!user) {
      user = new User({
        walletAddress: walletAddress.toLowerCase(),
        verificationType: parsedKycData.verificationType || 'KYC',
        verificationStatus: 'PENDING',
        dataHash,
        ipfsCID,
        kycData: {
          fullName: parsedKycData.fullName,
          email: parsedKycData.email,
          phoneNumber: parsedKycData.phoneNumber,
          nationality: parsedKycData.nationality,
        }
      });
    } else {
      user.verificationType = parsedKycData.verificationType || 'KYC';
      user.verificationStatus = 'PENDING';
      user.dataHash = dataHash;
      user.ipfsCID = ipfsCID;
      user.kycData = {
        fullName: parsedKycData.fullName,
        email: parsedKycData.email,
        phoneNumber: parsedKycData.phoneNumber,
        nationality: parsedKycData.nationality,
      };
    }
    await user.save();

    res.status(200).json({
      success: true,
      message: 'KYC submitted successfully',
      applicationId: application.applicationId,
      dataHash,
      ipfsCID,
      status: application.status,
    });
  } catch (error) {
    logger.error('KYC submission error:', error);
    res.status(error.status || 500).json({
      error: isProduction && !error.status ? 'KYC submission failed' : error.message,
      ...(isProduction || error.status ? {} : { stack: error.stack }),
    });
  }
});

router.get('/me', async (req, res) => {
  try {
    const walletAddress = String(req.query.walletAddress || '').trim().toLowerCase();
    if (!walletAddress) {
      return res.status(400).json({ error: 'walletAddress is required' });
    }

    const application = await KYCApplication.findOne({ walletAddress }).sort({ createdAt: -1 }).lean();
    const user = await User.findOne({ walletAddress });

    res.json({
      application: application ? {
        applicationId: application.applicationId,
        status: application.status,
        verificationType: application.verificationType,
        submittedAt: application.submittedAt,
        reviewedAt: application.reviewedAt,
        approvedAt: application.approvedAt,
        rejectedAt: application.rejectedAt,
        verifiedAt: application.verifiedAt,
        rejectionReason: application.rejectionReason,
        resubmissionReason: application.resubmissionReason,
        verificationTxStatus: application.verificationTxStatus,
        verificationTxHash: application.verificationTxHash,
        failureReason: application.failureReason,
        summary: application.summary,
      } : null,
      legacyUser: user ? {
        verificationStatus: user.verificationStatus,
        verificationType: user.verificationType,
        identityTokenId: user.identityTokenId,
        verifiedAt: user.verifiedAt,
        expiryDate: user.expiryDate,
      } : null,
    });
  } catch (error) {
    logger.error('KYC me lookup error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/verify', async (req, res) => {
  try {
    const apiKey = req.get('x-admin-key') || req.get('authorization')?.replace(/^Bearer\s+/i, '');
    if (!process.env.VERIFIER_API_KEY || apiKey !== process.env.VERIFIER_API_KEY) {
      return res.status(401).json({ error: 'Unauthorized (missing/invalid verifier key)' });
    }

    const walletAddress = String(req.body.walletAddress || '').trim().toLowerCase();
    const applicationId = req.body.applicationId
      || (walletAddress
        ? (await KYCApplication.findOne({ walletAddress }).sort({ createdAt: -1 }).lean())?.applicationId
        : null);

    if (!applicationId) {
      return res.status(400).json({ error: 'applicationId or walletAddress is required' });
    }

    const systemActor = buildSystemActor();
    const detail = await getApplicationDetail(applicationId);
    const current = detail.application;

    if (current.status !== 'APPROVED' && current.status !== 'VERIFIED') {
      await approveApplication({
        applicationId,
        actor: systemActor,
        req,
        note: 'Legacy verifier endpoint auto-approved application before on-chain verification.',
        riskLevel: current.currentRiskLevel || 'UNKNOWN',
      });
    }

    const { application, result, alreadyVerified } = await verifyApplicationOnChain({
      applicationId,
      actor: systemActor,
      req,
      expiryYears: req.body.expiryYears || 2,
      retryFailed: true,
    });

    res.status(200).json({
      success: true,
      message: alreadyVerified ? 'KYC already verified' : 'KYC verified and token minted',
      applicationId: application.applicationId,
      status: application.status,
      tokenId: result?.tokenId || application.verificationTokenId,
      txHash: result?.txHash || application.verificationTxHash,
      blockNumber: result?.blockNumber || application.verificationBlockNumber,
    });
  } catch (error) {
    logger.error('KYC verification error:', error);
    res.status(error.status || 500).json({ error: error.message });
  }
});

router.get('/status/:address', async (req, res) => {
  try {
    const address = String(req.params.address || '').toLowerCase();
    const user = await User.findOne({ walletAddress: address });
    const application = await KYCApplication.findOne({ walletAddress: address }).sort({ createdAt: -1 });

    if (!user && !application) {
      return res.status(404).json({
        verified: false,
        status: 'NOT_FOUND',
      });
    }

    const verified = await web3Service.isVerified(address);
    res.status(200).json({
      verified,
      status: application?.status || user?.verificationStatus || 'NOT_FOUND',
      verificationType: application?.verificationType || user?.verificationType || null,
      applicationId: application?.applicationId || null,
      verificationTxStatus: application?.verificationTxStatus || null,
      identityTokenId: user?.identityTokenId || application?.verificationTokenId || null,
      verifiedAt: application?.verifiedAt || user?.verifiedAt || null,
      expiryDate: user?.expiryDate || null,
      rejectionReason: application?.rejectionReason || null,
      resubmissionReason: application?.resubmissionReason || null,
    });
  } catch (error) {
    logger.error('Status check error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/token/:tokenId', async (req, res) => {
  try {
    const metadata = await web3Service.getTokenMetadata(req.params.tokenId);
    res.status(200).json({ success: true, metadata });
  } catch (error) {
    logger.error('Token metadata error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
