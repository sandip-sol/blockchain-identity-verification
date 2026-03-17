const Account = require('../models/Account');
const Recipient = require('../models/Recipient');

function normalizeAddress(value) {
  return value ? String(value).toLowerCase() : null;
}

async function resolveEnvelopeAccess({ envelope, user }) {
  const account = user?.sub ? await Account.findById(user.sub) : null;
  const linkedAddress = normalizeAddress(account?.address);
  const ownerAddress = normalizeAddress(envelope?.ownerAddress);
  const recipient = linkedAddress && envelope?.envelopeId
    ? await Recipient.findOne({ envelopeId: envelope.envelopeId, recipientAddress: linkedAddress })
    : null;

  return {
    account,
    linkedAddress,
    isOwner: Boolean(linkedAddress && ownerAddress && linkedAddress === ownerAddress),
    recipient,
    isRecipient: Boolean(recipient),
  };
}

function canAccessEnvelope(ctx) {
  return Boolean(ctx?.isOwner || ctx?.isRecipient);
}

function requireLinkedWallet(ctx) {
  return Boolean(ctx?.linkedAddress);
}

module.exports = {
  resolveEnvelopeAccess,
  canAccessEnvelope,
  requireLinkedWallet,
  normalizeAddress,
};
