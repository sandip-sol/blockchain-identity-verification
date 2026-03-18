const mongoose = require('mongoose');

/**
 * Stores short-lived nonces for wallet-login.
 * Using Mongo keeps it working across restarts / multiple instances.
 */
const LoginNonceSchema = new mongoose.Schema(
  {
    address: { type: String, required: true, index: true },
    nonce: { type: String, required: true, index: true },
    expiresAt: { type: Date, required: true }
  },
  { timestamps: true }
);

// Auto-expire documents when expiresAt passes
LoginNonceSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('LoginNonce', LoginNonceSchema);
