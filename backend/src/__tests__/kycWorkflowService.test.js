jest.mock('../models/KYCApplication', () => ({
  findOne: jest.fn(),
  findOneAndUpdate: jest.fn(),
  create: jest.fn(),
  countDocuments: jest.fn(),
  find: jest.fn(),
}));

jest.mock('../models/KYCAuditLog', () => ({
  find: jest.fn(),
}));

jest.mock('../models/User', () => {
  function MockUser(data) {
    Object.assign(this, data);
    this.save = jest.fn().mockResolvedValue(this);
  }
  MockUser.findOne = jest.fn();
  return MockUser;
});

jest.mock('../models/Account', () => ({
  findOne: jest.fn(),
}));

jest.mock('../services/auditService', () => ({
  writeKycAuditLog: jest.fn().mockResolvedValue({ _id: 'audit-1' }),
}));

jest.mock('../services/web3Service', () => ({
  signer: { getAddress: jest.fn().mockResolvedValue('0xverifier') },
  provider: { getNetwork: jest.fn().mockResolvedValue({ chainId: 137n }) },
  isSignerVerifier: jest.fn(),
  mintIdentityToken: jest.fn(),
}));

const KYCApplication = require('../models/KYCApplication');
const User = require('../models/User');
const Account = require('../models/Account');
const web3Service = require('../services/web3Service');
const { writeKycAuditLog } = require('../services/auditService');
const {
  approveApplication,
  rejectApplication,
  verifyApplicationOnChain,
  KYC_STATUSES,
  VERIFICATION_TX_STATUSES,
} = require('../services/kycWorkflowService');

function makeApplication(overrides = {}) {
  return {
    applicationId: 'kyc_123',
    walletAddress: '0xabc',
    verificationType: 'KYC',
    status: KYC_STATUSES.SUBMITTED,
    dataHash: '0xhash',
    ipfsCid: 'cid-1',
    summary: {
      fullName: 'Alice',
      email: 'alice@example.com',
      phoneNumber: '123',
      nationality: 'IN',
    },
    currentRiskLevel: 'UNKNOWN',
    verificationTxStatus: VERIFICATION_TX_STATUSES.NONE,
    save: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('kycWorkflowService', () => {
  const actor = { _id: 'acct-1', role: 'KYC_ADMIN' };
  const req = { headers: {}, ip: '127.0.0.1' };

  beforeEach(() => {
    jest.clearAllMocks();
    Account.findOne.mockResolvedValue({ _id: 'acct-1', role: 'KYC_ADMIN' });
  });

  it('approves an application and records an audit entry', async () => {
    const app = makeApplication({ status: KYC_STATUSES.UNDER_REVIEW });
    KYCApplication.findOne.mockResolvedValue(app);

    const result = await approveApplication({
      applicationId: app.applicationId,
      actor,
      req,
      note: 'Documents validated',
      riskLevel: 'LOW',
    });

    expect(result.status).toBe(KYC_STATUSES.APPROVED);
    expect(result.approvedBy).toBe(actor._id);
    expect(result.currentRiskLevel).toBe('LOW');
    expect(app.save).toHaveBeenCalled();
    expect(writeKycAuditLog).toHaveBeenCalledWith(expect.objectContaining({
      applicationId: app.applicationId,
      action: 'APPLICATION_APPROVED',
      fromStatus: KYC_STATUSES.UNDER_REVIEW,
      toStatus: KYC_STATUSES.APPROVED,
    }));
  });

  it('rejects illegal transitions', async () => {
    const app = makeApplication({ status: KYC_STATUSES.VERIFIED });
    KYCApplication.findOne.mockResolvedValue(app);

    await expect(rejectApplication({
      applicationId: app.applicationId,
      actor,
      req,
      note: 'Invalid docs',
    })).rejects.toMatchObject({ status: 409 });
  });

  it('marks an approved application verified when blockchain mint succeeds', async () => {
    const app = makeApplication({ status: KYC_STATUSES.APPROVED });
    KYCApplication.findOne.mockResolvedValue(app);
    User.findOne.mockResolvedValue({
      save: jest.fn().mockResolvedValue(undefined),
    });
    web3Service.isSignerVerifier.mockResolvedValue(true);
    web3Service.mintIdentityToken.mockResolvedValue({
      txHash: '0xtx',
      tokenId: '42',
      blockNumber: 999,
    });

    const result = await verifyApplicationOnChain({
      applicationId: app.applicationId,
      actor,
      req,
      expiryYears: 2,
      retryFailed: false,
    });

    expect(result.application.status).toBe(KYC_STATUSES.VERIFIED);
    expect(result.application.verificationTxStatus).toBe(VERIFICATION_TX_STATUSES.CONFIRMED);
    expect(result.application.verificationTxHash).toBe('0xtx');
    expect(writeKycAuditLog).toHaveBeenCalledWith(expect.objectContaining({
      action: 'VERIFY_ONCHAIN_SUCCEEDED',
      toStatus: KYC_STATUSES.VERIFIED,
    }));
  });

  it('marks the application failed when blockchain mint fails', async () => {
    const app = makeApplication({ status: KYC_STATUSES.APPROVED });
    KYCApplication.findOne.mockResolvedValue(app);
    User.findOne.mockResolvedValue({
      save: jest.fn().mockResolvedValue(undefined),
    });
    web3Service.isSignerVerifier.mockResolvedValue(true);
    web3Service.mintIdentityToken.mockRejectedValue(new Error('rpc outage'));

    await expect(verifyApplicationOnChain({
      applicationId: app.applicationId,
      actor,
      req,
      expiryYears: 2,
      retryFailed: false,
    })).rejects.toThrow('rpc outage');

    expect(app.status).toBe(KYC_STATUSES.FAILED);
    expect(app.verificationTxStatus).toBe(VERIFICATION_TX_STATUSES.FAILED);
    expect(app.failureReason).toBe('rpc outage');
    expect(writeKycAuditLog).toHaveBeenCalledWith(expect.objectContaining({
      action: 'VERIFY_ONCHAIN_FAILED',
      toStatus: KYC_STATUSES.FAILED,
    }));
  });

  it('returns early for already verified applications', async () => {
    const app = makeApplication({ status: KYC_STATUSES.VERIFIED });
    KYCApplication.findOne.mockResolvedValue(app);

    const result = await verifyApplicationOnChain({
      applicationId: app.applicationId,
      actor,
      req,
      expiryYears: 2,
      retryFailed: false,
    });

    expect(result.alreadyVerified).toBe(true);
    expect(web3Service.mintIdentityToken).not.toHaveBeenCalled();
  });
});
