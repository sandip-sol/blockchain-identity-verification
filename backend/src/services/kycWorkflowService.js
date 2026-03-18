const crypto = require('crypto');
const { ethers } = require('ethers');
const KYCApplication = require('../models/KYCApplication');
const KYCAuditLog = require('../models/KYCAuditLog');
const User = require('../models/User');
const Account = require('../models/Account');
const { KYC_STATUSES, VERIFICATION_TX_STATUSES, KYC_ACTIONS } = require('../constants/kycStatus');
const { writeKycAuditLog } = require('./auditService');
const { normalizeRole } = require('./rbacService');
const web3Service = require('./web3Service');

function buildApplicationId() {
  return `kyc_${crypto.randomUUID()}`;
}

function summarizeKycData(parsedKycData = {}) {
  return {
    fullName: parsedKycData.fullName || null,
    email: parsedKycData.email || null,
    phoneNumber: parsedKycData.phoneNumber || null,
    nationality: parsedKycData.nationality || null,
    dateOfBirth: parsedKycData.dateOfBirth || null,
    businessName: parsedKycData.businessName || null,
    registrationNumber: parsedKycData.registrationNumber || null,
  };
}

function hashBuffer(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function mapDocuments(files = {}) {
  return Object.entries(files)
    .flatMap(([type, fileList]) => (fileList || []).map(file => ({
      type,
      hash: file?.buffer ? hashBuffer(file.buffer) : null,
      mimeType: file?.mimetype || null,
      originalFilename: file?.originalname || null,
      sizeBytes: file?.size || null,
      uploadedAt: new Date(),
    })));
}

function ensureTransition(currentStatus, nextStatus, allowedFrom) {
  if (!allowedFrom.includes(currentStatus)) {
    const error = new Error(`Illegal KYC status transition from ${currentStatus} to ${nextStatus}`);
    error.status = 409;
    throw error;
  }
}

async function linkAccountByWallet(walletAddress) {
  return Account.findOne({ address: walletAddress.toLowerCase() });
}

async function createOrUpdateSubmission({
  walletAddress,
  verificationType,
  dataHash,
  ipfsCID,
  parsedKycData,
  files,
  req,
}) {
  const normalizedWallet = walletAddress.toLowerCase();
  const linkedAccount = await linkAccountByWallet(normalizedWallet);
  const previous = await KYCApplication.findOne({ walletAddress: normalizedWallet }).sort({ createdAt: -1 });
  const nextDocuments = mapDocuments(files);
  const baseUpdate = {
    walletAddress: normalizedWallet,
    userId: linkedAccount?._id || null,
    verificationType: verificationType || 'KYC',
    status: KYC_STATUSES.SUBMITTED,
    encryptedPayloadRef: ipfsCID,
    ipfsCid: ipfsCID,
    dataHash,
    summary: summarizeKycData(parsedKycData),
    documents: nextDocuments,
    submittedAt: new Date(),
    reviewedAt: null,
    reviewedBy: null,
    reviewedByRole: null,
    approvedAt: null,
    approvedBy: null,
    rejectedAt: null,
    rejectedBy: null,
    rejectionReason: null,
    resubmissionRequestedAt: null,
    resubmissionRequestedBy: null,
    resubmissionReason: null,
    verifiedAt: null,
    verifiedBy: null,
    verificationTxHash: null,
    verificationTxStatus: VERIFICATION_TX_STATUSES.NONE,
    verificationBlockNumber: null,
    verificationChainId: null,
    verifierWallet: null,
    verificationTokenId: null,
    failureReason: null,
    failureCode: null,
    version: (previous?.version || 0) + 1,
  };

  let application;
  let action;
  let fromStatus = null;

  if (previous && [KYC_STATUSES.DRAFT, KYC_STATUSES.RESUBMISSION_REQUIRED, KYC_STATUSES.SUBMITTED].includes(previous.status)) {
    fromStatus = previous.status;
    application = await KYCApplication.findOneAndUpdate(
      { _id: previous._id },
      { $set: baseUpdate },
      { new: true }
    );
    action = previous.status === KYC_STATUSES.SUBMITTED ? KYC_ACTIONS.UPDATED : KYC_ACTIONS.SUBMITTED;
  } else {
    application = await KYCApplication.create({
      applicationId: buildApplicationId(),
      ...baseUpdate,
    });
    action = KYC_ACTIONS.SUBMITTED;
  }

  await writeKycAuditLog({
    applicationId: application.applicationId,
    actorId: linkedAccount?._id || null,
    actorRole: linkedAccount ? normalizeRole(linkedAccount.role) : 'USER',
    action,
    fromStatus,
    toStatus: KYC_STATUSES.SUBMITTED,
    metadata: {
      walletAddress: normalizedWallet,
      verificationType: application.verificationType,
      documentCount: application.documents.length,
      dataHash,
      ipfsCid: ipfsCID,
    },
    req,
  });

  return application;
}

async function getApplicationOrThrow(applicationId) {
  const application = await KYCApplication.findOne({ applicationId });
  if (!application) {
    const error = new Error('KYC application not found');
    error.status = 404;
    throw error;
  }
  return application;
}

async function applyStatusChange({
  application,
  nextStatus,
  actor,
  req,
  note = null,
  action,
  extraSet = {},
  allowedFrom,
}) {
  ensureTransition(application.status, nextStatus, allowedFrom);
  const fromStatus = application.status;
  Object.assign(application, extraSet);
  application.status = nextStatus;
  application.reviewedAt = new Date();
  application.reviewedBy = actor._id;
  application.reviewedByRole = normalizeRole(actor.role);
  await application.save();

  await writeKycAuditLog({
    applicationId: application.applicationId,
    actorId: actor._id,
    actorRole: normalizeRole(actor.role),
    action,
    fromStatus,
    toStatus: nextStatus,
    note,
    metadata: extraSet,
    req,
  });

  return application;
}

async function markUnderReview({ applicationId, actor, req, note }) {
  const application = await getApplicationOrThrow(applicationId);
  return applyStatusChange({
    application,
    nextStatus: KYC_STATUSES.UNDER_REVIEW,
    actor,
    req,
    note,
    action: KYC_ACTIONS.REVIEW_STARTED,
    allowedFrom: [KYC_STATUSES.SUBMITTED, KYC_STATUSES.RESUBMISSION_REQUIRED],
  });
}

async function approveApplication({ applicationId, actor, req, note, riskLevel }) {
  const application = await getApplicationOrThrow(applicationId);
  return applyStatusChange({
    application,
    nextStatus: KYC_STATUSES.APPROVED,
    actor,
    req,
    note,
    action: KYC_ACTIONS.APPROVED,
    allowedFrom: [KYC_STATUSES.UNDER_REVIEW, KYC_STATUSES.SUBMITTED],
    extraSet: {
      approvedAt: new Date(),
      approvedBy: actor._id,
      currentRiskLevel: riskLevel || application.currentRiskLevel || 'UNKNOWN',
      reviewNotes: note || application.reviewNotes || null,
      rejectionReason: null,
      resubmissionReason: null,
      failureReason: null,
      failureCode: null,
    },
  });
}

async function rejectApplication({ applicationId, actor, req, note }) {
  const application = await getApplicationOrThrow(applicationId);
  return applyStatusChange({
    application,
    nextStatus: KYC_STATUSES.REJECTED,
    actor,
    req,
    note,
    action: KYC_ACTIONS.REJECTED,
    allowedFrom: [KYC_STATUSES.SUBMITTED, KYC_STATUSES.UNDER_REVIEW, KYC_STATUSES.APPROVED, KYC_STATUSES.RESUBMISSION_REQUIRED],
    extraSet: {
      rejectedAt: new Date(),
      rejectedBy: actor._id,
      rejectionReason: note,
    },
  });
}

async function requestResubmission({ applicationId, actor, req, note }) {
  const application = await getApplicationOrThrow(applicationId);
  return applyStatusChange({
    application,
    nextStatus: KYC_STATUSES.RESUBMISSION_REQUIRED,
    actor,
    req,
    note,
    action: KYC_ACTIONS.RESUBMISSION_REQUESTED,
    allowedFrom: [KYC_STATUSES.SUBMITTED, KYC_STATUSES.UNDER_REVIEW, KYC_STATUSES.APPROVED, KYC_STATUSES.FAILED],
    extraSet: {
      resubmissionRequestedAt: new Date(),
      resubmissionRequestedBy: actor._id,
      resubmissionReason: note,
    },
  });
}

async function syncLegacyUserVerification({ application, status, verificationResult = {} }) {
  let user = await User.findOne({ walletAddress: application.walletAddress });
  if (!user) {
    user = new User({
      walletAddress: application.walletAddress,
      verificationType: application.verificationType,
      verificationStatus: status,
      dataHash: application.dataHash,
      ipfsCID: application.ipfsCid,
      kycData: {
        fullName: application.summary?.fullName || undefined,
        email: application.summary?.email || undefined,
        phoneNumber: application.summary?.phoneNumber || undefined,
        nationality: application.summary?.nationality || undefined,
      }
    });
  }

  user.verificationType = application.verificationType;
  user.verificationStatus = status;
  user.dataHash = application.dataHash;
  user.ipfsCID = application.ipfsCid;
  user.kycData = {
    fullName: application.summary?.fullName || undefined,
    email: application.summary?.email || undefined,
    phoneNumber: application.summary?.phoneNumber || undefined,
    nationality: application.summary?.nationality || undefined,
  };

  if (status === 'VERIFIED') {
    user.identityTokenId = verificationResult.tokenId || user.identityTokenId || null;
    user.verifiedAt = application.verifiedAt || new Date();
    user.expiryDate = verificationResult.expiryDate || user.expiryDate || null;
    user.verifier = verificationResult.verifierWallet || application.verifierWallet || null;
    user.mintTxHash = verificationResult.txHash || application.verificationTxHash || null;
    user.mintBlockNumber = verificationResult.blockNumber || application.verificationBlockNumber || null;
  }

  await user.save();
  return user;
}

async function verifyApplicationOnChain({ applicationId, actor, req, expiryYears = 2, retryFailed = false }) {
  const application = await getApplicationOrThrow(applicationId);

  if (application.status === KYC_STATUSES.VERIFIED) {
    return { application, alreadyVerified: true };
  }

  if (application.status !== KYC_STATUSES.APPROVED && !(retryFailed && application.status === KYC_STATUSES.FAILED)) {
    const error = new Error('Only approved applications can be verified on-chain');
    error.status = 409;
    throw error;
  }

  if ([VERIFICATION_TX_STATUSES.PENDING, VERIFICATION_TX_STATUSES.SUBMITTED, VERIFICATION_TX_STATUSES.CONFIRMED].includes(application.verificationTxStatus)) {
    const error = new Error('Verification transaction is already in progress or completed');
    error.status = 409;
    throw error;
  }

  const verifierRole = normalizeRole(actor.role);
  const verifierWallet = web3Service.signer ? await web3Service.signer.getAddress() : null;
  const chainId = web3Service.provider ? Number((await web3Service.provider.getNetwork()).chainId) : null;

  application.verificationTxStatus = VERIFICATION_TX_STATUSES.PENDING;
  application.failureReason = null;
  application.failureCode = null;
  await application.save();

  await writeKycAuditLog({
    applicationId,
    actorId: actor._id,
    actorRole: verifierRole,
    action: KYC_ACTIONS.VERIFY_ONCHAIN_REQUESTED,
    fromStatus: application.status,
    toStatus: application.status,
    metadata: { expiryYears },
    req,
  });

  try {
    const isVerifierSigner = await web3Service.isSignerVerifier();
    if (!isVerifierSigner) {
      const error = new Error('Server signer does not have VERIFIER_ROLE');
      error.code = 'VERIFIER_ROLE_MISSING';
      throw error;
    }

    application.verificationTxStatus = VERIFICATION_TX_STATUSES.SUBMITTED;
    application.verifierWallet = verifierWallet;
    application.verificationChainId = chainId;
    await application.save();

    const expiryDateUnix = Math.floor(Date.now() / 1000) + (expiryYears * 365 * 24 * 60 * 60);
    const result = await web3Service.mintIdentityToken(
      application.walletAddress,
      application.dataHash,
      application.verificationType,
      expiryDateUnix
    );

    application.status = KYC_STATUSES.VERIFIED;
    application.verifiedAt = new Date();
    application.verifiedBy = actor._id;
    application.verificationTxStatus = VERIFICATION_TX_STATUSES.CONFIRMED;
    application.verificationTxHash = result.txHash || null;
    application.verificationBlockNumber = result.blockNumber || null;
    application.verificationTokenId = result.tokenId || null;
    application.failureReason = null;
    application.failureCode = null;
    await application.save();

    await syncLegacyUserVerification({
      application,
      status: 'VERIFIED',
      verificationResult: {
        tokenId: result.tokenId,
        txHash: result.txHash,
        blockNumber: result.blockNumber,
        verifierWallet,
        expiryDate: new Date(expiryDateUnix * 1000),
      },
    });

    await writeKycAuditLog({
      applicationId,
      actorId: actor._id,
      actorRole: verifierRole,
      action: KYC_ACTIONS.VERIFY_ONCHAIN_SUCCEEDED,
      fromStatus: KYC_STATUSES.APPROVED,
      toStatus: KYC_STATUSES.VERIFIED,
      metadata: {
        txHash: result.txHash || null,
        blockNumber: result.blockNumber || null,
        tokenId: result.tokenId || null,
        chainId,
        verifierWallet,
      },
      req,
    });

    return { application, result, alreadyVerified: false };
  } catch (error) {
    application.status = KYC_STATUSES.FAILED;
    application.verificationTxStatus = VERIFICATION_TX_STATUSES.FAILED;
    application.failureReason = error.message;
    application.failureCode = error.code || 'VERIFICATION_FAILED';
    await application.save();

    await syncLegacyUserVerification({ application, status: 'PENDING' });

    await writeKycAuditLog({
      applicationId,
      actorId: actor._id,
      actorRole: verifierRole,
      action: KYC_ACTIONS.VERIFY_ONCHAIN_FAILED,
      fromStatus: KYC_STATUSES.APPROVED,
      toStatus: KYC_STATUSES.FAILED,
      note: error.message,
      metadata: {
        code: error.code || 'VERIFICATION_FAILED',
        chainId,
        verifierWallet,
      },
      req,
    });

    throw error;
  }
}

async function listApplications({ page, limit, status, search }) {
  const filter = {};
  if (status) filter.status = status;
  if (search) {
    filter.$or = [
      { applicationId: { $regex: search, $options: 'i' } },
      { walletAddress: { $regex: search.toLowerCase(), $options: 'i' } },
      { 'summary.email': { $regex: search, $options: 'i' } },
      { 'summary.fullName': { $regex: search, $options: 'i' } },
    ];
  }

  const [applications, total] = await Promise.all([
    KYCApplication.find(filter)
      .sort({ submittedAt: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('reviewedBy', 'email name role')
      .populate('approvedBy', 'email name role')
      .populate('verifiedBy', 'email name role')
      .lean(),
    KYCApplication.countDocuments(filter),
  ]);

  return {
    applications,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
}

async function getApplicationDetail(applicationId) {
  const application = await KYCApplication.findOne({ applicationId })
    .populate('userId', 'email name role address')
    .populate('reviewedBy', 'email name role')
    .populate('approvedBy', 'email name role')
    .populate('rejectedBy', 'email name role')
    .populate('resubmissionRequestedBy', 'email name role')
    .populate('verifiedBy', 'email name role')
    .lean();

  if (!application) {
    const error = new Error('KYC application not found');
    error.status = 404;
    throw error;
  }

  const audit = await KYCAuditLog.find({ applicationId }).sort({ createdAt: -1 }).lean();
  return { application, audit };
}

async function getAdminStats() {
  const [
    total,
    submitted,
    underReview,
    approved,
    rejected,
    verified,
    failed,
    resubmissionRequired,
  ] = await Promise.all([
    KYCApplication.countDocuments(),
    KYCApplication.countDocuments({ status: KYC_STATUSES.SUBMITTED }),
    KYCApplication.countDocuments({ status: KYC_STATUSES.UNDER_REVIEW }),
    KYCApplication.countDocuments({ status: KYC_STATUSES.APPROVED }),
    KYCApplication.countDocuments({ status: KYC_STATUSES.REJECTED }),
    KYCApplication.countDocuments({ status: KYC_STATUSES.VERIFIED }),
    KYCApplication.countDocuments({ status: KYC_STATUSES.FAILED }),
    KYCApplication.countDocuments({ status: KYC_STATUSES.RESUBMISSION_REQUIRED }),
  ]);

  return {
    total,
    submitted,
    underReview,
    approved,
    rejected,
    verified,
    failed,
    resubmissionRequired,
  };
}

module.exports = {
  KYC_STATUSES,
  VERIFICATION_TX_STATUSES,
  createOrUpdateSubmission,
  getApplicationOrThrow,
  markUnderReview,
  approveApplication,
  rejectApplication,
  requestResubmission,
  verifyApplicationOnChain,
  listApplications,
  getApplicationDetail,
  getAdminStats,
};
