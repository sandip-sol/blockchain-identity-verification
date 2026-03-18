const mongoose = require('mongoose');

const KYCAuditLogSchema = new mongoose.Schema({
  applicationId: { type: String, required: true, index: true },
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', default: null },
  actorRole: { type: String, default: 'SYSTEM' },
  action: { type: String, required: true },
  fromStatus: { type: String, default: null },
  toStatus: { type: String, default: null },
  note: { type: String, default: null },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  ipAddress: { type: String, default: null },
}, { timestamps: { createdAt: true, updatedAt: false } });

module.exports = mongoose.model('KYCAuditLog', KYCAuditLogSchema);
