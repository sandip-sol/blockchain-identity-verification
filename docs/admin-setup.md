# Admin Access Setup Guide

## Overview

Admin access is controlled by a `role` field on the `Account` model in MongoDB. By default, all new accounts are created with `role: "USER"`. KYC review access is enforced in backend middleware, not only in the frontend.

---

## Promoting an Account to Admin

### Option 1: MongoDB Shell

```bash
mongosh "mongodb://localhost:27017/kyc-kyb-platform"
```

```js
db.accounts.updateOne(
  { email: "your-email@example.com" },
  { $set: { role: "KYC_ADMIN" } }
)
```

### Option 2: One-liner

```bash
mongosh "mongodb://localhost:27017/kyc-kyb-platform" \
  --eval 'db.accounts.updateOne({email: "your-email@example.com"}, {$set: {role: "KYC_ADMIN"}})'
```

> [!IMPORTANT]
> After promoting, log out and log back in so a fresh JWT is issued with the updated normalized role.

---

## Verifying Admin Access

Check that the role was updated:

```bash
mongosh "mongodb://localhost:27017/kyc-kyb-platform" \
  --eval 'db.accounts.findOne({email: "your-email@example.com"}, {email:1, role:1})'
```

Expected output:
```json
{ "_id": "...", "email": "your-email@example.com", "role": "KYC_ADMIN" }
```

---

## Available Admin Endpoints

All endpoints require a valid JWT in the `Authorization: Bearer <token>` header, and the backend checks the persisted account role before allowing access.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/stats` | Platform-wide statistics |
| GET | `/api/admin/accounts` | List all accounts (paginated) |
| GET | `/api/admin/accounts/:id` | Get single account details |
| DELETE | `/api/admin/accounts/:id` | Delete an account |
| POST | `/api/admin/accounts/:id/reset-password` | Reset a user's password |
| GET | `/api/admin/users` | List KYC/KYB users |
| GET | `/api/admin/kyc` | List KYC applications |
| GET | `/api/admin/kyc/:id` | Get KYC application detail |
| GET | `/api/admin/kyc/:id/audit` | Get audit history |
| PATCH | `/api/admin/kyc/:id/status` | Move a case to `UNDER_REVIEW` |
| POST | `/api/admin/kyc/:id/approve` | Approve a case |
| POST | `/api/admin/kyc/:id/reject` | Reject with reason |
| POST | `/api/admin/kyc/:id/request-resubmission` | Request corrected evidence |
| POST | `/api/admin/kyc/:id/verify-onchain` | Trigger on-chain verification |
| GET | `/api/admin/kyc/stats` | KYC lifecycle stats |

### Query Parameters

- **`/api/admin/accounts`** — `?page=1&limit=20&search=term`
- **`/api/admin/users`** — `?page=1&limit=20&status=PENDING|VERIFIED|REJECTED`

---

## How Auth Flow Works

```
1. User logs in → JWT issued with `{ sub, email, role }`
2. Request hits `/api/admin/*` or `/api/admin/kyc/*`
3. Auth middleware verifies JWT
4. Role middleware loads the current account from MongoDB
5. The normalized role is checked against the allowed role set for that endpoint
6. Access granted or `403` returned
```

---

## Revoking Admin Access

```bash
mongosh "mongodb://localhost:27017/kyc-kyb-platform" \
  --eval 'db.accounts.updateOne({email: "admin@example.com"}, {$set: {role: "USER"}})'
```

The user's current session will continue to present the previous JWT claims until they log in again, but backend authorization now re-checks the persisted role, so revocation takes effect on protected endpoints immediately.

## Supported Roles

- `SUPER_ADMIN`: full platform and KYC control
- `KYC_ADMIN`: approve, reject, request resubmission, and verify on-chain
- `KYC_REVIEWER`: review access and move a case into active review
- `VERIFIER`: approve and trigger on-chain verification
- `AUDITOR`: read-only access with full audit visibility
- `SUPPORT_READONLY`: limited read-only operational access
