# Project Overview

## 1. Project Summary

This project is a blockchain-enabled identity and document workflow platform focused on:
- KYC and KYB verification
- privacy-preserving identity proofs
- selective data sharing
- transaction proof tokenization
- wallet-based document signing
- auditable workflow management for users, admins, and verifiers

At a high level, the platform combines:
- a **Next.js frontend** for user, signer, admin, and verifier workflows
- an **Express backend** for business logic, authentication, storage orchestration, and workflow enforcement
- **smart contracts** for on-chain identity, access control, transaction proofs, and document-signature anchoring
- **MongoDB** for application state and workflow records
- **IPFS / Pinata** for off-chain document and encrypted payload storage

The platform is designed to keep sensitive information off-chain while still using blockchain where immutability, proof, and verifiability matter.

---

## 2. Goals

The main goals of the project are:

### 2.1 Decentralized Identity
Provide a blockchain-backed identity system where verified users can receive a non-transferable identity token that proves verification status without exposing raw PII on-chain.

### 2.2 Privacy-Preserving Verification
Store sensitive KYC/KYB payloads off-chain, encrypted, and only anchor hashes / proofs / references on-chain.

### 2.3 Selective Disclosure
Allow users to control what proof or access they grant to third parties using explicit access-control and signature-based authorization patterns.

### 2.4 Verifiable Document Workflows
Offer a DocuSign-like envelope service where documents are signed with wallets, rendered into a final PDF, and optionally anchored on-chain.

### 2.5 Operational Auditability
Support review queues, admin workflows, lifecycle state transitions, and audit logs for both compliance and debugging.

### 2.6 Developer-Friendly Architecture
Keep the system modular enough that contracts, backend services, and UI surfaces can evolve independently while maintaining clear interfaces.

---

## 3. Major Features

## 3.1 Account Authentication
The platform supports email/password account authentication and wallet linking.

Capabilities:
- account registration and login
- JWT-based authenticated sessions
- wallet-linking using signed nonce flow
- route protection in backend and frontend middleware

Relevant areas:
- `backend/src/routes/authRoutes.js`
- `backend/src/middleware/authMiddleware.js`
- `frontend/context/AuthContext.jsx`
- `frontend/middleware.js`
- `frontend/app/login/page.js`

## 3.2 Wallet-Linked Identity
Once a user links a wallet, blockchain-aware actions can be authorized against the linked wallet address.

This model is used for:
- KYC/KYB verification ownership
- document signing permissions
- envelope ownership and membership
- access control workflows

## 3.3 KYC / KYB Workflow
The platform includes a structured review workflow for identity verification.

Capabilities:
- submit KYC/KYB applications
- upload and store verification payloads off-chain
- admin review queue
- explicit application lifecycle statuses
- on-chain verification after approval
- audit trail of review actions

Current lifecycle includes states such as:
- `SUBMITTED`
- `UNDER_REVIEW`
- `APPROVED`
- `REJECTED`
- `RESUBMISSION_REQUIRED`
- `VERIFIED`
- `FAILED`

Relevant areas:
- `backend/src/routes/kycRoutes.js`
- `backend/src/routes/adminKycRoutes.js`
- `backend/src/services/kycWorkflowService.js`
- `backend/src/models/KYCApplication.js`
- `backend/src/models/KYCAuditLog.js`
- `frontend/app/kyc/page.js`
- `frontend/app/admin/kyc/page.js`
- `frontend/app/admin/kyc/[id]/page.js`

## 3.4 Soulbound Identity Token
Verified users can be minted a non-transferable identity token.

Purpose:
- prove verification status on-chain
- avoid transferability of identity credentials
- provide a durable on-chain identity reference

Relevant contract:
- `contracts/IdentityToken.sol`

Frontend/backend integrations:
- `frontend/hooks/useKYC.js`
- `frontend/hooks/useContract.js`
- `backend/src/services/web3Service.js`

## 3.5 Transaction Proofs
The platform supports recording and tokenizing transaction-related proofs.

Capabilities:
- create proof records
- register them on-chain
- maintain off-chain metadata with on-chain linkage
- show proof history in wallet and activity views

Relevant contract:
- `contracts/TransactionRegistry.sol`

Relevant code:
- `backend/src/routes/transactionRoutes.js`
- `frontend/app/wallet/page.js`
- `frontend/components/ProofPanels.jsx`
- `frontend/utils/proof.js`

## 3.6 Selective Data Access Control
The platform includes a dedicated access-control model for controlled data sharing.

Capabilities:
- authorize access using verifiable permissions
- query grant details
- verify access rights
- support privacy-preserving disclosure patterns

Relevant contract:
- `contracts/AccessControl.sol`

Relevant code:
- `backend/src/routes/accessRoutes.js`
- `frontend/contracts/DataAccessControl.json`
- `backend/src/services/web3Service.js`

## 3.7 Document Signing / Envelopes
The envelope service is the document-signature subsystem.

Capabilities:
- owner creates envelope drafts
- owner uploads source PDF
- owner adds recipients and signing order
- recipients sign with EIP-712 typed data
- optional visual signature image stamping into PDF
- authenticated document retrieval
- rendered final PDF generation
- optional blockchain anchoring through a document-signature registry
- dashboard recovery of drafts and in-progress envelopes

Relevant contract:
- `contracts/DocumentSignatureRegistry.sol`

Relevant code:
- `backend/src/routes/envelopeRoutes.js`
- `backend/src/services/envelopeAccessService.js`
- `backend/src/services/pdfService.js`
- `backend/src/services/ipfsService.js`
- `frontend/app/envelopes/page.js`
- `frontend/app/envelopes/new/page.js`
- `frontend/app/envelopes/[envelopeId]/page.js`
- `frontend/app/envelopes/[envelopeId]/sign/page.js`

## 3.8 Dashboard and Activity Surfaces
The project includes operational UI for ongoing user visibility.

Capabilities:
- view identity verification state
- see recent blockchain and proof activity
- recover recent owned envelopes
- navigate to transaction and signing workflows

Relevant code:
- `frontend/app/dashboard/page.js`
- `frontend/app/activity/page.js`
- `backend/src/routes/activityRoutes.js`

## 3.9 Public Verification
The project also contains a public verification surface for checking identity or proof state without exposing PII.

Relevant code:
- `backend/src/routes/publicVerificationRoutes.js`
- `frontend/app/verify/page.js`

## 3.10 Role-Based Admin Operations
The platform includes role-aware admin and reviewer flows.

Roles present in the project include:
- `SUPER_ADMIN`
- `KYC_ADMIN`
- `KYC_REVIEWER`
- `VERIFIER`
- `AUDITOR`
- `SUPPORT_READONLY`

Relevant code:
- `backend/src/constants/rbac.js`
- `backend/src/services/rbacService.js`
- `backend/src/middleware/requireRoles.js`
- `frontend/utils/rbac.js`

---

## 4. High-Level Architecture

The system is split into four major layers:

### 4.1 Frontend Layer
The frontend is a Next.js application using the App Router.

Responsibilities:
- render user/admin/verifier flows
- call backend REST APIs
- request wallet signatures
- show dashboards, proofs, KYC status, and envelope details
- protect frontend routes with middleware and auth cookies

### 4.2 Backend Layer
The backend is an Express API server.

Responsibilities:
- handle auth and JWT validation
- store workflow state in MongoDB
- enforce business rules and permissions
- generate and verify typed-data signatures
- orchestrate IPFS/Pinata and PDF operations
- perform blockchain writes through Web3 service
- expose admin and public API routes

### 4.3 Blockchain Layer
The blockchain layer is implemented using Solidity smart contracts and Hardhat.

Responsibilities:
- identity token issuance
- transaction proof registration
- access control / grant verification
- completed envelope anchoring

### 4.4 Off-Chain Storage Layer
Off-chain storage uses IPFS-compatible storage and local fallback in development.

Responsibilities:
- store encrypted KYC payloads
- store transaction proof payloads
- store envelope source PDFs
- store rendered PDFs
- store signature image assets

In production, the preferred path is Pinata-backed IPFS storage.

---

## 5. Tech Stack

## 5.1 Frontend
- **Next.js 14**
- **React 18**
- **Wagmi** for wallet integration
- **RainbowKit** for wallet connection UX
- **Axios** for API communication
- **Tailwind CSS** for styling
- **Lucide React** for icons
- **React Query** for client-side data support
- **React Toastify** for notifications

## 5.2 Backend
- **Node.js**
- **Express**
- **Mongoose** for MongoDB access
- **jsonwebtoken** for JWT auth
- **Joi** for validation
- **helmet**, **cors**, **compression**, **morgan**, **express-rate-limit** for API hardening
- **pdf-lib** for PDF mutation/stamping
- **winston** for logging

## 5.3 Blockchain / Web3
- **Solidity**
- **Hardhat**
- **ethers.js**
- **OpenZeppelin Contracts**

## 5.4 Storage / Infra
- **MongoDB** for application state
- **IPFS / Pinata** for off-chain file and payload storage
- **Redis** optional for distributed rate limiting in production

---

## 6. Repository Structure

```text
blockchain-identity-verification/
├── contracts/                    # Solidity smart contracts
│   ├── IdentityToken.sol
│   ├── TransactionRegistry.sol
│   ├── AccessControl.sol
│   ├── DocumentSignatureRegistry.sol
│   └── test/                     # Contract tests
├── scripts/
│   └── deploy.js                 # Deployment script
├── backend/
│   ├── src/
│   │   ├── constants/            # RBAC and workflow constants
│   │   ├── middleware/           # Auth, admin, role checks
│   │   ├── models/               # MongoDB models
│   │   ├── routes/               # API routes
│   │   ├── services/             # Core business/services layer
│   │   ├── utils/                # Proof/signature helpers
│   │   ├── validators/           # Input validation helpers
│   │   └── server.js             # API bootstrap
│   ├── uploads_raw/              # Local raw storage fallback (development)
│   └── package.json
├── frontend/
│   ├── app/                      # Next.js App Router pages
│   ├── components/               # Shared UI components
│   ├── context/                  # Auth context
│   ├── hooks/                    # API, KYC, contract hooks
│   ├── utils/                    # Wallet/proof/RBAC helpers
│   ├── contracts/                # Frontend ABIs
│   └── package.json
├── docs/                         # Project and feature docs
├── hardhat.config.js
├── package.json
└── README.md
```

---

## 7. Key Resources and Important Files

## 7.1 Core Contracts
- `contracts/IdentityToken.sol`
- `contracts/TransactionRegistry.sol`
- `contracts/AccessControl.sol`
- `contracts/DocumentSignatureRegistry.sol`

## 7.2 Core Backend Entry Points
- `backend/src/server.js`
- `backend/src/services/web3Service.js`
- `backend/src/services/ipfsService.js`
- `backend/src/services/encryptionService.js`

## 7.3 Major Backend Route Groups
- `backend/src/routes/authRoutes.js`
- `backend/src/routes/kycRoutes.js`
- `backend/src/routes/adminKycRoutes.js`
- `backend/src/routes/transactionRoutes.js`
- `backend/src/routes/accessRoutes.js`
- `backend/src/routes/envelopeRoutes.js`
- `backend/src/routes/activityRoutes.js`
- `backend/src/routes/publicVerificationRoutes.js`

## 7.4 Major Frontend Areas
- `frontend/app/dashboard/page.js`
- `frontend/app/kyc/page.js`
- `frontend/app/wallet/page.js`
- `frontend/app/envelopes/page.js`
- `frontend/app/envelopes/new/page.js`
- `frontend/app/envelopes/[envelopeId]/page.js`
- `frontend/app/envelopes/[envelopeId]/sign/page.js`
- `frontend/app/admin/kyc/page.js`
- `frontend/app/admin/kyc/[id]/page.js`

## 7.5 Existing Documentation
- `README.md`
- `docs/API_DOCS.md`
- `docs/USER_GUIDE.md`
- `docs/deployment.md`
- `docs/admin-setup.md`
- `docs/ENVELOPE_SERVICE.md`

---

## 8. System Flow

## 8.1 Authentication Flow
1. user registers or logs in with email/password
2. backend returns JWT
3. frontend stores token and applies it to API calls
4. user links wallet via nonce-signature flow
5. backend updates account with linked wallet
6. blockchain-sensitive routes now authorize actions against linked wallet

## 8.2 KYC / KYB Flow
1. user submits KYC/KYB form
2. backend validates and stores application state
3. sensitive payload is encrypted and stored off-chain
4. admin/reviewer opens queue and reviews submission
5. admin updates lifecycle state
6. after approval, verifier/admin triggers on-chain mint
7. user receives identity token and updated dashboard state

## 8.3 Transaction Proof Flow
1. user creates a transaction proof request
2. backend stores encrypted proof payload off-chain
3. backend optionally registers proof metadata on-chain
4. frontend shows proof history and related hashes
5. third parties can verify the proof through the appropriate surface

## 8.4 Access-Control Flow
1. a requester wants access to user-held proof/data
2. a grant is issued or verified using access-control logic
3. backend checks rights via contract helper methods
4. authorized access is resolved without exposing unauthorized raw payloads

## 8.5 Envelope Signing Flow
1. owner creates envelope draft
2. owner uploads source PDF
3. owner adds signer wallets and order
4. owner sends envelope
5. recipient opens envelope and requests typed data
6. recipient signs typed data with wallet
7. optional visual signature is stamped into rendered PDF
8. backend updates recipient and envelope status
9. when all required signers are done, backend completes envelope
10. backend optionally anchors canonical document proof on-chain
11. owner and recipients retrieve envelope from dashboard or envelopes page later using stored `Envelope ID`

## 8.6 Dashboard / Activity Flow
1. frontend loads wallet status and KYC status
2. frontend loads recent activity feed
3. frontend loads owned envelopes from `GET /api/envelopes/mine`
4. dashboard surfaces recent proofs, statuses, and recoverable envelopes

---

## 9. Backend Service Architecture

The backend is organized around service modules that encapsulate major responsibilities.

### 9.1 `web3Service`
Responsible for:
- provider and signer initialization
- contract loading
- minting identity tokens
- registering transactions
- access-control helper calls
- envelope anchoring
- typed-data and signature-related helpers

### 9.2 `ipfsService`
Responsible for:
- encrypted JSON payload storage
- raw file storage for envelopes and signatures
- Pinata integration
- local fallback in development
- document retrieval

### 9.3 `kycWorkflowService`
Responsible for:
- lifecycle transitions
- state rules and workflow enforcement for KYC review
- centralizing approval / rejection / review logic

### 9.4 `pdfService`
Responsible for:
- applying visual signature image stamps to PDFs
- adding timestamp / DID labels
- producing rendered document outputs

### 9.5 `rbacService`
Responsible for:
- role resolution
- policy checks
- reviewer/admin permission enforcement

### 9.6 `auditService`
Responsible for:
- workflow audit persistence patterns
- recording state transitions for operational traceability

---

## 10. Data Model Overview

Important persistent models include:

### 10.1 `Account`
Stores:
- email
- password hash
- role
- linked wallet address
- auth/account metadata

### 10.2 `User`
Stores blockchain/user identity state such as:
- wallet address
- verification status
- identity token ID
- proof references
- transaction proof history

### 10.3 `KYCApplication`
Stores structured verification application state and review lifecycle.

### 10.4 `Envelope`
Stores document-signature workflow state such as:
- envelope ID
- owner wallet
- status
- document references
- canonical proof hash
- final rendered proof metadata
- anchor references

### 10.5 `Recipient`
Stores per-envelope signer state such as:
- signer wallet
- order
- signing status
- nonce/deadline
- typed-data proof
- optional visual signature metadata

### 10.6 Audit Models
Includes:
- `KYCAuditLog`
- `EnvelopeAuditLog`
- `AccessLog`

These support accountability and debugging.

---

## 11. Frontend Surface Map

## 11.1 Public / General User Pages
- `/` : landing page
- `/login` : authentication flow
- `/dashboard` : status, activity, quick actions
- `/docs` : project docs surface

## 11.2 KYC / Verification Pages
- `/kyc` : user verification submission
- `/verify` : verification checks
- `/wallet` : transaction proof management
- `/activity` : recent user activity

## 11.3 Envelope Pages
- `/envelopes` : owned + assigned envelopes and recovery list
- `/envelopes/new` : envelope creation flow
- `/envelopes/[envelopeId]` : owner/member detail page
- `/envelopes/[envelopeId]/sign` : signer-specific view and wallet signing flow

## 11.4 Admin Pages
- `/admin`
- `/admin/kyc`
- `/admin/kyc/[id]`

---

## 12. Security and Privacy Posture

The project is designed around keeping sensitive data off-chain while preserving on-chain verifiability where appropriate.

Current security-oriented patterns include:
- JWT-based authenticated backend access
- linked-wallet authorization for blockchain-sensitive actions
- role-based admin access
- audit logging for workflow actions
- encrypted off-chain payload storage for sensitive KYC/KYB data
- restricted envelope membership access
- typed-data signing for document approvals
- rate limiting and security middleware in backend server

Areas that remain operationally important:
- production key management
- safe deployment of backend signer keys
- durable IPFS/Pinata configuration
- MongoDB backups and replication
- HTTPS everywhere
- production-grade monitoring and alerting

---

## 13. Deployment and Runtime Resources

Typical resources needed to run the full project:
- Node.js runtime for backend and frontend
- MongoDB instance
- EVM-compatible RPC endpoint
- deployed smart contracts
- Pinata or IPFS-compatible storage
- optional Redis for scalable rate limiting
- wallet for admin/verifier blockchain transactions

Key runtime endpoints:
- backend API: typically `http://localhost:3001`
- frontend app: typically `http://localhost:3000`
- health check: `GET /health`
- readiness check: `GET /ready`

---

## 14. Development and Testing Resources

Smart contract tests:
- `contracts/test/*.test.js`

Backend tests:
- `backend/src/__tests__/auth.test.js`
- `backend/src/__tests__/kycWorkflowService.test.js`
- `backend/src/__tests__/rbacService.test.js`
- `backend/src/__tests__/envelopeRoutes.test.js`

Deployment script:
- `scripts/deploy.js`

Hardhat config:
- `hardhat.config.js`

---

## 15. Typical End-to-End Journey

A common end-to-end user journey through the system looks like this:

1. user creates an account
2. user logs in and links a wallet
3. user submits KYC/KYB data
4. admin reviews and approves application
5. identity token is minted on-chain
6. user creates a transaction proof or an envelope workflow
7. another party verifies identity/proof state or signs a document
8. completed proof/signing state is visible in dashboard and activity views

This brings together all major subsystems:
- authentication
- KYC review
- on-chain proof issuance
- off-chain storage
- access control
- transaction proofs
- document signing

---

## 16. Recommended Reading Order For New Engineers

If someone is onboarding to the codebase, a practical reading order is:

1. `README.md`
2. `backend/src/server.js`
3. `backend/src/routes/authRoutes.js`
4. `backend/src/routes/kycRoutes.js`
5. `backend/src/routes/adminKycRoutes.js`
6. `backend/src/routes/envelopeRoutes.js`
7. `backend/src/services/web3Service.js`
8. `backend/src/services/ipfsService.js`
9. `frontend/app/dashboard/page.js`
10. `frontend/app/kyc/page.js`
11. `frontend/app/envelopes/page.js`
12. `frontend/app/envelopes/new/page.js`
13. `frontend/app/envelopes/[envelopeId]/page.js`
14. `docs/API_DOCS.md`
15. `docs/ENVELOPE_SERVICE.md`

---

## 17. Related Documentation

Additional project documentation already present in the repository:
- `README.md`
- `docs/API_DOCS.md`
- `docs/USER_GUIDE.md`
- `docs/deployment.md`
- `docs/admin-setup.md`
- `docs/ENVELOPE_SERVICE.md`

This file is intended to serve as the broad, high-level system reference tying those resources together.
