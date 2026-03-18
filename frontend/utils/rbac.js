'use client';

const ADMIN_REVIEW_ROLES = [
  'SUPER_ADMIN',
  'KYC_ADMIN',
  'KYC_REVIEWER',
  'VERIFIER',
  'AUDITOR',
  'SUPPORT_READONLY',
];

const FINALIZER_ROLES = [
  'SUPER_ADMIN',
  'KYC_ADMIN',
  'VERIFIER',
];

export function normalizeRole(role) {
  if (!role) return 'USER';
  if (role === 'admin' || role === 'ADMIN') return 'SUPER_ADMIN';
  if (role === 'user' || role === 'USER') return 'USER';
  return String(role).toUpperCase();
}

export function canAccessAdmin(role) {
  return ADMIN_REVIEW_ROLES.includes(normalizeRole(role));
}

export function canFinalizeKyc(role) {
  return FINALIZER_ROLES.includes(normalizeRole(role));
}
