const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { ROLES, normalizeRole } = require('../constants/rbac');

/**
 * Account model for email-based authentication.
 * Wallet address is optional and can be linked after login.
 */
const AccountSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, select: false }, // Never return password by default
    name: { type: String, trim: true },
    role: {
      type: String,
      enum: [...Object.values(ROLES), 'user', 'admin'],
      default: ROLES.USER,
      set: normalizeRole,
    },
    address: { type: String, index: true, sparse: true }, // Wallet address, linked later
    signatureAsset: {
      cid: { type: String },
      hash: { type: String },
      contentType: { type: String },
      width: { type: Number },
      height: { type: Number },
      uploadedAt: { type: Date },
      walletAddress: { type: String },
    },
    createdAt: { type: Date, default: Date.now },
    lastLoginAt: { type: Date }
  },
  { timestamps: true }
);

// Hash password before saving
AccountSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Compare password method
AccountSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

AccountSchema.methods.getNormalizedRole = function () {
  return normalizeRole(this.role);
};

module.exports = mongoose.model('Account', AccountSchema);
