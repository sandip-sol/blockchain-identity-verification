const crypto = require('crypto');

const NETWORK_NAME_MAP = {
  1: 'Ethereum Mainnet',
  11155111: 'Ethereum Sepolia',
  137: 'Polygon',
  80001: 'Polygon Mumbai',
  80002: 'Polygon Amoy',
  31337: 'Local Hardhat',
};

function sha256Hex(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function shortHash(value, lead = 10, tail = 8) {
  if (!value) return '-';
  const raw = String(value);
  if (raw.length <= lead + tail + 1) return raw;
  return `${raw.slice(0, lead)}...${raw.slice(-tail)}`;
}

function formatIso(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function buildVerificationUrl(envelopeId) {
  const appUrl = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');
  return `${appUrl}/verify?envelopeId=${encodeURIComponent(envelopeId)}`;
}

function getNetworkName(network) {
  const chainId = Number(network?.chainId || process.env.CHAIN_ID || 31337);
  return NETWORK_NAME_MAP[chainId] || `Chain ${chainId}`;
}

function buildProofBlockData({
  envelope,
  signerName,
  signerAddress,
  signedAt,
  documentHash,
  txHash,
  networkName,
  verificationUrl,
}) {
  return {
    label: 'Digitally Signed',
    signerDisplayName: signerName || signerAddress,
    signerAddress,
    signedAt: formatIso(signedAt),
    documentHash,
    blockchainNetwork: networkName,
    transactionHash: txHash || null,
    agreementId: envelope.envelopeId,
    verificationStatusText: txHash ? 'Verifiable on blockchain' : 'Blockchain anchor pending',
    verificationUrl,
  };
}

function extractAuditTrail({ envelope, recipients, auditLogs, signerAddress, signedAt, txHash, networkName }) {
  const getLogTime = (eventType) => auditLogs.find((entry) => entry.eventType === eventType)?.createdAt || null;
  const viewedLog = auditLogs.find((entry) => entry.eventType === 'RECIPIENT_VIEWED' && (!signerAddress || entry.actor === signerAddress));
  const signedLog = auditLogs.find((entry) => entry.eventType === 'RECIPIENT_SIGNED' && (!signerAddress || entry.actor === signerAddress));
  const signerRow = recipients.find((recipient) => recipient.recipientAddress === signerAddress) || null;

  return {
    documentCreatedAt: formatIso(envelope.createdAt),
    documentSentAt: formatIso(getLogTime('ENVELOPE_SENT')),
    signerViewedAt: formatIso(viewedLog?.createdAt || signerRow?.updatedAt),
    signerSignedAt: formatIso(signedAt || signedLog?.createdAt || signerRow?.signedAt),
    signerWalletAddress: signerAddress || null,
    ipAddress: viewedLog?.ip || signedLog?.ip || null,
    documentHash: envelope.canonicalDocumentHash || envelope.documentOriginalHash || null,
    transactionHash: txHash || null,
    chain: networkName,
    agreementId: envelope.envelopeId,
    finalStatus: txHash ? 'Verified' : envelope.status === 'COMPLETED' ? 'Signed' : envelope.status,
  };
}

module.exports = {
  sha256Hex,
  shortHash,
  formatIso,
  buildVerificationUrl,
  getNetworkName,
  buildProofBlockData,
  extractAuditTrail,
};
