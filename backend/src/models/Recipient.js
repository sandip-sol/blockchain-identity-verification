const mongoose = require('mongoose');

/**
 * Recipient = signer/CC for an envelope.
 * For MVP we support wallet-address recipients.
 */
const RecipientSchema = new mongoose.Schema(
  {
    envelopeId: { type: String, required: true, index: true },
    recipientAddress: { type: String, required: true, index: true },
    role: { type: String, enum: ['SIGNER', 'CC'], default: 'SIGNER' },
    signingOrder: { type: Number, default: 1 },

    status: {
      type: String,
      enum: ['PENDING', 'VIEWED', 'SIGNED', 'DECLINED'],
      default: 'PENDING',
      index: true,
    },

    // Nonce for EIP-712 signing to prevent replay
    nonce: { type: Number, default: 0 },
    deadline: { type: Date },

    // Visual signature
    signatureImageCID: { type: String },
    signatureImageHash: { type: String },

    // Cryptographic proof
    typedDataHash: { type: String },
    signature: { type: String },

    // Optional: signer identity token id ("digital identity number") at signing time
    identityTokenId: { type: String, default: null },

    signedAt: { type: Date },
  },
  { timestamps: true }
);

RecipientSchema.index({ envelopeId: 1, recipientAddress: 1 }, { unique: true });

module.exports = mongoose.model('Recipient', RecipientSchema);
