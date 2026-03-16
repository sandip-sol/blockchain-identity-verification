const mongoose = require('mongoose');

/**
 * Envelope = DocuSign-like container for one document and its recipients.
 * Stores only encrypted/off-chain references (CID + hashes).
 */
const EnvelopeSchema = new mongoose.Schema(
  {
    envelopeId: { type: String, required: true, unique: true, index: true },
    envelopeIdBytes32: { type: String, required: true },

    ownerAddress: { type: String, required: true, index: true },

    status: {
      type: String,
      enum: ['DRAFT', 'SENT', 'IN_PROGRESS', 'COMPLETED', 'VOID'],
      default: 'DRAFT',
      index: true,
    },

    // Original document (encrypted) reference
    documentOriginalCID: { type: String },
    documentOriginalHash: { type: String },

    // Final signed document reference
    documentFinalCID: { type: String },
    documentFinalHash: { type: String },

    expiresAt: { type: Date },

    // On-chain anchoring (optional)
    anchoredTxHash: { type: String },
    anchoredAt: { type: Date },

    metadata: {
      title: { type: String },
      description: { type: String },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Envelope', EnvelopeSchema);
