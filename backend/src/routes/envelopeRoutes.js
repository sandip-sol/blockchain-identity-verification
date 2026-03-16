const logger = require('../services/logger');
const express = require('express');
const { ethers } = require('ethers');
const crypto = require('crypto');
const Envelope = require('../models/Envelope');
const Recipient = require('../models/Recipient');
const EnvelopeAuditLog = require('../models/EnvelopeAuditLog');
const ipfsService = require('../services/ipfsService');
const web3Service = require('../services/web3Service');
const { stampSignature } = require('../services/pdfService');

const router = express.Router();

// Helpers
function sha256Hex(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function envelopeIdToBytes32(envelopeId) {
  // Deterministic bytes32 id derived from the envelopeId string
  return ethers.keccak256(ethers.toUtf8Bytes(envelopeId));
}

async function audit(envelopeId, eventType, actor, req, details = {}, txHash = undefined) {
  try {
    await EnvelopeAuditLog.create({
      envelopeId,
      eventType,
      actor,
      details,
      ip: req.headers['x-forwarded-for']?.toString() || req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
      txHash,
    });
  } catch (_) {
    // do not fail API due to audit log
  }
}

/**
 * Create a draft envelope (no file yet)
 * Body: { ownerAddress, title?, description?, expiresAt? }
 */
router.post('/draft', async (req, res) => {
  try {
    const { ownerAddress, title, description, expiresAt } = req.body;
    if (!ownerAddress) return res.status(400).json({ error: 'ownerAddress is required' });

    const envelopeId = crypto.randomUUID();
    const envelopeIdBytes32 = envelopeIdToBytes32(envelopeId);

    const env = await Envelope.create({
      envelopeId,
      envelopeIdBytes32,
      ownerAddress: ownerAddress.toLowerCase(),
      status: 'DRAFT',
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      metadata: { title, description },
    });

    await audit(envelopeId, 'ENVELOPE_CREATED', ownerAddress, req, { title, description });

    // client should sign this message when uploading the document
    const messageToSign = `Create Envelope ${envelopeId} for ${ownerAddress}`;

    res.json({
      envelope: env,
      messageToSign,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * Upload the original PDF to an existing draft
 * Body: { envelopeId, ownerAddress, signature, pdfBase64 }
 */
router.post('/upload', async (req, res) => {
  try {
    const { envelopeId, ownerAddress, signature, pdfBase64 } = req.body;
    if (!envelopeId || !ownerAddress || !signature || !pdfBase64) {
      return res.status(400).json({ error: 'envelopeId, ownerAddress, signature, pdfBase64 are required' });
    }

    const env = await Envelope.findOne({ envelopeId });
    if (!env) return res.status(404).json({ error: 'Envelope not found' });
    if (env.ownerAddress !== ownerAddress.toLowerCase()) {
      return res.status(403).json({ error: 'Not envelope owner' });
    }
    if (env.status !== 'DRAFT') {
      return res.status(400).json({ error: 'Only DRAFT envelopes can upload original document' });
    }

    const expectedMsg = `Create Envelope ${envelopeId} for ${ownerAddress}`;
    const recovered = ethers.verifyMessage(expectedMsg, signature);
    if (recovered.toLowerCase() !== ownerAddress.toLowerCase()) {
      return res.status(401).json({ error: 'Invalid owner signature' });
    }

    const pdfBytes = Buffer.from(pdfBase64, 'base64');
    const hash = sha256Hex(pdfBytes);
    const cid = await ipfsService.uploadRaw(pdfBytes, `envelope-${envelopeId}.pdf`);

    env.documentOriginalCID = cid;
    env.documentOriginalHash = hash;
    await env.save();

    res.json({ envelope: env });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * Add recipients
 * Body: { envelopeId, ownerAddress, signature, recipients: [{ recipientAddress, signingOrder? }] }
 */
router.post('/recipients', async (req, res) => {
  try {
    const { envelopeId, ownerAddress, signature, recipients } = req.body;
    if (!envelopeId || !ownerAddress || !signature || !Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({ error: 'envelopeId, ownerAddress, signature, recipients[] required' });
    }
    const env = await Envelope.findOne({ envelopeId });
    if (!env) return res.status(404).json({ error: 'Envelope not found' });
    if (env.ownerAddress !== ownerAddress.toLowerCase()) return res.status(403).json({ error: 'Not envelope owner' });

    const expectedMsg = `Manage Envelope ${envelopeId} as owner ${ownerAddress}`;
    const recovered = ethers.verifyMessage(expectedMsg, signature);
    if (recovered.toLowerCase() !== ownerAddress.toLowerCase()) {
      return res.status(401).json({ error: 'Invalid owner signature' });
    }

    const created = [];
    for (const r of recipients) {
      if (!r.recipientAddress) continue;
      const rec = await Recipient.findOneAndUpdate(
        { envelopeId, recipientAddress: r.recipientAddress.toLowerCase() },
        {
          $setOnInsert: {
            envelopeId,
            recipientAddress: r.recipientAddress.toLowerCase(),
            role: 'SIGNER',
            signingOrder: Number(r.signingOrder || 1),
            status: 'PENDING',
            nonce: 0,
          },
        },
        { upsert: true, new: true }
      );
      created.push(rec);
      await audit(envelopeId, 'RECIPIENT_ADDED', ownerAddress, req, { recipientAddress: rec.recipientAddress, signingOrder: rec.signingOrder });
    }

    // Envelope becomes IN_PROGRESS once there is at least one recipient
    if (env.status === 'DRAFT') {
      env.status = 'IN_PROGRESS';
      await env.save();
    }

    res.json({ envelope: env, recipients: created });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * Send envelope (locks recipients for MVP)
 * Body: { envelopeId, ownerAddress, signature }
 */
router.post('/send', async (req, res) => {
  try {
    const { envelopeId, ownerAddress, signature } = req.body;
    if (!envelopeId || !ownerAddress || !signature) {
      return res.status(400).json({ error: 'envelopeId, ownerAddress, signature required' });
    }
    const env = await Envelope.findOne({ envelopeId });
    if (!env) return res.status(404).json({ error: 'Envelope not found' });
    if (env.ownerAddress !== ownerAddress.toLowerCase()) return res.status(403).json({ error: 'Not envelope owner' });
    if (!env.documentOriginalCID) return res.status(400).json({ error: 'Upload PDF first' });

    const expectedMsg = `Send Envelope ${envelopeId} by owner ${ownerAddress}`;
    const recovered = ethers.verifyMessage(expectedMsg, signature);
    if (recovered.toLowerCase() !== ownerAddress.toLowerCase()) {
      return res.status(401).json({ error: 'Invalid owner signature' });
    }

    env.status = 'SENT';
    await env.save();
    await audit(envelopeId, 'ENVELOPE_SENT', ownerAddress, req);
    res.json({ envelope: env });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * Get envelope + recipients + audit logs
 */
router.get('/:envelopeId', async (req, res) => {
  try {
    const { envelopeId } = req.params;
    const env = await Envelope.findOne({ envelopeId });
    if (!env) return res.status(404).json({ error: 'Envelope not found' });
    const recipients = await Recipient.find({ envelopeId }).sort({ signingOrder: 1 });
    const auditLogs = await EnvelopeAuditLog.find({ envelopeId }).sort({ createdAt: 1 }).limit(200);
    res.json({ envelope: env, recipients, auditLogs });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * Verify an envelope on-chain (if anchored)
 * GET /api/envelopes/:envelopeId/verify
 */
router.get('/:envelopeId/verify', async (req, res) => {
  try {
    const { envelopeId } = req.params;
    const env = await Envelope.findOne({ envelopeId });
    if (!env) return res.status(404).json({ error: 'Envelope not found' });

    const envelopeIdBytes32 = env.envelopeIdBytes32 || envelopeIdToBytes32(envelopeId);
    if (!web3Service.isInitialized) {
      return res.status(200).json({
        anchored: Boolean(env.anchoredTxHash),
        message: 'Web3 service not initialized on backend',
        local: {
          envelopeId,
          finalHash: env.documentFinalHash || null,
          finalCID: env.documentFinalCID || null,
          anchoredTxHash: env.anchoredTxHash || null,
        },
      });
    }

    const c = web3Service.contracts.documentRegistry;
    if (!c) {
      return res.status(200).json({
        anchored: Boolean(env.anchoredTxHash),
        message: 'DocumentSignatureRegistry not configured on backend',
        local: {
          envelopeId,
          finalHash: env.documentFinalHash || null,
          finalCID: env.documentFinalCID || null,
          anchoredTxHash: env.anchoredTxHash || null,
        },
      });
    }

    const onchain = await c.getEnvelope(envelopeIdBytes32);
    // getEnvelope returns (bytes32 documentHash, address[] signers, uint256 completedAt, string finalCID, bool exists)
    const exists = Boolean(onchain[4]);
    const documentHash = onchain[0];
    const signers = Array.isArray(onchain[1]) ? onchain[1].map(a => String(a).toLowerCase()) : [];
    const completedAt = Number(onchain[2] || 0);
    const finalCID = String(onchain[3] || '');

    // Compare with local final hash if available
    let localBytes32 = null;
    let hashMatches = null;
    if (env.documentFinalHash) {
      localBytes32 = ethers.hexlify(Buffer.from(env.documentFinalHash, 'hex'));
      hashMatches = exists ? (localBytes32.toLowerCase() === String(documentHash).toLowerCase()) : false;
    }

    res.json({
      anchored: Boolean(env.anchoredTxHash),
      local: {
        envelopeId,
        finalHash: env.documentFinalHash || null,
        finalCID: env.documentFinalCID || null,
        anchoredTxHash: env.anchoredTxHash || null,
      },
      onchain: {
        exists,
        envelopeIdBytes32,
        documentHash: String(documentHash),
        signers,
        completedAt: completedAt ? new Date(completedAt * 1000).toISOString() : null,
        finalCID,
      },
      hashMatches,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * Get EIP-712 typed-data for signing
 * Query: recipientAddress
 */
router.get('/:envelopeId/typed-data', async (req, res) => {
  try {
    const { envelopeId } = req.params;
    const rawAddr = (req.query.recipientAddress || '').toString().trim();
    if (!rawAddr) return res.status(400).json({ error: 'recipientAddress query param is required' });

    // Use checksum address for EIP-712 typed data (must match exactly on both sides)
    const checksumAddress = ethers.getAddress(rawAddr);
    const recipientAddress = checksumAddress.toLowerCase(); // for DB lookup only

    const env = await Envelope.findOne({ envelopeId });
    if (!env) return res.status(404).json({ error: 'Envelope not found' });
    if (!env.documentOriginalHash) return res.status(400).json({ error: 'Envelope has no document' });

    const rec = await Recipient.findOne({ envelopeId, recipientAddress });
    if (!rec) return res.status(404).json({ error: 'Recipient not found for this envelope' });

    const chainId = Number(process.env.CHAIN_ID || 31337);
    const envelopeIdBytes32 = env.envelopeIdBytes32 || envelopeIdToBytes32(envelopeId);

    const domain = {
      name: 'BlockchainIdentityVerification',
      version: '1',
      chainId,
      verifyingContract: process.env.DOCUSIGN_REGISTRY_ADDRESS || ethers.ZeroAddress,
    };

    const types = {
      EnvelopeSign: [
        { name: 'envelopeId', type: 'bytes32' },
        { name: 'documentHash', type: 'bytes32' },
        { name: 'recipient', type: 'address' },
        { name: 'nonce', type: 'uint256' },
        { name: 'deadline', type: 'uint256' },
      ],
    };

    const deadline = Math.floor((Date.now() + 1000 * 60 * 60 * 24) / 1000); // 24h
    rec.deadline = new Date(deadline * 1000);
    await rec.save();

    const documentHashHex = '0x' + env.documentOriginalHash;

    const message = {
      envelopeId: envelopeIdBytes32,
      documentHash: documentHashHex,
      recipient: checksumAddress,
      nonce: rec.nonce,
      deadline,
    };

    const typedDataHash = ethers.TypedDataEncoder.hash(domain, types, message);
    res.json({ domain, types, message, typedDataHash, envelopeId, recipientAddress: checksumAddress, nonce: rec.nonce, deadline });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * Recipient signs envelope (wallet-based) + optional visual signature stamping
 * Body: { envelopeId, recipientAddress, signature, signatureImageBase64?, placement? }
 */
router.post('/:envelopeId/sign', async (req, res) => {
  try {
    const { envelopeId } = req.params;
    const { recipientAddress, signature, signatureImageBase64, placement } = req.body;
    if (!recipientAddress || !signature) {
      return res.status(400).json({ error: 'recipientAddress and signature are required' });
    }

    // Use checksum address for EIP-712 verification (must match what the user signed)
    const checksumAddress = ethers.getAddress(recipientAddress);

    const env = await Envelope.findOne({ envelopeId });
    if (!env) return res.status(404).json({ error: 'Envelope not found' });
    if (!env.documentOriginalCID || !env.documentOriginalHash) return res.status(400).json({ error: 'Envelope has no document' });
    if (env.status === 'COMPLETED' || env.status === 'VOID') return res.status(400).json({ error: 'Envelope not signable' });

    const rec = await Recipient.findOne({ envelopeId, recipientAddress: checksumAddress.toLowerCase() });
    if (!rec) return res.status(404).json({ error: 'Recipient not found for this envelope' });
    if (rec.status === 'SIGNED') return res.status(400).json({ error: 'Recipient already signed' });

    const chainId = Number(process.env.CHAIN_ID || 31337);
    const envelopeIdBytes32 = env.envelopeIdBytes32 || envelopeIdToBytes32(envelopeId);

    const domain = {
      name: 'BlockchainIdentityVerification',
      version: '1',
      chainId,
      verifyingContract: process.env.DOCUSIGN_REGISTRY_ADDRESS || ethers.ZeroAddress,
    };
    const types = {
      EnvelopeSign: [
        { name: 'envelopeId', type: 'bytes32' },
        { name: 'documentHash', type: 'bytes32' },
        { name: 'recipient', type: 'address' },
        { name: 'nonce', type: 'uint256' },
        { name: 'deadline', type: 'uint256' },
      ],
    };

    const deadline = rec.deadline ? Math.floor(rec.deadline.getTime() / 1000) : Math.floor((Date.now() + 1000 * 60 * 60 * 24) / 1000);
    if (deadline < Math.floor(Date.now() / 1000)) {
      return res.status(400).json({ error: 'Signature deadline expired. Request typed-data again.' });
    }

    const documentHashHex = '0x' + env.documentOriginalHash;

    const message = {
      envelopeId: envelopeIdBytes32,
      documentHash: documentHashHex,
      recipient: checksumAddress,
      nonce: rec.nonce,
      deadline,
    };

    const recovered = ethers.verifyTypedData(domain, types, message, signature);
    if (recovered.toLowerCase() !== checksumAddress.toLowerCase()) {
      return res.status(401).json({ error: 'Invalid typed-data signature' });
    }

    const typedDataHash = ethers.TypedDataEncoder.hash(domain, types, message);

    // Optionally store a visual signature image (PNG) and stamp it into a running "final" PDF
    let currentPdfBytes;
    if (env.documentFinalCID) {
      currentPdfBytes = await ipfsService.retrieveRaw(env.documentFinalCID);
    } else {
      currentPdfBytes = await ipfsService.retrieveRaw(env.documentOriginalCID);
    }

    let updatedPdfBytes = Buffer.from(currentPdfBytes);
    let signatureImageCID;
    let signatureImageHash;
    // Digital identity number (IdentityToken id) if signer has KYC SBT
    const identityTokenId = await web3Service.getIdentityTokenId(checksumAddress);
    if (signatureImageBase64) {
      const sigBytes = Buffer.from(signatureImageBase64, 'base64');
      signatureImageHash = sha256Hex(sigBytes);
      signatureImageCID = await ipfsService.uploadRaw(sigBytes, `signature-${envelopeId}-${checksumAddress}.png`);

      const p = placement || {};
      updatedPdfBytes = await stampSignature({
        pdfBytes: updatedPdfBytes,
        signaturePngBytes: sigBytes,
        pageIndex: Number(p.pageIndex || 0),
        x: Number(p.x || 50),
        y: Number(p.y || 50),
        width: Number(p.width || 160),
        height: Number(p.height || 60),
        labelText: identityTokenId ? `DID: ${identityTokenId} · Signed: ${new Date().toISOString()}` : `Signed: ${new Date().toISOString()}`,
      });
    }

    // Upload the updated running PDF as the "final" version-in-progress
    const newFinalHash = sha256Hex(updatedPdfBytes);
    const newFinalCID = await ipfsService.uploadRaw(updatedPdfBytes, `envelope-${envelopeId}-signed.pdf`);

    env.documentFinalCID = newFinalCID;
    env.documentFinalHash = newFinalHash;
    // Keep status IN_PROGRESS until all signed
    env.status = 'IN_PROGRESS';
    await env.save();

    rec.status = 'SIGNED';
    rec.signature = signature;
    rec.typedDataHash = typedDataHash;
    rec.signatureImageCID = signatureImageCID;
    rec.signatureImageHash = signatureImageHash;
    rec.signedAt = new Date();
    rec.identityTokenId = identityTokenId;
    rec.nonce = rec.nonce + 1;
    await rec.save();

    await audit(envelopeId, 'RECIPIENT_SIGNED', recipientAddress, req, { typedDataHash });

    // If all recipients signed, complete envelope and optionally anchor on-chain
    const remaining = await Recipient.countDocuments({ envelopeId, role: 'SIGNER', status: { $ne: 'SIGNED' } });
    if (remaining === 0) {
      env.status = 'COMPLETED';
      await env.save();

      let anchoredTxHash;
      if (web3Service.isInitialized && web3Service.contracts.documentRegistry) {
        try {
          const signers = (await Recipient.find({ envelopeId, role: 'SIGNER' })).map(r => r.recipientAddress);
          const { txHash } = await web3Service.anchorEnvelope({
            envelopeIdBytes32,
            documentFinalHash: '0x' + env.documentFinalHash,
            signers,
            finalCID: env.documentFinalCID,
          });
          anchoredTxHash = txHash;
          env.anchoredTxHash = txHash;
          env.anchoredAt = new Date();
          await env.save();
        } catch (e) {
          // anchoring optional
        }
      }

      await audit(envelopeId, 'ENVELOPE_COMPLETED', env.ownerAddress, req, { finalCID: env.documentFinalCID, finalHash: env.documentFinalHash }, anchoredTxHash);
    }

    res.json({ envelope: env, recipient: rec });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
