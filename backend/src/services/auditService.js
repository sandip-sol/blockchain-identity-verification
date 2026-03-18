const KYCAuditLog = require('../models/KYCAuditLog');

function getIpAddress(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || null;
}

async function writeKycAuditLog({
  applicationId,
  actorId = null,
  actorRole = 'SYSTEM',
  action,
  fromStatus = null,
  toStatus = null,
  note = null,
  metadata = {},
  req = null,
}) {
  return KYCAuditLog.create({
    applicationId,
    actorId,
    actorRole,
    action,
    fromStatus,
    toStatus,
    note,
    metadata,
    ipAddress: req ? getIpAddress(req) : null,
  });
}

module.exports = {
  writeKycAuditLog,
};
