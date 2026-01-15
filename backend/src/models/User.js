const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    walletAddress: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        index: true
    },
    verificationType: {
        type: String,
        enum: ['KYC', 'KYB', 'NONE'],
        default: 'NONE'
    },
    verificationStatus: {
        type: String,
        enum: ['PENDING', 'VERIFIED', 'REJECTED', 'EXPIRED', 'REVOKED'],
        default: 'PENDING'
    },
    identityTokenId: {
        type: String,
        default: null
    },
    dataHash: {
        type: String,
        default: null
    },
    ipfsCID: {
        type: String,
        default: null
    },
    verifiedAt: {
        type: Date,
        default: null
    },
    expiryDate: {
        type: Date,
        default: null
    },
    verifier: {
        type: String,
        default: null
    },
    kycData: {
        fullName: String,
        email: String,
        phoneNumber: String,
        nationality: String,
        // Other fields stored as metadata references, not actual PII
    },
    kybData: {
        businessName: String,
        registrationNumber: String,
        businessType: String,
        // Other fields stored as metadata references
    },
    transactionTokens: [{
        tokenId: String,
        txHash: String,
        txType: String,
        timestamp: Date
    }],
    metadata: {
        type: Map,
        of: String
    }
}, {
    timestamps: true
});

// Indexes for efficient queries
userSchema.index({ verificationStatus: 1 });
userSchema.index({ verificationType: 1 });
userSchema.index({ identityTokenId: 1 });

module.exports = mongoose.model('User', userSchema);
