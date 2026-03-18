const { ROLES, normalizeRole, hasAnyRole } = require('../services/rbacService');

describe('rbacService', () => {
  it('normalizes legacy roles', () => {
    expect(normalizeRole('admin')).toBe(ROLES.SUPER_ADMIN);
    expect(normalizeRole('user')).toBe(ROLES.USER);
  });

  it('checks membership against normalized roles', () => {
    expect(hasAnyRole('admin', [ROLES.SUPER_ADMIN])).toBe(true);
    expect(hasAnyRole(ROLES.AUDITOR, [ROLES.KYC_ADMIN, ROLES.VERIFIER])).toBe(false);
  });
});
