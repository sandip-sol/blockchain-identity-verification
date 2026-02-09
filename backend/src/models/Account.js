const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

/**
 * Account model for email-based authentication.
 * Wallet address is optional and can be linked after login.
 */
const AccountSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, select: false }, // Never return password by default
    name: { type: String, trim: true },
    address: { type: String, index: true, sparse: true }, // Wallet address, linked later
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

module.exports = mongoose.model('Account', AccountSchema);
