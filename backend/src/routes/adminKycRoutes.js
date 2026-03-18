const express = require('express');
const rateLimit = require('express-rate-limit');

const authMiddleware = require('../middleware/authMiddleware');
const requireRoles = require('../middleware/requireRoles');
const {
  REVIEW_READ_ROLES,
  REVIEW_WRITE_ROLES,
  FINALIZE_REVIEW_ROLES,
} = require('../services/rbacService');
const {
  listApplications,
  getApplicationDetail,
  getAdminStats,
  markUnderReview,
  approveApplication,
  rejectApplication,
  requestResubmission,
  verifyApplicationOnChain,
} = require('../services/kycWorkflowService');
const {
  adminListQuerySchema,
  actionNoteSchema,
  approveSchema,
  verifyOnChainSchema,
  validate,
} = require('../validators/kycValidators');

const router = express.Router();

const mutationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: { error: 'Too many admin KYC actions. Please try again later.' },
});

router.use(authMiddleware);

router.get('/stats', requireRoles(REVIEW_READ_ROLES), async (req, res, next) => {
  try {
    res.json({ stats: await getAdminStats() });
  } catch (error) {
    next(error);
  }
});

router.get('/', requireRoles(REVIEW_READ_ROLES), async (req, res, next) => {
  try {
    const query = validate(adminListQuerySchema, req.query);
    const result = await listApplications(query);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get('/:id', requireRoles(REVIEW_READ_ROLES), async (req, res, next) => {
  try {
    res.json(await getApplicationDetail(req.params.id));
  } catch (error) {
    next(error);
  }
});

router.get('/:id/audit', requireRoles(REVIEW_READ_ROLES), async (req, res, next) => {
  try {
    const detail = await getApplicationDetail(req.params.id);
    res.json({ audit: detail.audit });
  } catch (error) {
    next(error);
  }
});

router.patch('/:id/status', mutationLimiter, requireRoles(REVIEW_WRITE_ROLES), async (req, res, next) => {
  try {
    const body = validate(actionNoteSchema, req.body);
    const application = await markUnderReview({
      applicationId: req.params.id,
      actor: req.account,
      req,
      note: body.note,
    });
    res.json({ success: true, application });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/approve', mutationLimiter, requireRoles(FINALIZE_REVIEW_ROLES), async (req, res, next) => {
  try {
    const body = validate(approveSchema, req.body);
    const application = await approveApplication({
      applicationId: req.params.id,
      actor: req.account,
      req,
      note: body.note || null,
      riskLevel: body.riskLevel || undefined,
    });
    res.json({ success: true, application });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/reject', mutationLimiter, requireRoles(FINALIZE_REVIEW_ROLES), async (req, res, next) => {
  try {
    const body = validate(actionNoteSchema, req.body);
    const application = await rejectApplication({
      applicationId: req.params.id,
      actor: req.account,
      req,
      note: body.note,
    });
    res.json({ success: true, application });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/request-resubmission', mutationLimiter, requireRoles(FINALIZE_REVIEW_ROLES), async (req, res, next) => {
  try {
    const body = validate(actionNoteSchema, req.body);
    const application = await requestResubmission({
      applicationId: req.params.id,
      actor: req.account,
      req,
      note: body.note,
    });
    res.json({ success: true, application });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/verify-onchain', mutationLimiter, requireRoles(FINALIZE_REVIEW_ROLES), async (req, res, next) => {
  try {
    const body = validate(verifyOnChainSchema, req.body);
    const result = await verifyApplicationOnChain({
      applicationId: req.params.id,
      actor: req.account,
      req,
      expiryYears: body.expiryYears,
      retryFailed: body.retryFailed,
    });
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
