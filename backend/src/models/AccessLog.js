const mongoose = require('mongoose');

const accessLogSchema = new mongoose.Schema({
    accessId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    dataOwner: {
        type: String,
        required: true,
        lowercase: true,
        index: true
    },
    requester: {
        type: String,
        required: true,
        lowercase: true,
        index: true
    },
    tokenIds: [{
        type: String
    }],
    purpose: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['PENDING', 'GRANTED', 'REVOKED', 'EXPIRED'],
        default: 'PENDING'
    },
    grantedAt: {
        type: Date,
        default: null
    },
    expiresAt: {
        type: Date,
        required: true
    },
    revokedAt: {
        type: Date,
        default: null
    },
    accessCount: {
        type: Number,
        default: 0
    },
    lastAccessedAt: {
        type: Date,
        default: null
    },
    ipAddress: String,
    userAgent: String,
    metadata: {
        type: Map,
        of: String
    }
}, {
    timestamps: true
});

// Indexes
accessLogSchema.index({ dataOwner: 1, status: 1 });
accessLogSchema.index({ requester: 1, status: 1 });
accessLogSchema.index({ expiresAt: 1 });

// Method to check if access is still valid
accessLogSchema.methods.isValid = function () {
    return (
        this.status === 'GRANTED' &&
        this.expiresAt > new Date() &&
        !this.revokedAt
    );
};

module.exports = mongoose.model('AccessLog', accessLogSchema);
