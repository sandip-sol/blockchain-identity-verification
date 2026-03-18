# KYC/KYB Blockchain Platform

A decentralized identity verification platform built on blockchain technology, enabling secure, tamper-proof KYC/KYB verification with privacy-preserving data sharing.

## 🌟 Features

- **Email-Based Authentication**: Secure signup and login with email/password
- **Soulbound Identity Tokens**: Non-transferable NFTs representing verified identities
- **Off-Chain Encrypted Storage**: Sensitive PII stored on IPFS with only hashes on-chain
- **Selective Data Disclosure**: Granular access control with EIP-712 signatures
- **Transaction Proofs**: Tokenize and verify specific transactions
- **Document Signature (DocuSign-like)**: Create envelopes, add recipients, and collect wallet-based signatures with blockchain anchoring
- **Privacy-First Design**: Complete user control over data sharing
- **Compliance Ready**: Built with AML/CFT, GDPR, and DPDP standards in mind

## 🏗️ Architecture

```
┌─────────────┐      ┌───────────────┐      ┌──────────────┐
│   Frontend  │─────▶│  Backend API  │─────▶│  Blockchain  │
│  (Next.js)  │      │   (Express)   │      │   (Polygon)  │
└─────────────┘      └───────────────┘      └──────────────┘
                            │
                            ▼
                     ┌──────────────┐
                     │     IPFS     │
                     │  (Encrypted) │
                     └──────────────┘
```

## 📦 Project Structure

```
kyc-kyb-blockchain/
├── contracts/              # Smart contracts
│   ├── IdentityToken.sol            # Soulbound identity NFT
│   ├── TransactionRegistry.sol      # Transaction proofs
│   ├── AccessControl.sol            # Data access management
│   ├── DocumentSignatureRegistry.sol # Document signature anchoring
│   └── test/                        # Contract tests
├── scripts/               # Deployment scripts
├── backend/               # Backend API
│   └── src/
│       ├── routes/              # API endpoints (incl. envelopes)
│       ├── services/            # Business logic (IPFS, PDF stamping)
│       ├── models/              # Database models (Envelope, Recipient)
│       └── server.js            # Express server
├── frontend/              # Frontend application
│   ├── app/                     # Next.js app router
│   │   └── envelopes/           # Document signature pages
│   ├── components/              # Reusable components (SignaturePad)
│   ├── context/                 # React context (auth)
│   └── styles/                  # CSS styles
└── docs/                  # Documentation
```

## 🚀 Getting Started

### Prerequisites

- **Node.js** >= 18.0.0
- **npm** or **yarn**
- **MongoDB** (required for user accounts)
- **MetaMask** or compatible Web3 wallet (for blockchain operations)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/sandip-sol/blockchain-identity-verification.git
   cd blockchain-identity-verification
   ```

2. **Install root dependencies**
   ```bash
   npm install
   ```

3. **Install backend dependencies**
   ```bash
   cd backend
   npm install
   cd ..
   ```

4. **Install frontend dependencies**
   ```bash
   cd frontend
   npm install
   cd ..
   ```

### Configuration

1. **Backend Environment**
   ```bash
   cd backend
   cp .env.example .env
   # Edit .env with your configuration
   ```

   Required variables:
   - `MONGODB_URI`: MongoDB connection string
   - `JWT_SECRET`: Secret key for JWT tokens
   - `RPC_URL`: Blockchain RPC endpoint
   - `IPFS_PROJECT_ID`: Infura IPFS project ID
   - `IPFS_PROJECT_SECRET`: Infura IPFS secret

2. **Frontend Environment**
   ```bash
   cd frontend
   cp .env.local.example .env.local
   # Edit .env.local with your configuration
   ```

   Required variables:
   - `NEXT_PUBLIC_API_URL`: Backend API URL
   - `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`: WalletConnect project ID
   - Contract addresses (filled after deployment)

### Local Development

1. **Start local blockchain**
   ```bash
   npx hardhat node
   ```

2. **Deploy contracts** (in a new terminal)
   ```bash
   npx hardhat run scripts/deploy.js --network localhost
   ```

   Copy the contract addresses from the output and update:
   - `backend/.env` → `IDENTITY_TOKEN_ADDRESS`, etc.
   - `frontend/.env.local` → `NEXT_PUBLIC_IDENTITY_TOKEN_ADDRESS`, etc.

3. **Start backend server** (in a new terminal)
   ```bash
   cd backend
   npm run dev
   ```

   Server runs on `http://localhost:3001`

4. **Start frontend** (in a new terminal)
   ```bash
   cd frontend
   npm run dev
   ```

   Application runs on `http://localhost:3000`

## 📝 Usage

### For Users

1. **Sign Up**: Create an account with email and password
2. **Sign In**: Log in to access your dashboard
3. **Submit KYC**: Navigate to KYC Verification and complete the form
4. **Upload Documents**: Attach government-issued ID and proof of address
5. **Connect Wallet**: Link your Web3 wallet for blockchain operations
6. **Receive Token**: Once verified, receive a Soulbound identity token
7. **Manage Access**: Control who can view your verification status

### Document Signature (Envelopes)

1. **Create Envelope**: Navigate to /envelopes and create a new signing envelope
2. **Upload PDF**: Add the document that needs to be signed
3. **Add Recipients**: Specify wallet addresses of signers with signing order
4. **Send for Signing**: Lock the envelope and notify recipients
5. **Recipients Sign**: Signers use EIP-712 typed data signatures (gasless)
6. **Anchor to Blockchain**: Once all sign, anchor the envelope on-chain
7. **Verify Anytime**: Anyone can verify document authenticity via blockchain

### For Verifiers

1. **Grant Verifier Role**: Contract owner grants `VERIFIER_ROLE`
2. **Review Applications**: Access `/admin/kyc` in the frontend
3. **Move Cases Through Review**: `SUBMITTED -> UNDER_REVIEW -> APPROVED / REJECTED / RESUBMISSION_REQUIRED`
4. **Verify Documents**: Review metadata, document hashes, IPFS references, and audit history
5. **Mint Identity Token**: Trigger `verify-onchain` only after approval

## ✅ KYC Lifecycle

The KYC system now uses an explicit application lifecycle:

- `SUBMITTED`: created or updated when the user sends the KYC form
- `UNDER_REVIEW`: claimed by an admin or reviewer
- `APPROVED`: review completed successfully and ready for on-chain minting
- `REJECTED`: review completed negatively with a mandatory reason
- `RESUBMISSION_REQUIRED`: applicant must correct or replace evidence
- `VERIFIED`: blockchain mint completed successfully
- `FAILED`: on-chain verification failed after approval and the failure was recorded

The legacy `User.verificationStatus` field is still kept in sync for compatibility with existing dashboard/activity flows.

## 🧑‍⚖️ Admin Workflow

1. Open `/admin/kyc` to review the queue.
2. Filter or search by status, wallet, email, applicant name, or application ID.
3. Open an application detail page to inspect:
   - applicant summary metadata
   - document metadata and hashes
   - IPFS/data-hash references
   - blockchain transaction state
   - immutable audit history
4. Move the case to `UNDER_REVIEW`.
5. Approve, reject, or request resubmission.
6. After approval, trigger `verify-onchain` from the admin UI.

## 🔌 KYC Admin API

New admin-operable KYC endpoints:

- `GET /api/admin/kyc`
- `GET /api/admin/kyc/:id`
- `GET /api/admin/kyc/:id/audit`
- `GET /api/admin/kyc/stats`
- `PATCH /api/admin/kyc/:id/status`
- `POST /api/admin/kyc/:id/approve`
- `POST /api/admin/kyc/:id/reject`
- `POST /api/admin/kyc/:id/request-resubmission`
- `POST /api/admin/kyc/:id/verify-onchain`
- `GET /api/kyc/me?walletAddress=0x...`

## 🔐 Required Roles And Env

Application roles now support:

- `SUPER_ADMIN`
- `KYC_ADMIN`
- `KYC_REVIEWER`
- `VERIFIER`
- `AUDITOR`
- `SUPPORT_READONLY`

Important backend environment variables for the upgraded flow:

- `JWT_SECRET`
- `MASTER_ENCRYPTION_KEY`
- `MONGODB_URI`
- `ALLOWED_ORIGINS`
- `PRIVATE_KEY`
- `RPC_URL`
- `VERIFIER_API_KEY`

`VERIFIER_API_KEY` is still supported for the legacy protected `/api/kyc/verify` path, but the intended production flow is the frontend admin action calling `/api/admin/kyc/:id/verify-onchain`.

## 🧪 Local Testing Notes

- Backend workflow unit tests added:
  - `backend/src/__tests__/kycWorkflowService.test.js`
  - `backend/src/__tests__/rbacService.test.js`
- Run them locally with:

```bash
cd backend
npx jest src/__tests__/kycWorkflowService.test.js src/__tests__/rbacService.test.js --runInBand
```

### For Third Parties

1. **Verify Identity**: Use the verify page to check wallet addresses
2. **Request Access**: Request permission to view specific data
3. **Verify Proofs**: Validate transaction proofs cryptographically

## 🛠️ Technology Stack

**Smart Contracts**
- Solidity ^0.8.20
- OpenZeppelin Contracts
- Hardhat

**Backend**
- Node.js & Express
- MongoDB with Mongoose
- Ethers.js for Web3 interaction
- IPFS HTTP Client
- bcryptjs for password hashing
- JWT for authentication

**Frontend**
- Next.js 14 (App Router)
- React 18
- Wagmi & Viem for Web3
- RainbowKit for wallet connection
- Tailwind CSS

**Security**
- Helmet.js for HTTP security
- Rate limiting
- JWT authentication with email/password
- End-to-end encryption

## 🔒 Security

- **Encrypted Storage**: All PII encrypted before IPFS storage
- **Soulbound Tokens**: Identity tokens are non-transferable
- **Access Control**: Role-based permissions with OpenZeppelin AccessControl
- **No Raw Data On-Chain**: Only cryptographic hashes stored on blockchain
- **Consent-Based Sharing**: Users must explicitly grant access
- **Password Security**: Passwords hashed with bcrypt

## 🌐 Deployment

### Hoodi Testnet

1. **Get test ETH**: Obtain test ETH from the Hoodi testnet faucet

2. **Configure credentials**
   ```bash
   # In .env
   HOODI_RPC=https://hoodi.infura.io/v3/your_api_key
   PRIVATE_KEY=your_private_key
   HOODI_API_KEY=your_api_key
   ```

3. **Deploy**
   ```bash
   npm run deploy:hoodi
   ```

4. **Verify contracts**
   ```bash
   npx hardhat verify --network hoodi <contract_address>
   ```

### Polygon Mainnet

1. **Configure credentials**
   ```bash
   # In .env
   POLYGON_RPC=https://polygon-rpc.com
   PRIVATE_KEY=your_private_key
   POLYGONSCAN_API_KEY=your_api_key
   ```

2. **Deploy**
   ```bash
   npm run deploy:polygon
   ```

## 📚 Additional Documentation

- [API Documentation](./docs/API_DOCS.md)
- [User Guide](./docs/USER_GUIDE.md)

## 🤝 Contributing

Contributions are welcome! Please read our contributing guidelines and submit pull requests.

## 📄 License

This project is licensed under the MIT License.

## ⚠️ Important Notes

Before deploying to production:

- Ensure all environment variables are properly configured with strong, unique secrets
- Conduct smart contract security audits
- Review data protection regulations in your jurisdiction
- Set up proper key management (e.g., hardware wallets, key vaults)
- Configure TLS/SSL termination via a reverse proxy

## 🙋 Support

For questions or issues, please open a GitHub issue or contact the development team.

---

**Built with ❤️ for a decentralized future**
