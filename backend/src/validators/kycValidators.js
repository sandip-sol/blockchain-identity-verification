const Joi = require('joi');
const { KYC_STATUSES } = require('../constants/kycStatus');

const walletAddressSchema = Joi.string().trim().pattern(/^0x[a-fA-F0-9]{40}$/);

const submitKycSchema = Joi.object({
  walletAddress: walletAddressSchema.required(),
  signature: Joi.string().trim().required(),
  kycData: Joi.alternatives().try(
    Joi.string().trim().required(),
    Joi.object().required()
  ).required(),
});

const adminListQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  status: Joi.string().valid(...Object.values(KYC_STATUSES)).optional(),
  search: Joi.string().trim().allow('').optional(),
});

const actionNoteSchema = Joi.object({
  note: Joi.string().trim().min(3).max(1000).required(),
});

const approveSchema = Joi.object({
  note: Joi.string().trim().max(1000).allow('', null).optional(),
  riskLevel: Joi.string().valid('LOW', 'MEDIUM', 'HIGH', 'UNKNOWN').optional(),
});

const verifyOnChainSchema = Joi.object({
  expiryYears: Joi.number().integer().min(1).max(10).default(2),
  retryFailed: Joi.boolean().default(false),
});

function validate(schema, payload) {
  const { error, value } = schema.validate(payload, { abortEarly: false, stripUnknown: true });
  if (error) {
    const message = error.details.map((detail) => detail.message).join(', ');
    const err = new Error(message);
    err.status = 400;
    throw err;
  }
  return value;
}

module.exports = {
  submitKycSchema,
  adminListQuerySchema,
  actionNoteSchema,
  approveSchema,
  verifyOnChainSchema,
  validate,
};
