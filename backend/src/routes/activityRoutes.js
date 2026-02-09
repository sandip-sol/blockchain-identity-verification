const express = require('express');
const router = express.Router();

const User = require('../models/User');
const Envelope = require('../models/Envelope');
const Recipient = require('../models/Recipient');

/**
 * @route   GET /api/activity/:address
 * @desc    Get a consolidated activity feed for a wallet address.
 *          Includes on-chain transaction hashes when available.
 * @access  Public (no PII returned)
 */
router.get('/:address', async (req, res) => {
  try {
    const address = String(req.params.address || '').toLowerCase();
    if (!address) return res.status(400).json({ error: 'Address is required' });

    const activities = [];

    // KYC/KYB mint activity (IdentityToken)
    const user = await User.findOne({ walletAddress: address });
    if (user) {
      if (user.mintTxHash) {
        activities.push({
          type: 'KYC_MINT',
          txHash: user.mintTxHash,
          blockNumber: user.mintBlockNumber || null,
          tokenId: user.identityTokenId || null,
          status: user.verificationStatus,
          timestamp: user.verifiedAt || user.updatedAt || user.createdAt,
        });
      }

      // TransactionRegistry tokenization history (ERC-1155)
      if (Array.isArray(user.transactionTokens)) {
        for (const t of user.transactionTokens) {
          activities.push({
            type: 'TX_TOKENIZE',
            txHash: t.blockchainTxHash || null,
            blockNumber: t.blockNumber || null,
            tokenId: t.tokenId || null,
            txType: t.txType || null,
            payloadHash: t.txHash || null,
            timestamp: t.timestamp || user.updatedAt || user.createdAt,
          });
        }
      }
    }

    // Envelopes owned by the user
    const ownedEnvelopes = await Envelope.find({ ownerAddress: address }).limit(200);
    for (const env of ownedEnvelopes) {
      if (env.anchoredTxHash) {
        activities.push({
          type: 'ENVELOPE_ANCHORED',
          txHash: env.anchoredTxHash,
          envelopeId: env.envelopeId,
          finalCID: env.documentFinalCID || null,
          finalHash: env.documentFinalHash || null,
          timestamp: env.anchoredAt || env.updatedAt || env.createdAt,
        });
      } else {
        // Non-chain activity, still useful in a dashboard
        activities.push({
          type: 'ENVELOPE_CREATED',
          envelopeId: env.envelopeId,
          status: env.status,
          timestamp: env.createdAt,
        });
      }
    }

    // Recipient signing activity
    const recipientRecords = await Recipient.find({ recipientAddress: address }).limit(500);
    for (const rec of recipientRecords) {
      activities.push({
        type: rec.status === 'SIGNED' ? 'ENVELOPE_SIGNED' : 'ENVELOPE_RECIPIENT',
        envelopeId: rec.envelopeId,
        status: rec.status,
        identityTokenId: rec.identityTokenId || null,
        typedDataHash: rec.typedDataHash || null,
        timestamp: rec.signedAt || rec.updatedAt || rec.createdAt,
      });
    }

    // Sort newest first
    activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    res.json({ address, activities });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
