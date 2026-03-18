const ROLES = {
  USER: 'USER',
  SUPER_ADMIN: 'SUPER_ADMIN',
  KYC_ADMIN: 'KYC_ADMIN',
  KYC_REVIEWER: 'KYC_REVIEWER',
  VERIFIER: 'VERIFIER',
  AUDITOR: 'AUDITOR',
  SUPPORT_READONLY: 'SUPPORT_READONLY',
};

const LEGACY_ROLE_MAP = {
  admin: ROLES.SUPER_ADMIN,
  user: ROLES.USER,
  ADMIN: ROLES.SUPER_ADMIN,
};

const ROLE_HIERARCHY = {
  [ROLES.USER]: 0,
  [ROLES.SUPPORT_READONLY]: 10,
  [ROLES.AUDITOR]: 20,
  [ROLES.KYC_REVIEWER]: 30,
  [ROLES.VERIFIER]: 40,
  [ROLES.KYC_ADMIN]: 50,
  [ROLES.SUPER_ADMIN]: 100,
};

function normalizeRole(role) {
  if (!role) return ROLES.USER;
  if (LEGACY_ROLE_MAP[role]) return LEGACY_ROLE_MAP[role];
  const upper = String(role).toUpperCase();
  if (ROLES[upper]) return ROLES[upper];
  return Object.values(ROLES).includes(upper) ? upper : ROLES.USER;
}

function hasAnyRole(role, allowedRoles = []) {
  const normalizedRole = normalizeRole(role);
  return allowedRoles.map(normalizeRole).includes(normalizedRole);
}

module.exports = {
  ROLES,
  ROLE_HIERARCHY,
  normalizeRole,
  hasAnyRole,
};
