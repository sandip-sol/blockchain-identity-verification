const mongoose = require('mongoose');

const EnvelopeAuditLogSchema = new mongoose.Schema(
  {
    envelopeId: { type: String, required: true, index: true },
    eventType: {
      type: String,
      enum: [
        'ENVELOPE_CREATED',
        'ENVELOPE_SENT',
        'RECIPIENT_ADDED',
        'RECIPIENT_VIEWED',
        'RECIPIENT_SIGNED',
        'ENVELOPE_COMPLETED',
        'ENVELOPE_VOIDED',
      ],
      required: true,
      index: true,
    },
    actor: { type: String },
    details: { type: Object },
    ip: { type: String },
    userAgent: { type: String },
    txHash: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model('EnvelopeAuditLog', EnvelopeAuditLogSchema);
