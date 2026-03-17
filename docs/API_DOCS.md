# API Documentation

Base URL: `http://localhost:3001/api`

## Authentication

Most endpoints require a valid JWT token in the Authorization header:

```
Authorization: Bearer <token>
```

### Email Authentication

#### POST `/api/auth/register`

Register a new account with email and password.

**Body:**
```json
{
  "email": "user@example.com",
  "password": "yourpassword",
  "name": "John Doe"
}
```

**Success Response (201):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "account": {
    "_id": "507f1f77bcf86cd799439011",
    "email": "user@example.com",
    "name": "John Doe",
    "createdAt": "2026-01-15T09:00:00.000Z"
  }
}
```

**Error Responses:**
- `400` - Email and password are required / Password must be at least 6 characters
- `409` - An account with this email already exists

---

#### POST `/api/auth/login`

Authenticate with email and password.

**Body:**
```json
{
  "email": "user@example.com",
  "password": "yourpassword"
}
```

**Success Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "account": {
    "_id": "507f1f77bcf86cd799439011",
    "email": "user@example.com",
    "name": "John Doe",
    "address": "0x1234...",
    "createdAt": "2026-01-15T09:00:00.000Z"
  }
}
```

**Error Responses:**
- `400` - Email and password are required
- `401` - Invalid email or password

---

### Wallet Linking

#### GET `/api/auth/nonce?address=0x...`

Get a nonce for wallet signature verification.

**Response:**
```json
{
  "address": "0x1234...",
  "nonce": "abc123...",
  "expiresAt": "2026-01-15T09:05:00.000Z",
  "message": "Login to KYC/KYB Platform\nAddress: 0x1234...\nNonce: abc123..."
}
```

---

#### POST `/api/auth/link-wallet`

Link a wallet address to your account. Requires authentication.

**Headers:**
```
Authorization: Bearer <token>
```

**Body:**
```json
{
  "address": "0x1234...",
  "nonce": "abc123...",
  "signature": "0xsignature..."
}
```

**Success Response:**
```json
{
  "success": true,
  "address": "0x1234...",
  "account": {
    "_id": "507f1f77bcf86cd799439011",
    "email": "user@example.com",
    "address": "0x1234..."
  }
}
```

---

## Endpoints

### Health Check

#### GET `/health`

Check API and service health status.

**Response:**
```json
{
  "status": "healthy",
  "services": {
    "web3": true,
    "ipfs": true,
    "database": true
  },
  "timestamp": "2026-01-15T09:00:00.000Z"
}
```

---

### KYC Routes

#### POST `/api/kyc/submit`

Submit a new KYC/KYB application.

**Headers:**
```
Content-Type: multipart/form-data
```

**Body (FormData):**
- `walletAddress` (string) - User's Ethereum address
- `verificationType` (string) - "KYC" or "KYB"
- `fullName` (string) - Full legal name
- `email` (string) - Email address
- `country` (string) - Country of residence
- `dateOfBirth` (string, KYC only) - Date of birth (YYYY-MM-DD)
- `businessName` (string, KYB only) - Business name
- `registrationNumber` (string, KYB only) - Business registration number
- `documents` (files) - Identity documents (max 5 files, 10MB each)

**Success Response:**
```json
{
  "success": true,
  "message": "KYC application submitted successfully",
  "data": {
    "userId": "507f1f77bcf86cd799439011",
    "ipfsHash": "QmX...",
    "status": "pending"
  }
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "Invalid wallet address"
}
```

---

#### GET `/api/kyc/status/:walletAddress`

Get KYC verification status for a wallet address.

**Parameters:**
- `walletAddress` - Ethereum address

**Response:**
```json
{
  "success": true,
  "data": {
    "walletAddress": "0x1234...",
    "verificationStatus": "verified",
    "verificationType": "KYC",
    "identityTokenId": "42",
    "verifiedAt": "2026-01-01T00:00:00.000Z",
    "expiryDate": "2027-01-01T00:00:00.000Z",
    "transactions": []
  }
}
```

---

#### PUT `/api/kyc/verify/:userId`

Verify a KYC application (Verifier only).

**Headers:**
```
Authorization: Bearer <verifier_token>
```

**Body:**
```json
{
  "approved": true,
  "expiryYears": 1,
  "notes": "Documents verified successfully"
}
```

**Response:**
```json
{
  "success": true,
  "message": "User verified successfully",
  "tokenId": "42",
  "txHash": "0xabc..."
}
```

---

### Transaction Routes

#### POST `/api/transaction/create`

Create a transaction proof token.

**Body:**
```json
{
  "walletAddress": "0x1234...",
  "transactionHash": "0xabc...",
  "transactionType": "payment",
  "metadata": {
    "amount": "100",
    "currency": "USD"
  }
}
```

**Response:**
```json
{
  "success": true,
  "tokenId": "7",
  "txHash": "0xdef...",
  "ipfsHash": "QmY..."
}
```

---

#### GET `/api/transaction/:tokenId`

Get transaction proof details.

**Response:**
```json
{
  "success": true,
  "data": {
    "tokenId": "7",
    "owner": "0x1234...",
    "transactionHash": "0xabc...",
    "transactionType": "payment",
    "createdAt": "2026-01-15T09:00:00.000Z",
    "metadata": { }
  }
}
```

---

#### GET `/api/transaction/user/:walletAddress`

Get all transaction proofs for a user.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "tokenId": "7",
      "transactionHash": "0xabc...",
      "transactionType": "payment",
      "createdAt": "2026-01-15T09:00:00.000Z"
    }
  ]
}
```

---

### Access Control Routes

#### POST `/api/access/grant`

Grant data access to a third party.

**Body:**
```json
{
  "grantor": "0x1234...",
  "grantee": "0x5678...",
  "dataType": "kyc_data",
  "expiryDate": "2026-12-31T23:59:59.000Z",
  "signature": "0xsignature..."
}
```

**Response:**
```json
{
  "success": true,
  "accessId": "15",
  "txHash": "0xghi..."
}
```

---

#### POST `/api/access/revoke`

Revoke previously granted access.

**Body:**
```json
{
  "grantor": "0x1234...",
  "grantee": "0x5678...",
  "accessId": "15"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Access revoked successfully",
  "txHash": "0xjkl..."
}
```

---

#### GET `/api/access/check/:grantor/:grantee`

Check if grantee has access to grantor's data.

**Response:**
```json
{
  "success": true,
  "hasAccess": true,
  "accessDetails": {
    "dataType": "kyc_data",
    "grantedAt": "2026-01-15T09:00:00.000Z",
    "expiryDate": "2026-12-31T23:59:59.000Z"
  }
}
```

---

### Document Signature (Envelope) Routes

#### POST `/api/envelopes/draft`

Create a new draft envelope.

Authentication: `Bearer` token required. The authenticated account must have a linked wallet matching `ownerAddress`.

**Body:**
```json
{
  "ownerAddress": "0x1234...",
  "title": "Contract Agreement",
  "description": "Q1 2026 Service Agreement",
  "expiresAt": "2026-12-31T23:59:59.000Z"
}
```

**Response:**
```json
{
  "envelope": {
    "envelopeId": "abc123-uuid",
    "status": "DRAFT",
    "metadata": {
      "title": "Contract Agreement"
    }
  },
  "messageToSign": "Create Envelope abc123-uuid for 0x1234..."
}
```

---

#### POST `/api/envelopes/upload`

Upload the canonical source PDF to an existing draft envelope.

Authentication: `Bearer` token required. Owner only.

**Body:**
```json
{
  "envelopeId": "abc123-uuid",
  "ownerAddress": "0x1234...",
  "signature": "0xsignature...",
  "pdfBase64": "JVBERi0xLjQg..."
}
```

**Response:**
```json
{
  "envelope": {
    "envelopeId": "abc123-uuid",
    "status": "DRAFT",
    "hasOriginalDocument": true,
    "canonicalDocumentHash": "ab12..."
  }
}
```

---

#### POST `/api/envelopes/recipients`

Replace recipients while the envelope is still in `DRAFT`.

Authentication: `Bearer` token required. Owner only.

**Body:**
```json
{
  "envelopeId": "abc123-uuid",
  "ownerAddress": "0x1234...",
  "signature": "0xsignature...",
  "recipients": [
    { "recipientAddress": "0x5678...", "signingOrder": 1 },
    { "recipientAddress": "0x9abc...", "signingOrder": 2 }
  ]
}
```

---

#### POST `/api/envelopes/send`

Send the envelope for signing.

Authentication: `Bearer` token required. Owner only.

Requirements:
- source PDF uploaded
- at least one signer
- envelope not expired

---

#### GET `/api/envelopes/:envelopeId`

Get envelope details for the owner or an assigned recipient.

Authentication: `Bearer` token required. Membership required.

**Response shape:**
- `envelope`: workflow state and next action
- `access`: whether caller is owner/recipient
- `recipients`: signer progress and state-aware signing eligibility
- `proof`: canonical source proof, rendered PDF proof, and anchor proof
- `documents`: authenticated backend document URLs
- `auditLogs`: workflow audit events

---

#### GET `/api/envelopes/:envelopeId/document/original`

Retrieve the protected canonical source PDF.

Authentication: `Bearer` token required. Membership required.

---

#### GET `/api/envelopes/:envelopeId/document/final`

Retrieve the protected rendered PDF, if available.

Authentication: `Bearer` token required. Membership required.

---

#### GET `/api/envelopes/:envelopeId/typed-data`

Get EIP-712 typed data for signing the canonical source document.

Authentication: `Bearer` token required. Assigned recipient only.

**Query Parameters:**
- `recipientAddress` - must match the authenticated account's linked wallet

**Response:**
```json
{
  "domain": {
    "name": "BlockchainIdentityVerification",
    "version": "2",
    "chainId": 31337,
    "verifyingContract": "0x..."
  },
  "types": {
    "EnvelopeSign": [
      { "name": "intent", "type": "string" },
      { "name": "envelopeId", "type": "bytes32" },
      { "name": "documentHash", "type": "bytes32" },
      { "name": "recipient", "type": "address" },
      { "name": "nonce", "type": "uint256" },
      { "name": "deadline", "type": "uint256" }
    ]
  },
  "primaryType": "EnvelopeSign",
  "message": {
    "intent": "SIGN_ENVELOPE_SOURCE_V1",
    "envelopeId": "0x...",
    "documentHash": "0x...",
    "recipient": "0x5678...",
    "nonce": 0,
    "deadline": 1770000000
  },
  "typedDataHash": "0x...",
  "canonicalDocumentHash": "ab12..."
}
```

---

#### POST `/api/envelopes/:envelopeId/sign`

Submit a recipient signature for the canonical source document. Optional PNG signature artwork may also be submitted for rendered PDF stamping.

Authentication: `Bearer` token required. Assigned recipient only.

---

#### POST `/api/envelopes/:envelopeId/void`

Void an envelope and stop further signing.

Authentication: `Bearer` token required. Owner only.

**Body:**
```json
{
  "reason": "Wrong recipient list"
}
```

---

#### GET `/api/envelopes/:envelopeId/verify`

Verify canonical source proof and on-chain anchor state.

Authentication: `Bearer` token required. Membership required.

**Response shape:**
- `canonical`: signed source hash and source-hash anchor comparison
- `rendered`: rendered PDF metadata
- `anchor`: on-chain record, tx hash, and verification status

---

## Error Codes

| Code | Description |
|------|-------------|
| 400 | Bad Request - Invalid parameters |
| 401 | Unauthorized - Missing or invalid token |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Resource doesn't exist |
| 409 | Conflict - Resource already exists |
| 429 | Too Many Requests - Rate limit exceeded |
| 500 | Internal Server Error |

## Rate Limiting

- **Window**: 15 minutes
- **Max Requests**: 100 per window per IP
- **Headers**:
  - `X-RateLimit-Limit`: Total request limit
  - `X-RateLimit-Remaining`: Remaining requests
  - `X-RateLimit-Reset`: Time when the limit resets

## CORS

Allowed origins are configured in `backend/.env`:
```
ALLOWED_ORIGINS=http://localhost:3000,https://your-production-domain.com
```

## Webhooks

(Coming soon) Subscribe to events:
- `kyc.submitted`
- `kyc.verified`
- `kyc.rejected`
- `transaction.created`
- `access.granted`
- `access.revoked`
- `envelope.created`
- `envelope.signed`
- `envelope.completed`

---

**API Version**: 1.0.0  
**Last Updated**: February 2026
