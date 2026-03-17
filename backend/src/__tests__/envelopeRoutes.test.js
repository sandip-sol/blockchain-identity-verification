const express = require('express');
const request = require('supertest');

jest.mock('../middleware/authMiddleware', () => (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  req.user = { sub: 'account-1' };
  next();
});

jest.mock('../models/Envelope', () => ({
  findOne: jest.fn(),
  create: jest.fn(),
}));

jest.mock('../models/Recipient', () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest.fn(),
  deleteMany: jest.fn(),
  countDocuments: jest.fn(),
}));

jest.mock('../models/EnvelopeAuditLog', () => ({
  create: jest.fn(),
  find: jest.fn(),
}));

jest.mock('../services/ipfsService', () => ({
  uploadRaw: jest.fn(),
  retrieveRaw: jest.fn(),
  isInitialized: true,
}));

jest.mock('../services/web3Service', () => ({
  isInitialized: false,
  contracts: {},
  getIdentityTokenId: jest.fn().mockResolvedValue(null),
  anchorEnvelope: jest.fn(),
}));

jest.mock('../services/envelopeAccessService', () => ({
  resolveEnvelopeAccess: jest.fn(),
  canAccessEnvelope: jest.fn(),
  requireLinkedWallet: jest.fn(),
  normalizeAddress: (value) => (value ? String(value).toLowerCase() : null),
}));

const envelopeRoutes = require('../routes/envelopeRoutes');
const Envelope = require('../models/Envelope');
const Recipient = require('../models/Recipient');
const EnvelopeAuditLog = require('../models/EnvelopeAuditLog');
const envelopeAccessService = require('../services/envelopeAccessService');

function makeEnvelope(overrides = {}) {
  return {
    envelopeId: 'env-1',
    envelopeIdBytes32: '0x' + '1'.repeat(64),
    ownerAddress: '0xowner',
    status: 'DRAFT',
    documentOriginalCID: 'cid-original',
    documentOriginalHash: 'a'.repeat(64),
    canonicalDocumentHash: 'a'.repeat(64),
    documentFinalCID: null,
    documentFinalHash: null,
    metadata: {},
    expiresAt: null,
    save: jest.fn().mockResolvedValue(),
    ...overrides,
  };
}

function makeRecipient(overrides = {}) {
  return {
    recipientAddress: '0xrecipient',
    role: 'SIGNER',
    signingOrder: 1,
    status: 'PENDING',
    nonce: 0,
    deadline: null,
    save: jest.fn().mockResolvedValue(),
    ...overrides,
  };
}

function sortedResult(value) {
  return { sort: jest.fn().mockResolvedValue(value) };
}

function sortedLimitedResult(value) {
  return { sort: jest.fn().mockReturnValue({ limit: jest.fn().mockResolvedValue(value) }) };
}

describe('envelopeRoutes hardening', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json({ limit: '10mb' }));
    app.use('/api/envelopes', envelopeRoutes);

    envelopeAccessService.requireLinkedWallet.mockReturnValue(true);
    envelopeAccessService.canAccessEnvelope.mockReturnValue(true);
    envelopeAccessService.resolveEnvelopeAccess.mockResolvedValue({
      linkedAddress: '0xowner',
      isOwner: true,
      isRecipient: false,
      recipient: null,
    });
    EnvelopeAuditLog.find.mockReturnValue(sortedLimitedResult([]));
    Recipient.find.mockReturnValue(sortedResult([]));
  });

  it('rejects unauthenticated envelope access', async () => {
    const res = await request(app).get('/api/envelopes/env-1');
    expect(res.status).toBe(401);
  });

  it('allows authenticated members to read an envelope', async () => {
    Envelope.findOne.mockResolvedValue(makeEnvelope());

    const res = await request(app)
      .get('/api/envelopes/env-1')
      .set('Authorization', 'Bearer test');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('envelope.envelopeId', 'env-1');
    expect(res.body).toHaveProperty('documents.original', '/api/envelopes/env-1/document/original');
  });

  it('rejects authenticated non-members', async () => {
    Envelope.findOne.mockResolvedValue(makeEnvelope());
    envelopeAccessService.canAccessEnvelope.mockReturnValue(false);

    const res = await request(app)
      .get('/api/envelopes/env-1')
      .set('Authorization', 'Bearer test');

    expect(res.status).toBe(403);
  });

  it('prevents recipient updates after draft', async () => {
    Envelope.findOne.mockResolvedValue(makeEnvelope({ status: 'SENT' }));

    const res = await request(app)
      .post('/api/envelopes/recipients')
      .set('Authorization', 'Bearer test')
      .send({
        envelopeId: 'env-1',
        ownerAddress: '0x0000000000000000000000000000000000000AAA',
        signature: '0xsig',
        recipients: [{ recipientAddress: '0x0000000000000000000000000000000000000BBB', signingOrder: 1 }],
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/DRAFT/);
  });

  it('prevents sending without recipients', async () => {
    Envelope.findOne.mockResolvedValue(makeEnvelope({ status: 'DRAFT' }));
    Recipient.countDocuments.mockResolvedValue(0);

    const res = await request(app)
      .post('/api/envelopes/send')
      .set('Authorization', 'Bearer test')
      .send({
        envelopeId: 'env-1',
        ownerAddress: '0x0000000000000000000000000000000000000AAA',
        signature: '0xsig',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/at least one signer/i);
  });

  it('prevents out-of-order signing', async () => {
    const env = makeEnvelope({ status: 'SENT' });
    const recipient = makeRecipient({ recipientAddress: '0x0000000000000000000000000000000000000bbb', signingOrder: 2 });
    const pendingSigner = makeRecipient({ recipientAddress: '0x0000000000000000000000000000000000000aaa', signingOrder: 1 });

    Envelope.findOne.mockResolvedValue(env);
    envelopeAccessService.resolveEnvelopeAccess.mockResolvedValue({
      linkedAddress: '0x0000000000000000000000000000000000000bbb',
      isOwner: false,
      isRecipient: true,
      recipient,
    });
    Recipient.findOne
      .mockResolvedValueOnce(recipient)
      .mockReturnValueOnce({ sort: jest.fn().mockResolvedValue(pendingSigner) });

    const res = await request(app)
      .get('/api/envelopes/env-1/typed-data')
      .set('Authorization', 'Bearer test')
      .query({ recipientAddress: '0x0000000000000000000000000000000000000BBB' });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/turn/i);
  });
});
