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
    // On-chain mint transaction for IdentityToken (useful for activity history)
    mintTxHash: {
        type: String,
        default: null
    },
    mintBlockNumber: {
        type: Number,
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
        // hash of the off-chain payload, used as key in TransactionRegistry
        txHash: String,
        txType: String,
        timestamp: Date,
        // actual blockchain transaction hash for minting the ERC-1155 token
        blockchainTxHash: { type: String, default: null },
        blockNumber: { type: Number, default: null }
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

const MongoUser = mongoose.model('User', userSchema);
const UserLocal = require('./UserLocal');

module.exports = {
    findOne: async (query) => {
        if (mongoose.connection.readyState === 1) {
            return MongoUser.findOne(query);
        }
        console.warn('⚠️ MongoDB not connected. Using local file storage.');
        return UserLocal.findOne(query);
    },
    // Constructor proxy
    // When "new User({...})" is called, we need a way to redirect. 
    // Since module.exports is an object here, we can't use "new".
    // BUT the existing code does "new User(...)". 
    // So we must export a Class/Function that behaves conditionally.
};

// Better approach to preserve "new User()" syntax:
const ProxyModel = class {
    constructor(data) {
        if (mongoose.connection.readyState === 1) {
            return new MongoUser(data);
        }
        console.warn('⚠️ MongoDB not connected. Using local file storage.');
        return new UserLocal(data);
    }

    static async findOne(query) {
        if (mongoose.connection.readyState === 1) {
            return MongoUser.findOne(query);
        }
        return UserLocal.findOne(query);
    }
};

module.exports = ProxyModel;
