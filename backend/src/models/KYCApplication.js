const mongoose = require('mongoose');
const { KYC_STATUSES, VERIFICATION_TX_STATUSES } = require('../constants/kycStatus');

const KycDocumentSchema = new mongoose.Schema({
  type: { type: String, required: true },
  storageRef: { type: String, default: null },
  hash: { type: String, default: null },
  mimeType: { type: String, default: null },
  originalFilename: { type: String, default: null },
  sizeBytes: { type: Number, default: null },
  uploadedAt: { type: Date, default: Date.now },
}, { _id: true });

const KYCApplicationSchema = new mongoose.Schema({
  applicationId: { type: String, required: true, unique: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', default: null, index: true },
  walletAddress: { type: String, required: true, lowercase: true, index: true },
  verificationType: { type: String, enum: ['KYC', 'KYB'], default: 'KYC' },
  status: {
    type: String,
    enum: Object.values(KYC_STATUSES),
    default: KYC_STATUSES.SUBMITTED,
    index: true,
  },
  encryptedPayloadRef: { type: String, default: null },
  ipfsCid: { type: String, default: null },
  dataHash: { type: String, default: null },
  summary: {
    fullName: { type: String, default: null },
    email: { type: String, default: null },
    phoneNumber: { type: String, default: null },
    nationality: { type: String, default: null },
    dateOfBirth: { type: String, default: null },
    businessName: { type: String, default: null },
    registrationNumber: { type: String, default: null },
  },
  documents: { type: [KycDocumentSchema], default: [] },
  submittedAt: { type: Date, default: null },
  reviewedAt: { type: Date, default: null },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', default: null },
  reviewedByRole: { type: String, default: null },
  approvedAt: { type: Date, default: null },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', default: null },
  rejectedAt: { type: Date, default: null },
  rejectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', default: null },
  rejectionReason: { type: String, default: null },
  resubmissionRequestedAt: { type: Date, default: null },
  resubmissionRequestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', default: null },
  resubmissionReason: { type: String, default: null },
  verifiedAt: { type: Date, default: null },
  verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', default: null },
  verificationTxHash: { type: String, default: null },
  verificationTxStatus: {
    type: String,
    enum: Object.values(VERIFICATION_TX_STATUSES),
    default: VERIFICATION_TX_STATUSES.NONE,
  },
  verificationBlockNumber: { type: Number, default: null },
  verificationChainId: { type: Number, default: null },
  verifierWallet: { type: String, default: null },
  verificationTokenId: { type: String, default: null },
  failureReason: { type: String, default: null },
  failureCode: { type: String, default: null },
  currentRiskLevel: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH', 'UNKNOWN'], default: 'UNKNOWN' },
  reviewNotes: { type: String, default: null },
  version: { type: Number, default: 1 },
}, { timestamps: true });

KYCApplicationSchema.index({ walletAddress: 1, createdAt: -1 });
KYCApplicationSchema.index({ status: 1, submittedAt: -1 });
KYCApplicationSchema.index({ 'summary.email': 1 });

module.exports = mongoose.model('KYCApplication', KYCApplicationSchema);
