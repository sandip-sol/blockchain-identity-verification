const express = require('express');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const Joi = require('joi');
const { ethers } = require('ethers');

const authMiddleware = require('../middleware/authMiddleware');
const logger = require('../services/logger');
const Envelope = require('../models/Envelope');
const Recipient = require('../models/Recipient');
const EnvelopeAuditLog = require('../models/EnvelopeAuditLog');
const ipfsService = require('../services/ipfsService');
const web3Service = require('../services/web3Service');
const { stampSignature, addProofPages } = require('../services/pdfService');
const {
  resolveEnvelopeAccess,
  canAccessEnvelope,
  requireLinkedWallet,
  normalizeAddress,
} = require('../services/envelopeAccessService');
const Account = require('../models/Account');
const {
  sha256Hex,
  buildVerificationUrl,
  getNetworkName,
  buildProofBlockData,
  extractAuditTrail,
} = require('../utils/proofUtils');
const { buildQrPngBuffer } = require('../utils/qrCode');

const router = express.Router();
router.use(authMiddleware);

const envelopeMutationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40,
  message: { error: 'Too many envelope requests. Please try again later.' },
});

const signLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many signing attempts. Please try again later.' },
});

const MAX_PDF_BYTES = 8 * 1024 * 1024;
const MAX_SIGNATURE_IMAGE_BYTES = 1024 * 1024;
const MAX_RECIPIENTS = 25;
const MAX_TITLE_LENGTH = 150;
const MAX_DESCRIPTION_LENGTH = 500;
const ENVELOPE_SIGNING_INTENT = 'SIGN_ENVELOPE_SOURCE_V1';

const draftSchema = Joi.object({
  ownerAddress: Joi.string().required(),
  title: Joi.string().trim().max(MAX_TITLE_LENGTH).allow('', null),
  description: Joi.string().trim().max(MAX_DESCRIPTION_LENGTH).allow('', null),
  expiresAt: Joi.date().iso().greater('now').optional(),
});

const uploadSchema = Joi.object({
  envelopeId: Joi.string().trim().required(),
  ownerAddress: Joi.string().required(),
  signature: Joi.string().trim().required(),
  pdfBase64: Joi.string().trim().required(),
});

const recipientsSchema = Joi.object({
  envelopeId: Joi.string().trim().required(),
  ownerAddress: Joi.string().required(),
  signature: Joi.string().trim().required(),
  recipients: Joi.array().items(
    Joi.object({
      recipientAddress: Joi.string().required(),
      signingOrder: Joi.number().integer().min(1).required(),
    })
  ).min(1).max(MAX_RECIPIENTS).required(),
});

const sendSchema = Joi.object({
  envelopeId: Joi.string().trim().required(),
  ownerAddress: Joi.string().required(),
  signature: Joi.string().trim().required(),
});

const signSchema = Joi.object({
  recipientAddress: Joi.string().required(),
  signature: Joi.string().trim().required(),
  signatureImageBase64: Joi.string().trim().optional(),
  placement: Joi.object({
    pageIndex: Joi.number().integer().min(0).max(999).default(0),
    x: Joi.number().min(0).max(2000).default(50),
    y: Joi.number().min(0).max(2000).default(50),
    width: Joi.number().greater(0).max(800).default(160),
    height: Joi.number().greater(0).max(800).default(60),
  }).optional(),
});

const voidSchema = Joi.object({
  reason: Joi.string().trim().min(3).max(300).required(),
});

function envelopeIdToBytes32(envelopeId) {
  return ethers.keccak256(ethers.toUtf8Bytes(envelopeId));
}

function validateBody(schema, body) {
  const { error, value } = schema.validate(body, { abortEarly: false, stripUnknown: true });
  if (error) {
    return { error: error.details.map((d) => d.message).join(', ') };
  }
  return { value };
}

function ensureChecksumAddress(value, fieldName) {
  try {
    return ethers.getAddress(value);
  } catch {
    throw new Error(`${fieldName} must be a valid wallet address`);
  }
}

function parsePdfBase64(pdfBase64) {
  const bytes = Buffer.from(pdfBase64, 'base64');
  if (!bytes.length || bytes.length > MAX_PDF_BYTES) {
    throw new Error(`PDF must be between 1 byte and ${MAX_PDF_BYTES} bytes`);
  }
  if (bytes.slice(0, 4).toString('utf8') !== '%PDF') {
    throw new Error('Uploaded file must be a valid PDF');
  }
  return bytes;
}

function parseSignaturePng(signatureImageBase64) {
  if (!signatureImageBase64) return null;
  const bytes = Buffer.from(signatureImageBase64, 'base64');
  if (!bytes.length || bytes.length > MAX_SIGNATURE_IMAGE_BYTES) {
    throw new Error(`Signature image must be between 1 byte and ${MAX_SIGNATURE_IMAGE_BYTES} bytes`);
  }
  const pngHeader = bytes.subarray(0, 8).toString('hex');
  if (pngHeader !== '89504e470d0a1a0a') {
    throw new Error('Signature image must be a PNG');
  }
  return bytes;
}

function isExpired(env) {
  return Boolean(env?.expiresAt && new Date(env.expiresAt).getTime() < Date.now());
}

function buildOwnerMessage(action, envelopeId, ownerAddress) {
  if (action === 'create') return `Create Envelope ${envelopeId} for ${ownerAddress}`;
  if (action === 'manage') return `Manage Envelope ${envelopeId} as owner ${ownerAddress}`;
  if (action === 'send') return `Send Envelope ${envelopeId} by owner ${ownerAddress}`;
  if (action === 'void') return `Void Envelope ${envelopeId} by owner ${ownerAddress}`;
  throw new Error(`Unknown owner action: ${action}`);
}

function buildEnvelopeSignTypedData({ envelopeIdBytes32, documentHashHex, recipient, nonce, deadline }) {
  const chainId = Number(process.env.CHAIN_ID || 31337);
  return {
    domain: {
      name: 'BlockchainIdentityVerification',
      version: '2',
      chainId,
      verifyingContract: process.env.DOCUSIGN_REGISTRY_ADDRESS || ethers.ZeroAddress,
    },
    types: {
      EnvelopeSign: [
        { name: 'intent', type: 'string' },
        { name: 'envelopeId', type: 'bytes32' },
        { name: 'documentHash', type: 'bytes32' },
        { name: 'recipient', type: 'address' },
        { name: 'nonce', type: 'uint256' },
        { name: 'deadline', type: 'uint256' },
      ],
    },
    primaryType: 'EnvelopeSign',
    message: {
      intent: ENVELOPE_SIGNING_INTENT,
      envelopeId: envelopeIdBytes32,
      documentHash: documentHashHex,
      recipient,
      nonce,
      deadline,
    },
  };
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
  } catch (error) {
    logger.warn('Envelope audit write failed', { envelopeId, eventType, error: error.message });
  }
}

async function loadEnvelopeOr404(res, envelopeId) {
  const env = await Envelope.findOne({ envelopeId });
  if (!env) {
    res.status(404).json({ error: 'Envelope not found' });
    return null;
  }
  return env;
}

async function requireEnvelopeMembership(req, res, envelope) {
  const access = await resolveEnvelopeAccess({ envelope, user: req.user });
  if (!requireLinkedWallet(access)) {
    res.status(403).json({ error: 'Link a wallet to access envelope features' });
    return null;
  }
  if (!canAccessEnvelope(access)) {
    res.status(403).json({ error: 'You do not have access to this envelope' });
    return null;
  }
  if (isExpired(envelope) && !access.isOwner && envelope.status !== 'COMPLETED') {
    res.status(410).json({ error: 'Envelope access has expired' });
    return null;
  }
  return access;
}

async function requireEnvelopeOwner(req, res, envelope, ownerAddress) {
  const access = await resolveEnvelopeAccess({ envelope, user: req.user });
  if (!requireLinkedWallet(access)) {
    res.status(403).json({ error: 'Link a wallet to use envelope owner actions' });
    return null;
  }
  if (!access.isOwner) {
    res.status(403).json({ error: 'Only the envelope owner can perform this action' });
    return null;
  }
  if (normalizeAddress(ownerAddress) !== access.linkedAddress) {
    res.status(403).json({ error: 'ownerAddress does not match your linked wallet' });
    return null;
  }
  return access;
}

function summarizeEnvelope(env, access, recipients, auditLogs) {
  const pendingSigner = recipients
    .filter((r) => r.role === 'SIGNER' && r.status !== 'SIGNED')
    .sort((a, b) => a.signingOrder - b.signingOrder)[0] || null;

  const recipientViews = recipients.map((r) => ({
    recipientAddress: r.recipientAddress,
    role: r.role,
    signingOrder: r.signingOrder,
    status: r.status,
    signedAt: r.signedAt || null,
    identityTokenId: r.identityTokenId || null,
    typedDataHash: access.isOwner ? (r.typedDataHash || null) : undefined,
    canSignNow: r.role === 'SIGNER' && r.status !== 'SIGNED' && pendingSigner && pendingSigner.signingOrder === r.signingOrder,
    signingState: r.status === 'SIGNED'
      ? 'SIGNED'
      : env.status === 'VOID'
        ? 'VOIDED'
        : isExpired(env)
          ? 'EXPIRED'
          : pendingSigner && pendingSigner.signingOrder === r.signingOrder
            ? 'READY_TO_SIGN'
            : 'WAITING_FOR_PREVIOUS_SIGNER',
  }));

  const technicalProof = {
    sourceDocumentHash: env.canonicalDocumentHash || env.documentOriginalHash || null,
    renderedDocumentHash: env.documentFinalHash || null,
    renderedDocumentCID: access.isOwner ? (env.documentFinalCID || null) : null,
    anchoredTxHash: env.anchoredTxHash || null,
    anchoredAt: env.anchoredAt || null,
  };

  return {
    envelope: {
      envelopeId: env.envelopeId,
      ownerAddress: access.isOwner ? env.ownerAddress : undefined,
      status: env.status,
      expiresAt: env.expiresAt || null,
      voidReason: env.status === 'VOID' ? env.voidReason || null : null,
      voidedAt: env.voidedAt || null,
      metadata: env.metadata || {},
      hasOriginalDocument: Boolean(env.documentOriginalCID),
      hasFinalDocument: Boolean(env.documentFinalCID),
      currentSigner: pendingSigner ? pendingSigner.recipientAddress : null,
      nextAction: env.status === 'VOID'
        ? 'Envelope voided'
        : env.status === 'COMPLETED'
          ? 'All signatures collected'
          : isExpired(env)
            ? 'Envelope expired'
            : pendingSigner
              ? `Awaiting signature from ${pendingSigner.recipientAddress}`
              : 'Ready to complete',
    },
    access: {
      isOwner: access.isOwner,
      isRecipient: access.isRecipient,
      linkedAddress: access.linkedAddress,
    },
    recipients: recipientViews,
    proof: {
      canonical: {
        signedSourceHash: env.canonicalDocumentHash || env.documentOriginalHash || null,
        signedAt: env.canonicalSignedAt || null,
      },
      rendered: {
        finalHash: env.documentFinalHash || null,
        hasFinalDocument: Boolean(env.documentFinalCID),
      },
      anchor: {
        txHash: env.anchoredTxHash || null,
        anchoredAt: env.anchoredAt || null,
      },
      summary: env.proofBlock || null,
      auditTrail: env.auditTrail || null,
      verificationUrl: env.verificationUrl || null,
      technical: technicalProof,
    },
    documents: {
      original: env.documentOriginalCID ? `/api/envelopes/${env.envelopeId}/document/original` : null,
      final: env.documentFinalCID ? `/api/envelopes/${env.envelopeId}/document/final` : null,
    },
    auditLogs: auditLogs.map((l) => ({
      eventType: l.eventType,
      actor: l.actor,
      txHash: l.txHash || null,
      createdAt: l.createdAt,
      details: access.isOwner ? (l.details || {}) : undefined,
    })),
  };
}

function summarizeEnvelopeListItem(env, membership = {}) {
  return {
    envelopeId: env.envelopeId,
    status: env.status,
    metadata: env.metadata || {},
    createdAt: env.createdAt || null,
    updatedAt: env.updatedAt || null,
    expiresAt: env.expiresAt || null,
    voidedAt: env.voidedAt || null,
    currentSigner: membership.currentSigner || null,
    nextAction: membership.nextAction || null,
    signerProgress: {
      signed: membership.signedCount || 0,
      total: membership.totalSigners || 0,
    },
    hasOriginalDocument: Boolean(env.documentOriginalCID),
    hasFinalDocument: Boolean(env.documentFinalCID),
    anchored: Boolean(env.anchoredTxHash),
    role: membership.role || 'OWNER',
    recipientStatus: membership.recipientStatus || null,
  };
}

async function sendDocument(res, { env, cid, kind }) {
  const bytes = await ipfsService.retrieveRaw(cid);
  const safeId = String(env.envelopeId).replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `${safeId}-${kind}.pdf`;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
  res.send(bytes);
}

router.get('/mine', async (req, res) => {
  try {
    const account = req.user?.sub ? await Account.findById(req.user.sub) : null;
    const linkedAddress = normalizeAddress(account?.address);
    if (!linkedAddress) {
      return res.status(403).json({ error: 'Link a wallet to access your envelopes' });
    }

    const [owned, assigned] = await Promise.all([
      Envelope.find({ ownerAddress: linkedAddress }).sort({ updatedAt: -1 }).limit(100),
      Recipient.find({ recipientAddress: linkedAddress }).sort({ updatedAt: -1 }).limit(100),
    ]);

    const assignedEnvelopeIds = [...new Set(assigned.map((r) => r.envelopeId))];
    const assignedEnvelopes = assignedEnvelopeIds.length
      ? await Envelope.find({ envelopeId: { $in: assignedEnvelopeIds } }).sort({ updatedAt: -1 }).limit(100)
      : [];

    const allIds = [...new Set([...owned.map((e) => e.envelopeId), ...assignedEnvelopeIds])];
    const recipientRows = allIds.length
      ? await Recipient.find({ envelopeId: { $in: allIds } }).sort({ signingOrder: 1 })
      : [];

    const recipientMap = recipientRows.reduce((acc, row) => {
      if (!acc[row.envelopeId]) acc[row.envelopeId] = [];
      acc[row.envelopeId].push(row);
      return acc;
    }, {});

    const assignedMap = assigned.reduce((acc, row) => {
      acc[row.envelopeId] = row;
      return acc;
    }, {});

    const buildMembership = (env, role) => {
      const rows = recipientMap[env.envelopeId] || [];
      const signedCount = rows.filter((r) => r.role === 'SIGNER' && r.status === 'SIGNED').length;
      const totalSigners = rows.filter((r) => r.role === 'SIGNER').length;
      const pending = rows
        .filter((r) => r.role === 'SIGNER' && r.status !== 'SIGNED')
        .sort((a, b) => a.signingOrder - b.signingOrder)[0] || null;
      const assignedRow = assignedMap[env.envelopeId] || null;
      return {
        role,
        signedCount,
        totalSigners,
        currentSigner: pending?.recipientAddress || null,
        nextAction: env.status === 'VOID'
          ? 'Envelope voided'
          : env.status === 'COMPLETED'
            ? 'Completed'
            : pending
              ? `Awaiting ${pending.recipientAddress}`
              : 'Ready to complete',
        recipientStatus: assignedRow?.status || null,
      };
    };

    const ownedItems = owned.map((env) => summarizeEnvelopeListItem(env, buildMembership(env, 'OWNER')));
    const assignedItems = assignedEnvelopes
      .filter((env) => !owned.find((ownedEnv) => ownedEnv.envelopeId === env.envelopeId))
      .map((env) => summarizeEnvelopeListItem(env, buildMembership(env, 'RECIPIENT')));

    res.json({
      linkedAddress,
      owned: ownedItems,
      assigned: assignedItems,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/draft', envelopeMutationLimiter, async (req, res) => {
  try {
    const { error, value } = validateBody(draftSchema, req.body);
    if (error) return res.status(400).json({ error });

    const ownerAddress = ensureChecksumAddress(value.ownerAddress, 'ownerAddress');
    const account = await requireEnvelopeOwner(req, res, { ownerAddress }, ownerAddress);
    if (!account) return;

    const envelopeId = crypto.randomUUID();
    const envelopeIdBytes32 = envelopeIdToBytes32(envelopeId);

    const env = await Envelope.create({
      envelopeId,
      envelopeIdBytes32,
      ownerAddress: ownerAddress.toLowerCase(),
      status: 'DRAFT',
      expiresAt: value.expiresAt ? new Date(value.expiresAt) : undefined,
      metadata: {
        title: value.title || undefined,
        description: value.description || undefined,
      },
    });

    await audit(envelopeId, 'ENVELOPE_CREATED', ownerAddress.toLowerCase(), req, { title: value.title, description: value.description });

    res.json({
      envelope: {
        envelopeId: env.envelopeId,
        status: env.status,
        metadata: env.metadata,
        expiresAt: env.expiresAt || null,
      },
      messageToSign: buildOwnerMessage('create', envelopeId, ownerAddress),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/upload', envelopeMutationLimiter, async (req, res) => {
  try {
    const { error, value } = validateBody(uploadSchema, req.body);
    if (error) return res.status(400).json({ error });

    const env = await loadEnvelopeOr404(res, value.envelopeId);
    if (!env) return;

    const ownerAddress = ensureChecksumAddress(value.ownerAddress, 'ownerAddress');
    const access = await requireEnvelopeOwner(req, res, env, ownerAddress);
    if (!access) return;
    if (env.status !== 'DRAFT') {
      return res.status(400).json({ error: 'Only DRAFT envelopes can upload the source document' });
    }

    const expectedMsg = buildOwnerMessage('create', env.envelopeId, ownerAddress);
    const recovered = ethers.verifyMessage(expectedMsg, value.signature);
    if (normalizeAddress(recovered) !== normalizeAddress(ownerAddress)) {
      return res.status(401).json({ error: 'Invalid owner signature' });
    }

    const pdfBytes = parsePdfBase64(value.pdfBase64);
    const hash = sha256Hex(pdfBytes);
    const cid = await ipfsService.uploadRaw(pdfBytes, `envelope-${env.envelopeId}.pdf`);

    env.documentOriginalCID = cid;
    env.documentOriginalHash = hash;
    env.canonicalDocumentHash = hash;
    await env.save();

    await audit(env.envelopeId, 'ENVELOPE_CREATED', access.linkedAddress, req, { sourceDocumentHash: hash });

    res.json({
      envelope: {
        envelopeId: env.envelopeId,
        status: env.status,
        hasOriginalDocument: true,
        canonicalDocumentHash: env.canonicalDocumentHash,
      },
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/recipients', envelopeMutationLimiter, async (req, res) => {
  try {
    const { error, value } = validateBody(recipientsSchema, req.body);
    if (error) return res.status(400).json({ error });

    const env = await loadEnvelopeOr404(res, value.envelopeId);
    if (!env) return;

    const ownerAddress = ensureChecksumAddress(value.ownerAddress, 'ownerAddress');
    const access = await requireEnvelopeOwner(req, res, env, ownerAddress);
    if (!access) return;
    if (env.status !== 'DRAFT') {
      return res.status(400).json({ error: 'Recipients can only be added or changed while the envelope is in DRAFT' });
    }

    const expectedMsg = buildOwnerMessage('manage', env.envelopeId, ownerAddress);
    const recovered = ethers.verifyMessage(expectedMsg, value.signature);
    if (normalizeAddress(recovered) !== normalizeAddress(ownerAddress)) {
      return res.status(401).json({ error: 'Invalid owner signature' });
    }

    const normalizedRecipients = value.recipients.map((r) => ({
      recipientAddress: ensureChecksumAddress(r.recipientAddress, 'recipientAddress').toLowerCase(),
      signingOrder: Number(r.signingOrder),
    }));

    const uniqueAddresses = new Set(normalizedRecipients.map((r) => r.recipientAddress));
    if (uniqueAddresses.size !== normalizedRecipients.length) {
      return res.status(400).json({ error: 'Recipient addresses must be unique' });
    }

    await Recipient.deleteMany({ envelopeId: env.envelopeId });
    const created = [];
    for (const recipientData of normalizedRecipients) {
      const rec = await Recipient.create({
        envelopeId: env.envelopeId,
        recipientAddress: recipientData.recipientAddress,
        role: 'SIGNER',
        signingOrder: recipientData.signingOrder,
        status: 'PENDING',
        nonce: 0,
      });
      created.push(rec);
      await audit(env.envelopeId, 'RECIPIENT_ADDED', access.linkedAddress, req, {
        recipientAddress: rec.recipientAddress,
        signingOrder: rec.signingOrder,
      });
    }

    res.json({
      envelope: { envelopeId: env.envelopeId, status: env.status },
      recipients: created.map((rec) => ({
        recipientAddress: rec.recipientAddress,
        signingOrder: rec.signingOrder,
        status: rec.status,
      })),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/send', envelopeMutationLimiter, async (req, res) => {
  try {
    const { error, value } = validateBody(sendSchema, req.body);
    if (error) return res.status(400).json({ error });

    const env = await loadEnvelopeOr404(res, value.envelopeId);
    if (!env) return;

    const ownerAddress = ensureChecksumAddress(value.ownerAddress, 'ownerAddress');
    const access = await requireEnvelopeOwner(req, res, env, ownerAddress);
    if (!access) return;
    if (isExpired(env)) {
      return res.status(400).json({ error: 'Envelope has already expired' });
    }
    if (!env.documentOriginalCID || !env.documentOriginalHash) {
      return res.status(400).json({ error: 'Upload the source PDF before sending' });
    }
    const signerCount = await Recipient.countDocuments({ envelopeId: env.envelopeId, role: 'SIGNER' });
    if (!signerCount) {
      return res.status(400).json({ error: 'Add at least one signer before sending' });
    }

    const expectedMsg = buildOwnerMessage('send', env.envelopeId, ownerAddress);
    const recovered = ethers.verifyMessage(expectedMsg, value.signature);
    if (normalizeAddress(recovered) !== normalizeAddress(ownerAddress)) {
      return res.status(401).json({ error: 'Invalid owner signature' });
    }

    env.status = 'SENT';
    await env.save();
    await audit(env.envelopeId, 'ENVELOPE_SENT', access.linkedAddress, req);
    res.json({ envelope: { envelopeId: env.envelopeId, status: env.status } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/:envelopeId', async (req, res) => {
  try {
    const env = await loadEnvelopeOr404(res, req.params.envelopeId);
    if (!env) return;
    const access = await requireEnvelopeMembership(req, res, env);
    if (!access) return;

    const recipients = await Recipient.find({ envelopeId: env.envelopeId }).sort({ signingOrder: 1 });
    const auditLogs = await EnvelopeAuditLog.find({ envelopeId: env.envelopeId }).sort({ createdAt: 1 }).limit(200);
    res.json(summarizeEnvelope(env, access, recipients, auditLogs));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/:envelopeId/document/:kind(original|final)', async (req, res) => {
  try {
    const env = await loadEnvelopeOr404(res, req.params.envelopeId);
    if (!env) return;
    const access = await requireEnvelopeMembership(req, res, env);
    if (!access) return;

    const cid = req.params.kind === 'original' ? env.documentOriginalCID : env.documentFinalCID;
    if (!cid) return res.status(404).json({ error: 'Document not available' });
    await sendDocument(res, { env, cid, kind: req.params.kind });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/:envelopeId/void', envelopeMutationLimiter, async (req, res) => {
  try {
    const { error, value } = validateBody(voidSchema, req.body);
    if (error) return res.status(400).json({ error });

    const env = await loadEnvelopeOr404(res, req.params.envelopeId);
    if (!env) return;
    const access = await requireEnvelopeOwner(req, res, env, env.ownerAddress);
    if (!access) return;
    if (env.status === 'COMPLETED') {
      return res.status(400).json({ error: 'Completed envelopes cannot be voided' });
    }
    if (env.status === 'VOID') {
      return res.status(400).json({ error: 'Envelope is already voided' });
    }

    env.status = 'VOID';
    env.voidReason = value.reason;
    env.voidedAt = new Date();
    await env.save();
    await audit(env.envelopeId, 'ENVELOPE_VOIDED', access.linkedAddress, req, { reason: value.reason });

    res.json({
      envelope: {
        envelopeId: env.envelopeId,
        status: env.status,
        voidReason: env.voidReason,
        voidedAt: env.voidedAt,
      },
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/:envelopeId/verify', async (req, res) => {
  try {
    const env = await loadEnvelopeOr404(res, req.params.envelopeId);
    if (!env) return;
    const access = await requireEnvelopeMembership(req, res, env);
    if (!access) return;

    const envelopeIdBytes32 = env.envelopeIdBytes32 || envelopeIdToBytes32(env.envelopeId);
    const localCanonicalBytes32 = env.canonicalDocumentHash
      ? ethers.hexlify(Buffer.from(env.canonicalDocumentHash, 'hex'))
      : null;

    if (!web3Service.isInitialized || !web3Service.contracts.documentRegistry) {
      return res.json({
        anchored: Boolean(env.anchoredTxHash),
        canonical: {
          signedSourceHash: env.canonicalDocumentHash || env.documentOriginalHash || null,
          anchoredSourceHashMatches: null,
        },
        rendered: {
          finalHash: env.documentFinalHash || null,
          finalCIDAvailable: Boolean(env.documentFinalCID),
        },
        anchor: {
          txHash: env.anchoredTxHash || null,
          anchoredAt: env.anchoredAt || null,
          status: 'UNAVAILABLE',
        },
      });
    }

    const onchain = await web3Service.contracts.documentRegistry.getEnvelope(envelopeIdBytes32);
    const exists = Boolean(onchain[4]);
    const onchainDocumentHash = String(onchain[0]);

    res.json({
      anchored: Boolean(env.anchoredTxHash),
      canonical: {
        signedSourceHash: env.canonicalDocumentHash || env.documentOriginalHash || null,
        signedSourceHashBytes32: localCanonicalBytes32,
        anchoredSourceHashMatches: exists && localCanonicalBytes32
          ? localCanonicalBytes32.toLowerCase() === onchainDocumentHash.toLowerCase()
          : null,
      },
      rendered: {
        finalHash: env.documentFinalHash || null,
        finalCIDAvailable: Boolean(env.documentFinalCID),
      },
      anchor: {
        status: exists ? 'VERIFIED' : 'MISSING',
        envelopeIdBytes32,
        documentHash: onchainDocumentHash,
        signers: Array.isArray(onchain[1]) ? onchain[1].map((a) => String(a).toLowerCase()) : [],
        completedAt: Number(onchain[2] || 0) ? new Date(Number(onchain[2]) * 1000).toISOString() : null,
        finalCID: String(onchain[3] || ''),
        txHash: env.anchoredTxHash || null,
        anchoredAt: env.anchoredAt || null,
      },
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/:envelopeId/typed-data', async (req, res) => {
  try {
    const rawAddr = (req.query.recipientAddress || '').toString().trim();
    if (!rawAddr) return res.status(400).json({ error: 'recipientAddress query param is required' });

    const env = await loadEnvelopeOr404(res, req.params.envelopeId);
    if (!env) return;
    const access = await requireEnvelopeMembership(req, res, env);
    if (!access) return;
    if (env.status !== 'SENT' && env.status !== 'IN_PROGRESS') {
      return res.status(400).json({ error: 'Envelope is not currently signable' });
    }
    if (env.status === 'VOID') {
      return res.status(400).json({ error: 'Envelope has been voided' });
    }
    if (isExpired(env)) {
      return res.status(410).json({ error: 'Envelope has expired' });
    }

    const checksumAddress = ensureChecksumAddress(rawAddr, 'recipientAddress');
    if (normalizeAddress(checksumAddress) !== access.linkedAddress) {
      return res.status(403).json({ error: 'recipientAddress must match your linked wallet' });
    }

    const rec = await Recipient.findOne({ envelopeId: env.envelopeId, recipientAddress: normalizeAddress(checksumAddress) });
    if (!rec) return res.status(404).json({ error: 'Recipient not found for this envelope' });
    if (rec.status === 'SIGNED') return res.status(400).json({ error: 'Recipient has already signed' });

    if (rec.status === 'PENDING') {
      rec.status = 'VIEWED';
      await rec.save();
      await audit(env.envelopeId, 'RECIPIENT_VIEWED', access.linkedAddress, req, {
        recipientAddress: rec.recipientAddress,
      });
    }

    const pendingSigner = await Recipient.findOne({
      envelopeId: env.envelopeId,
      role: 'SIGNER',
      status: { $ne: 'SIGNED' },
    }).sort({ signingOrder: 1, createdAt: 1 });
    if (!pendingSigner) {
      return res.status(400).json({ error: 'Envelope has already completed signing' });
    }
    if (pendingSigner.signingOrder !== rec.signingOrder) {
      return res.status(409).json({ error: 'It is not this signer\'s turn yet' });
    }

    const deadline = Math.floor((Date.now() + 1000 * 60 * 30) / 1000);
    rec.deadline = new Date(deadline * 1000);
    await rec.save();

    const typed = buildEnvelopeSignTypedData({
      envelopeIdBytes32: env.envelopeIdBytes32 || envelopeIdToBytes32(env.envelopeId),
      documentHashHex: '0x' + (env.canonicalDocumentHash || env.documentOriginalHash),
      recipient: checksumAddress,
      nonce: rec.nonce,
      deadline,
    });

    res.json({
      domain: typed.domain,
      types: typed.types,
      primaryType: typed.primaryType,
      message: typed.message,
      typedDataHash: ethers.TypedDataEncoder.hash(typed.domain, typed.types, typed.message),
      envelopeId: env.envelopeId,
      recipientAddress: checksumAddress,
      nonce: rec.nonce,
      deadline,
      canonicalDocumentHash: env.canonicalDocumentHash || env.documentOriginalHash,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/:envelopeId/sign', signLimiter, async (req, res) => {
  try {
    const { error, value } = validateBody(signSchema, req.body);
    if (error) return res.status(400).json({ error });

    const env = await loadEnvelopeOr404(res, req.params.envelopeId);
    if (!env) return;
    const access = await requireEnvelopeMembership(req, res, env);
    if (!access) return;
    if (env.status === 'COMPLETED' || env.status === 'VOID') {
      return res.status(400).json({ error: 'Envelope is not signable' });
    }
    if (env.status !== 'SENT' && env.status !== 'IN_PROGRESS') {
      return res.status(400).json({ error: 'Envelope has not been sent for signing' });
    }
    if (isExpired(env)) {
      return res.status(410).json({ error: 'Envelope has expired' });
    }

    const checksumAddress = ensureChecksumAddress(value.recipientAddress, 'recipientAddress');
    if (normalizeAddress(checksumAddress) !== access.linkedAddress) {
      return res.status(403).json({ error: 'recipientAddress must match your linked wallet' });
    }

    const rec = await Recipient.findOne({ envelopeId: env.envelopeId, recipientAddress: normalizeAddress(checksumAddress) });
    if (!rec) return res.status(404).json({ error: 'Recipient not found for this envelope' });
    if (rec.status === 'SIGNED') return res.status(400).json({ error: 'Recipient already signed' });

    const pendingSigner = await Recipient.findOne({
      envelopeId: env.envelopeId,
      role: 'SIGNER',
      status: { $ne: 'SIGNED' },
    }).sort({ signingOrder: 1, createdAt: 1 });
    if (!pendingSigner || pendingSigner.signingOrder !== rec.signingOrder) {
      return res.status(409).json({ error: 'It is not this signer\'s turn yet' });
    }

    const deadline = rec.deadline ? Math.floor(rec.deadline.getTime() / 1000) : 0;
    if (!deadline || deadline < Math.floor(Date.now() / 1000)) {
      return res.status(400).json({ error: 'Signature deadline expired. Request typed-data again.' });
    }

    const typed = buildEnvelopeSignTypedData({
      envelopeIdBytes32: env.envelopeIdBytes32 || envelopeIdToBytes32(env.envelopeId),
      documentHashHex: '0x' + (env.canonicalDocumentHash || env.documentOriginalHash),
      recipient: checksumAddress,
      nonce: rec.nonce,
      deadline,
    });
    const recovered = ethers.verifyTypedData(typed.domain, typed.types, typed.message, value.signature);
    if (normalizeAddress(recovered) !== normalizeAddress(checksumAddress)) {
      return res.status(401).json({ error: 'Invalid typed-data signature' });
    }

    let updatedPdfBytes = env.documentFinalCID
      ? await ipfsService.retrieveRaw(env.documentFinalCID)
      : await ipfsService.retrieveRaw(env.documentOriginalCID);
    updatedPdfBytes = Buffer.from(updatedPdfBytes);

    const signatureImageBytes = parseSignaturePng(value.signatureImageBase64);
    let signatureImageCID;
    let signatureImageHash;
    const identityTokenId = await web3Service.getIdentityTokenId(checksumAddress);
    if (signatureImageBytes) {
      signatureImageHash = sha256Hex(signatureImageBytes);
      signatureImageCID = await ipfsService.uploadRaw(signatureImageBytes, `signature-${env.envelopeId}-${checksumAddress}.png`);
      updatedPdfBytes = await stampSignature({
        pdfBytes: updatedPdfBytes,
        signaturePngBytes: signatureImageBytes,
        pageIndex: Number(value.placement?.pageIndex || 0),
        x: Number(value.placement?.x || 50),
        y: Number(value.placement?.y || 50),
        width: Number(value.placement?.width || 160),
        height: Number(value.placement?.height || 60),
        labelText: identityTokenId
          ? `DID: ${identityTokenId} · Signed: ${new Date().toISOString()}`
          : `Signed: ${new Date().toISOString()}`,
      });
    }

    const typedDataHash = ethers.TypedDataEncoder.hash(typed.domain, typed.types, typed.message);
    let newFinalHash = sha256Hex(updatedPdfBytes);
    let newFinalCID = await ipfsService.uploadRaw(updatedPdfBytes, `envelope-${env.envelopeId}-rendered.pdf`);

    env.documentFinalCID = newFinalCID;
    env.documentFinalHash = newFinalHash;
    env.canonicalDocumentHash = env.canonicalDocumentHash || env.documentOriginalHash;
    env.canonicalSignedAt = env.canonicalSignedAt || new Date();
    env.status = 'IN_PROGRESS';
    await env.save();

    rec.status = 'SIGNED';
    rec.signature = value.signature;
    rec.typedDataHash = typedDataHash;
    rec.signatureImageCID = signatureImageCID;
    rec.signatureImageHash = signatureImageHash;
    rec.signedAt = new Date();
    rec.identityTokenId = identityTokenId;
    rec.nonce = rec.nonce + 1;
    await rec.save();

    await audit(env.envelopeId, 'RECIPIENT_SIGNED', access.linkedAddress, req, {
      typedDataHash,
      canonicalDocumentHash: env.canonicalDocumentHash,
      renderedDocumentHash: env.documentFinalHash,
    });

    const remaining = await Recipient.countDocuments({ envelopeId: env.envelopeId, role: 'SIGNER', status: { $ne: 'SIGNED' } });
    if (remaining === 0) {
      const finalSignedAt = rec.signedAt || new Date();
      env.status = 'COMPLETED';
      env.canonicalSignedAt = env.canonicalSignedAt || new Date();
      env.signedAt = finalSignedAt;
      await env.save();

      let anchoredTxHash;
      if (web3Service.isInitialized && web3Service.contracts.documentRegistry) {
        try {
          const signers = (await Recipient.find({ envelopeId: env.envelopeId, role: 'SIGNER' }).sort({ signingOrder: 1 })).map((r) => r.recipientAddress);
          const { txHash } = await web3Service.anchorEnvelope({
            envelopeIdBytes32: env.envelopeIdBytes32 || envelopeIdToBytes32(env.envelopeId),
            documentFinalHash: '0x' + env.canonicalDocumentHash,
            signers,
            finalCID: env.documentFinalCID,
          });
          anchoredTxHash = txHash;
          env.anchoredTxHash = txHash;
          env.anchoredAt = new Date();
          await env.save();
        } catch (anchorError) {
          logger.warn('Envelope anchoring failed', { envelopeId: env.envelopeId, error: anchorError.message });
        }
      }

      const network = web3Service.isInitialized ? await web3Service.getNetworkInfo().catch(() => null) : null;
      const networkName = getNetworkName(network);
      const signerAccount = await Account.findOne({ address: rec.recipientAddress }).select('name').lean();
      const recipients = await Recipient.find({ envelopeId: env.envelopeId, role: 'SIGNER' }).sort({ signingOrder: 1 });
      const auditLogs = await EnvelopeAuditLog.find({ envelopeId: env.envelopeId }).sort({ createdAt: 1 }).limit(300);
      const verificationUrl = buildVerificationUrl(env.envelopeId);
      const proofBlock = buildProofBlockData({
        envelope: env,
        signerName: signerAccount?.name || null,
        signerAddress: rec.recipientAddress,
        signedAt: finalSignedAt,
        documentHash: env.canonicalDocumentHash,
        txHash: env.anchoredTxHash || anchoredTxHash || null,
        networkName,
        verificationUrl,
      });
      const auditTrail = extractAuditTrail({
        envelope: env,
        recipients,
        auditLogs,
        signerAddress: rec.recipientAddress,
        signedAt: finalSignedAt,
        txHash: env.anchoredTxHash || anchoredTxHash || null,
        networkName,
      });
      const qrPngBytes = await buildQrPngBuffer(verificationUrl);
      const proofPdfBytes = await addProofPages({
        pdfBytes: updatedPdfBytes,
        proofBlock,
        auditTrail,
        qrPngBytes,
      });
      newFinalHash = sha256Hex(proofPdfBytes);
      newFinalCID = await ipfsService.uploadRaw(proofPdfBytes, `envelope-${env.envelopeId}-signed-proof.pdf`);

      env.documentFinalCID = newFinalCID;
      env.documentFinalHash = newFinalHash;
      env.verificationUrl = verificationUrl;
      env.proofBlock = proofBlock;
      env.auditTrail = auditTrail;
      await env.save();

      await audit(env.envelopeId, 'ENVELOPE_COMPLETED', env.ownerAddress, req, {
        canonicalDocumentHash: env.canonicalDocumentHash,
        renderedDocumentHash: env.documentFinalHash,
        finalCID: env.documentFinalCID,
        verificationUrl: env.verificationUrl,
      }, anchoredTxHash);
    }

    res.json({
      envelope: {
        envelopeId: env.envelopeId,
        status: env.status,
        canonicalDocumentHash: env.canonicalDocumentHash,
        renderedDocumentHash: env.documentFinalHash,
        anchoredTxHash: env.anchoredTxHash || null,
      },
      recipient: {
        recipientAddress: rec.recipientAddress,
        status: rec.status,
        signedAt: rec.signedAt,
        typedDataHash: rec.typedDataHash,
      },
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
