# Admin Access Setup Guide

## Overview

Admin access is controlled by a `role` field on the `Account` model in MongoDB. By default, all new accounts are created with `role: "user"`. Admin accounts can access the `/api/admin/*` endpoints for platform management.

---

## Promoting an Account to Admin

### Option 1: MongoDB Shell

```bash
mongosh "mongodb://localhost:27017/kyc-kyb-platform"
```

```js
db.accounts.updateOne(
  { email: "your-email@example.com" },
  { $set: { role: "admin" } }
)
```

### Option 2: One-liner

```bash
mongosh "mongodb://localhost:27017/kyc-kyb-platform" \
  --eval 'db.accounts.updateOne({email: "your-email@example.com"}, {$set: {role: "admin"}})'
```

> [!IMPORTANT]
> After promoting, **log out and log back in** so a fresh JWT is issued with the `admin` role.

---

## Verifying Admin Access

Check that the role was updated:

```bash
mongosh "mongodb://localhost:27017/kyc-kyb-platform" \
  --eval 'db.accounts.findOne({email: "your-email@example.com"}, {email:1, role:1})'
```

Expected output:
```json
{ "_id": "...", "email": "your-email@example.com", "role": "admin" }
```

---

## Available Admin Endpoints

All endpoints require a valid JWT with `role: "admin"` in the `Authorization: Bearer <token>` header.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/stats` | Platform-wide statistics |
| GET | `/api/admin/accounts` | List all accounts (paginated) |
| GET | `/api/admin/accounts/:id` | Get single account details |
| DELETE | `/api/admin/accounts/:id` | Delete an account |
| POST | `/api/admin/accounts/:id/reset-password` | Reset a user's password |
| GET | `/api/admin/users` | List KYC/KYB users |

### Query Parameters

- **`/api/admin/accounts`** — `?page=1&limit=20&search=term`
- **`/api/admin/users`** — `?page=1&limit=20&status=PENDING|VERIFIED|REJECTED`

---

## How Auth Flow Works

```
1. User logs in → JWT issued with { sub, email, role }
2. Request hits /api/admin/* → adminMiddleware runs
3. Middleware checks JWT role === "admin" (fast path)
4. If role not in JWT → falls back to DB lookup (handles pre-promotion tokens)
5. Access granted or 403 returned
```

---

## Revoking Admin Access

```bash
mongosh "mongodb://localhost:27017/kyc-kyb-platform" \
  --eval 'db.accounts.updateOne({email: "admin@example.com"}, {$set: {role: "user"}})'
```

The user's current session will remain admin until their JWT expires. For immediate revocation, also clear their active sessions or reduce `JWT_EXPIRE` in `.env`.
