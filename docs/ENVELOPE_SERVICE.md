# Envelope Service Guide

## 1. Overview

The `envelope` service is the document-signing workflow inside this project.

It provides:
- owner-created signing envelopes for PDF documents
- wallet-based recipient signatures using EIP-712 typed data
- optional visual signature stamping into a rendered PDF
- authenticated access to envelope details and documents
- optional blockchain anchoring of completed envelopes
- dashboard and envelope-list recovery for drafts and in-progress work

The service is implemented across:
- backend API routes in `backend/src/routes/envelopeRoutes.js`
- backend access helper in `backend/src/services/envelopeAccessService.js`
- backend storage integration in `backend/src/services/ipfsService.js`
- backend PDF stamping in `backend/src/services/pdfService.js`
- optional blockchain anchoring in `backend/src/services/web3Service.js`
- frontend screens under `frontend/app/envelopes/*`

## 2. Core Concepts

### 2.1 Envelope
An envelope is the signing container for one document and its recipients.

An envelope stores:
- `envelopeId`
- `ownerAddress`
- `status`
- metadata like `title` and `description`
- source document reference
- rendered final document reference
- canonical signed source hash
- optional anchor transaction hash
- optional void reason and voided timestamp

Main statuses:
- `DRAFT`
- `SENT`
- `IN_PROGRESS`
- `COMPLETED`
- `VOID`

### 2.2 Canonical Source Document
The legally signed artifact is the original uploaded document hash.

Recipients sign typed data that includes:
- signing intent
- envelope ID
- canonical source document hash
- recipient wallet address
- nonce
- deadline

This is important:
- the wallet signature binds to the source document hash
- the rendered PDF is a derived artifact for presentation
- visual signature images do not define legal validity

### 2.3 Rendered Final PDF
The service can also maintain a rendered PDF that includes:
- optional drawn signature image
- signing timestamp label
- optional DID label if available

This rendered file is useful for presentation and download, but it is not the canonical signed payload.

### 2.4 Membership Model
The service is private.

Only the following can access an envelope:
- the owner who created it
- recipients assigned to it

There is no public access by `envelopeId`.
All envelope APIs require:
- JWT authentication
- a linked wallet
- membership authorization

## 3. Architecture

### 3.1 Backend Responsibilities
The backend handles:
- envelope creation and lifecycle
- authorization and wallet ownership checks
- recipient management
- EIP-712 typed-data generation
- signature verification
- PDF storage and retrieval
- rendered PDF generation
- audit logging
- optional blockchain anchoring

### 3.2 Frontend Responsibilities
The frontend handles:
- create-envelope UI
- envelope list and dashboard recovery
- owner detail page
- signer detail page
- wallet signature requests
- document open/download through authenticated API endpoints

### 3.3 Smart Contract Responsibilities
If configured, the smart contract stores:
- envelope ID hash
- canonical source document hash
- signer wallet addresses
- completion timestamp
- final CID metadata

The backend performs the chain write after all required signers have completed.

## 4. Authentication and Access Requirements

The envelope service depends on the project's existing auth model.

Required conditions before envelope usage:
1. user has an account and is logged in
2. user has a valid JWT token
3. user has linked a wallet to that account
4. the linked wallet matches the action being performed

### 4.1 JWT
The frontend stores the JWT as `kyc_token` and sends it as:
- `Authorization: Bearer <token>`

### 4.2 Linked Wallet
Owner and recipient actions are authorized against the account's linked wallet address.

Examples:
- create draft: linked wallet must equal `ownerAddress`
- send envelope: linked wallet must equal `ownerAddress`
- sign envelope: linked wallet must equal `recipientAddress`
- open envelope: linked wallet must belong to owner or recipient list

### 4.3 Wallet Linking Flow
The wallet must first be linked through the auth flow:
- `GET /api/auth/nonce?address=0x...`
- sign returned message in wallet
- `POST /api/auth/link-wallet`

Without this step, envelope access will fail with authorization errors.

## 5. Environment Setup

## 5.1 Backend Required Variables
Minimum backend environment for envelope service:

```env
JWT_SECRET=your-shared-jwt-secret
MASTER_ENCRYPTION_KEY=64_hex_chars
MONGODB_URI=mongodb://localhost:27017/kyc-kyb-platform
ALLOWED_ORIGINS=http://localhost:3000
CHAIN_ID=31337
RPC_URL=http://localhost:8545
PRIVATE_KEY=0xyour_backend_signer_private_key
DOCUSIGN_REGISTRY_ADDRESS=0xYourDocumentSignatureRegistry
```

Notes:
- `JWT_SECRET` is required because all envelope routes are authenticated
- `MONGODB_URI` is required because envelopes and recipients are stored in MongoDB
- `CHAIN_ID` must match the frontend wallet network used for EIP-712 signing
- `PRIVATE_KEY` and `DOCUSIGN_REGISTRY_ADDRESS` are only required if you want automatic on-chain anchoring

## 5.2 Storage Variables
Recommended production storage setup:

```env
PINATA_API_KEY=your_pinata_key
PINATA_SECRET_KEY=your_pinata_secret
```

Behavior:
- in development, local/IPFS fallback is acceptable
- in production, raw document upload now fails closed if durable storage is not configured

That means you should not deploy the envelope service to production without durable document storage configured.

## 5.3 Frontend Variables
Frontend environment should include:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_CHAIN_ID=31337
JWT_SECRET=the_same_secret_used_by_backend
```

Notes:
- `NEXT_PUBLIC_API_URL` must point to the backend
- frontend and backend must agree on auth behavior
- wallet network in the client must match the backend `CHAIN_ID`

## 6. Local Setup

### 6.1 Install Dependencies
From project root:

```bash
npm install
cd backend && npm install
cd ../frontend && npm install
```

### 6.2 Start MongoDB
Make sure MongoDB is running locally.

Example:

```bash
mongod
```

### 6.3 Start Local Chain
From project root:

```bash
npx hardhat node
```

### 6.4 Deploy Contracts
From project root:

```bash
npx hardhat compile
npx hardhat run scripts/deploy.js --network localhost
```

After deployment, set the correct deployed `DocumentSignatureRegistry` address in backend env if you want anchoring.

### 6.5 Start Backend

```bash
cd backend
NODE_ENV=development npm run dev
```

### 6.6 Start Frontend

```bash
cd frontend
npm run dev
```

## 7. Production Setup Checklist

Before enabling envelope signing in production, verify all of the following:
- MongoDB is available and authenticated
- JWT auth is configured correctly
- frontend and backend share the correct JWT secret behavior
- wallet linking works end-to-end
- Pinata or durable IPFS-compatible storage is configured
- `CHAIN_ID` matches the production wallet network
- `RPC_URL` points to a stable production RPC provider
- backend signer wallet has enough gas for anchor transactions
- `DOCUSIGN_REGISTRY_ADDRESS` is correct
- `ALLOWED_ORIGINS` includes the real frontend domain
- HTTPS is enabled for both frontend and backend

## 8. Envelope Workflow

## 8.1 Owner Workflow

### Step 1: Create Draft
Endpoint:
- `POST /api/envelopes/draft`

Requirements:
- authenticated account
- linked wallet
- `ownerAddress` equals linked wallet

Example body:

```json
{
  "ownerAddress": "0xOwnerWallet",
  "title": "Consulting Agreement",
  "description": "April 2026 Statement of Work",
  "expiresAt": "2026-12-31T23:59:59.000Z"
}
```

Response includes:
- `envelopeId`
- initial status
- `messageToSign`

### Step 2: Upload Source PDF
Endpoint:
- `POST /api/envelopes/upload`

Requirements:
- envelope must be `DRAFT`
- file must be a valid PDF
- size must be within backend limits
- owner signs the backend-provided owner message

The backend stores:
- `documentOriginalCID`
- `documentOriginalHash`
- `canonicalDocumentHash`

### Step 3: Add Recipients
Endpoint:
- `POST /api/envelopes/recipients`

Requirements:
- envelope must still be `DRAFT`
- recipients must be unique
- each recipient must have a `signingOrder`

The backend replaces the recipient list at this step.

### Step 4: Send Envelope
Endpoint:
- `POST /api/envelopes/send`

Requirements:
- source document exists
- at least one signer exists
- envelope is not expired

After send:
- status becomes `SENT`
- signing can begin

### Step 5: Track Envelope
Owner can recover and track envelopes from:
- `GET /api/envelopes/mine`
- dashboard recent envelopes card
- `/envelopes` page

This solves the draft-loss problem after leaving the page.

## 8.2 Recipient Workflow

### Step 1: Open Assigned Envelope
A recipient opens the envelope detail/sign page.

Requirements:
- authenticated account
- linked wallet
- linked wallet must be in recipient list

### Step 2: Request Typed Data
Endpoint:
- `GET /api/envelopes/:envelopeId/typed-data?recipientAddress=0x...`

Requirements:
- recipient wallet must match linked wallet
- recipient must be the next signer in order
- envelope must not be expired, voided, or completed

### Step 3: Sign Typed Data
The frontend asks the wallet to sign EIP-712 typed data.

Signed fields:
- `intent`
- `envelopeId`
- `documentHash`
- `recipient`
- `nonce`
- `deadline`

### Step 4: Submit Signature
Endpoint:
- `POST /api/envelopes/:envelopeId/sign`

Optional extras:
- `signatureImageBase64` for PNG visual signature
- `placement` coordinates for PDF stamping

### Step 5: Completion
When the final signer submits:
- envelope becomes `COMPLETED`
- backend optionally anchors the canonical source hash on-chain
- rendered final PDF remains available as a derived artifact

## 9. API Summary

## 9.1 Envelope Listing
### `GET /api/envelopes/mine`
Returns:
- `owned`: envelopes created by linked wallet
- `assigned`: envelopes where linked wallet is a recipient

Each item includes:
- `envelopeId`
- `status`
- metadata
- signer progress
- next action
- current signer
- role (`OWNER` or `RECIPIENT`)

## 9.2 Envelope Detail
### `GET /api/envelopes/:envelopeId`
Returns:
- `envelope`
- `access`
- `recipients`
- `proof`
- `documents`
- `auditLogs`

The `documents` object contains authenticated backend URLs instead of public IPFS URLs.

## 9.3 Document Retrieval
### `GET /api/envelopes/:envelopeId/document/original`
Returns the protected source PDF.

### `GET /api/envelopes/:envelopeId/document/final`
Returns the rendered final PDF if available.

## 9.4 Void
### `POST /api/envelopes/:envelopeId/void`
Owner-only endpoint to stop the workflow.

Example:

```json
{
  "reason": "Wrong signer list"
}
```

## 9.5 Verify
### `GET /api/envelopes/:envelopeId/verify`
Returns:
- canonical signed source proof
- rendered PDF metadata
- anchor verification data

## 10. Dashboard and Recovery Behavior

The service now exposes envelope recovery in two places:

### 10.1 Dashboard
The dashboard includes a `Recent Envelopes` card showing:
- title
- `Envelope ID`
- status
- signer progress
- next action

### 10.2 Envelopes Home Page
The envelopes page shows:
- `Owned Envelopes`
- `Assigned To You`
- direct open by `Envelope ID`

This means if a user creates a draft and leaves the page, the envelope can still be retrieved later.

## 11. Signing Order Rules

The service enforces sequential signing.

Meaning:
- only the next unsigned signer may request typed data
- only the next unsigned signer may submit a signature
- later signers receive an error until earlier signers complete

If you assign recipients with orders `1, 2, 3`, signer `2` cannot sign before signer `1`.

## 12. Validation Rules

### 12.1 PDF Upload
- must be base64-encoded PDF bytes
- must start with `%PDF`
- must not exceed backend max size

### 12.2 Recipients
- recipient addresses must be valid wallet addresses
- recipient addresses must be unique
- signing order must be positive integer

### 12.3 Signature Image
- optional
- must be PNG
- must not exceed backend max size

### 12.4 Placement
Placement is optional and validated for sane numeric bounds.

## 13. Audit Logging

The envelope service records audit events such as:
- envelope created
- recipient added
- envelope sent
- recipient signed
- envelope completed
- envelope voided

Audit data helps with:
- operational tracking
- owner visibility
- debugging workflow issues
- future compliance reporting

## 14. Blockchain Anchoring

Anchoring is optional.

If blockchain configuration is present:
- backend writes completed envelope proof to `DocumentSignatureRegistry`
- anchored hash is the canonical source document hash
- signer list is included
- final rendered CID may be stored as metadata

If blockchain configuration is not present:
- envelopes still function off-chain
- verify endpoint reports local proof state

## 15. Common Operational Issues

### 15.1 `403 Link a wallet to access envelope features`
Cause:
- account is logged in, but wallet has not been linked

Fix:
- complete `/api/auth/nonce` + `/api/auth/link-wallet` flow

### 15.2 `ownerAddress does not match your linked wallet`
Cause:
- request body owner address does not equal linked account wallet

Fix:
- ensure account and wallet pairing is correct

### 15.3 `It is not this signer's turn yet`
Cause:
- sequential signing order enforcement

Fix:
- wait for previous signer to complete

### 15.4 `Envelope has expired`
Cause:
- `expiresAt` is in the past

Fix:
- create a new envelope or extend expiry before send

### 15.5 `Raw document upload failed and local fallback is disabled in production`
Cause:
- durable production storage is not configured

Fix:
- configure Pinata or another durable IPFS-compatible storage path before production use

## 16. Security Notes

Important security properties of the current implementation:
- no public envelope access by ID
- all envelope routes require JWT auth
- linked wallet membership is enforced
- canonical source document hash is what gets signed
- raw document retrieval is behind authenticated backend endpoints
- production raw storage fails closed without durable configuration

Still recommended before a full enterprise rollout:
- full integration tests with MongoDB and signed wallets
- explicit document encryption if confidential PDFs must not be stored in plaintext within your storage provider path
- structured monitoring and alerting around anchor failures
- stronger recipient invitation and notification flows

## 17. Suggested Usage Pattern for Teams

Recommended operational flow:
1. user logs in with email/password
2. user links wallet
3. user creates envelope draft
4. source PDF uploaded
5. recipients added with explicit order
6. envelope sent
7. recipients sign in sequence
8. owner tracks progress from dashboard or `/envelopes`
9. envelope completes and optionally anchors on-chain
10. owner and recipients can retrieve source/rendered documents through authenticated endpoints

## 18. Developer Pointers

Main files to inspect when changing the service:
- `backend/src/routes/envelopeRoutes.js`
- `backend/src/services/envelopeAccessService.js`
- `backend/src/services/ipfsService.js`
- `backend/src/services/pdfService.js`
- `backend/src/services/web3Service.js`
- `frontend/app/envelopes/page.js`
- `frontend/app/envelopes/new/page.js`
- `frontend/app/envelopes/[envelopeId]/page.js`
- `frontend/app/envelopes/[envelopeId]/sign/page.js`

## 19. Quick Start Example

### Owner
```bash
# 1. Create draft
POST /api/envelopes/draft

# 2. Upload PDF
POST /api/envelopes/upload

# 3. Add recipients
POST /api/envelopes/recipients

# 4. Send
POST /api/envelopes/send

# 5. Recover later
GET /api/envelopes/mine
```

### Recipient
```bash
# 1. Open assigned envelope
GET /api/envelopes/:id

# 2. Request typed data
GET /api/envelopes/:id/typed-data?recipientAddress=0x...

# 3. Sign in wallet
# 4. Submit signature
POST /api/envelopes/:id/sign
```

## 20. Related Docs

Also see:
- `docs/API_DOCS.md`
- `docs/USER_GUIDE.md`
- `docs/deployment.md`
