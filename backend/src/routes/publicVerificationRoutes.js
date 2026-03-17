const express = require('express');
const Joi = require('joi');
const { ethers } = require('ethers');

const Envelope = require('../models/Envelope');
const Recipient = require('../models/Recipient');
const web3Service = require('../services/web3Service');
const { sha256Hex, getNetworkName } = require('../utils/proofUtils');

const router = express.Router();

const verifyUploadSchema = Joi.object({
  pdfBase64: Joi.string().trim().required(),
});

function envelopeIdToBytes32(envelopeId) {
  return ethers.keccak256(ethers.toUtf8Bytes(envelopeId));
}

function parsePdfBase64(pdfBase64) {
  const bytes = Buffer.from(pdfBase64, 'base64');
  if (!bytes.length) {
    throw new Error('PDF payload is empty');
  }
  if (bytes.slice(0, 4).toString('utf8') !== '%PDF') {
    throw new Error('Uploaded file must be a valid PDF');
  }
  return bytes;
}

async function buildVerificationResponse(envelope, uploadedPdfHash = null) {
  const recipients = await Recipient.find({ envelopeId: envelope.envelopeId, role: 'SIGNER' }).sort({ signingOrder: 1 }).lean();
  const signerAddresses = recipients.map((recipient) => String(recipient.recipientAddress).toLowerCase());
  const signedRecipient = recipients.find((recipient) => recipient.status === 'SIGNED') || recipients[recipients.length - 1] || null;

  const network = web3Service.isInitialized ? await web3Service.getNetworkInfo().catch(() => null) : null;
  const networkName = getNetworkName(network);

  let txExists = false;
  if (envelope.anchoredTxHash && web3Service.isInitialized) {
    const receipt = await web3Service.getTxReceipt(envelope.anchoredTxHash).catch(() => null);
    txExists = Boolean(receipt);
  }

  let onchainExists = false;
  let onchainDocumentHash = null;
  let onchainSigners = [];
  if (web3Service.isInitialized && web3Service.contracts.documentRegistry) {
    const onchain = await web3Service.contracts.documentRegistry.getEnvelope(
      envelope.envelopeIdBytes32 || envelopeIdToBytes32(envelope.envelopeId)
    );
    onchainExists = Boolean(onchain[4]);
    onchainDocumentHash = onchainExists ? String(onchain[0]).toLowerCase() : null;
    onchainSigners = Array.isArray(onchain[1]) ? onchain[1].map((entry) => String(entry).toLowerCase()) : [];
  }

  const canonicalBytes32 = envelope.canonicalDocumentHash
    ? ethers.hexlify(Buffer.from(envelope.canonicalDocumentHash, 'hex')).toLowerCase()
    : null;
  const signerMatches = signerAddresses.length > 0 && signerAddresses.every((address) => onchainSigners.includes(address));
  const hashMatchesAnchor = Boolean(canonicalBytes32 && onchainDocumentHash && canonicalBytes32 === onchainDocumentHash);
  const agreementFinalized = envelope.status === 'COMPLETED';
  const uploadedPdfMatches = uploadedPdfHash ? uploadedPdfHash === envelope.documentFinalHash : null;

  const verificationChecks = {
    uploadedFinalPdfHashMatches: uploadedPdfMatches,
    canonicalHashMatchesAnchor: hashMatchesAnchor,
    signerAddressMatchesRecordedSigner: signerMatches,
    txHashExists: txExists,
    agreementStatusFinalized: agreementFinalized,
  };

  const success = hashMatchesAnchor && signerMatches && txExists && agreementFinalized && (uploadedPdfMatches !== false);

  return {
    success,
    status: success ? 'VERIFIED' : 'FAILED',
    checks: verificationChecks,
    proof: {
      agreementId: envelope.envelopeId,
      signer: envelope.proofBlock?.signerDisplayName || signedRecipient?.recipientAddress || null,
      signerAddress: signedRecipient?.recipientAddress || null,
      documentHash: envelope.canonicalDocumentHash || envelope.documentOriginalHash || null,
      finalPdfHash: envelope.documentFinalHash || null,
      transactionHash: envelope.anchoredTxHash || null,
      network: envelope.proofBlock?.blockchainNetwork || networkName,
      signedTimestamp: envelope.signedAt || envelope.canonicalSignedAt || signedRecipient?.signedAt || null,
      finalStatus: envelope.auditTrail?.finalStatus || (agreementFinalized ? 'Verified' : envelope.status),
      verificationUrl: envelope.verificationUrl || null,
      explorerUrl: envelope.anchoredTxHash && process.env.BLOCK_EXPLORER_TX_URL
        ? `${process.env.BLOCK_EXPLORER_TX_URL.replace(/\/$/, '')}/${envelope.anchoredTxHash}`
        : null,
      qrPayload: envelope.verificationUrl || null,
    },
  };
}

router.get('/envelopes/:envelopeId/verify', async (req, res) => {
  try {
    const envelope = await Envelope.findOne({ envelopeId: req.params.envelopeId }).lean();
    if (!envelope) {
      return res.status(404).json({ error: 'Envelope not found' });
    }

    const response = await buildVerificationResponse(envelope);
    res.json(response);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/envelopes/:envelopeId/verify', async (req, res) => {
  try {
    const { error, value } = verifyUploadSchema.validate(req.body, { abortEarly: false, stripUnknown: true });
    if (error) {
      return res.status(400).json({ error: error.details.map((detail) => detail.message).join(', ') });
    }

    const envelope = await Envelope.findOne({ envelopeId: req.params.envelopeId }).lean();
    if (!envelope) {
      return res.status(404).json({ error: 'Envelope not found' });
    }

    const pdfBytes = parsePdfBase64(value.pdfBase64);
    const response = await buildVerificationResponse(envelope, sha256Hex(pdfBytes));
    res.json(response);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
