# KYC/KYB Blockchain Platform

A decentralized identity verification platform built on blockchain technology, enabling secure, tamper-proof KYC/KYB verification with privacy-preserving data sharing.

## 🌟 Features

- **Soulbound Identity Tokens**: Non-transferable NFTs representing verified identities
- **Off-Chain Encrypted Storage**: Sensitive PII stored on IPFS with only hashes on-chain
- **Selective Data Disclosure**: Granular access control with EIP-712 signatures
- **Transaction Proofs**: Tokenize and verify specific transactions
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
│   ├── IdentityToken.sol         # Soulbound identity NFT
│   ├── TransactionRegistry.sol   # Transaction proofs
│   ├── AccessControl.sol          # Data access management
│   └── test/                      # Contract tests
├── scripts/               # Deployment scripts
├── backend/               # Backend API
│   └── src/
│       ├── routes/              # API endpoints
│       ├── services/            # Business logic
│       ├── models/              # Database models
│       └── server.js            # Express server
├── frontend/              # Frontend application
│   ├── app/                     # Next.js app router
│   ├── pages/                   # Page components
│   ├── components/              # Reusable components
│   ├── hooks/                   # Custom React hooks
│   └── styles/                  # CSS styles
└── docs/                  # Documentation
```

## 🚀 Getting Started

### Prerequisites

- **Node.js** >= 18.0.0
- **npm** or **yarn**
- **MongoDB** (optional for local development)
- **MetaMask** or compatible Web3 wallet

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

5. **Configure MetaMask**
   - Add localhost network (Chain ID: 1337, RPC: http://127.0.0.1:8545)
   - Import one of the Hardhat test accounts

## 🧪 Testing

### Smart Contract Tests
```bash
npm test
```

### Run specific test file
```bash
npx hardhat test contracts/test/IdentityToken.test.js
```

## 📝 Usage

### For Users

1. **Connect Wallet**: Click "Connect Wallet" and select your Web3 wallet
2. **Submit KYC**: Navigate to KYC Verification page and fill out the form
3. **Upload Documents**: Attach government-issued ID and proof of address
4. **Receive Token**: Once verified, receive a Soulbound identity token
5. **Manage Access**: Control who can view your verification status

### For Verifiers

1. **Grant Verifier Role**: Contract owner grants `VERIFIER_ROLE`
2. **Review Applications**: Access backend admin panel
3. **Verify Documents**: Review submitted KYC/KYB information
4. **Mint Identity Token**: Approve and mint identity token on-chain

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

**Frontend**
- Next.js 14 (App Router)
- React 18
- Wagmi & Viem for Web3
- RainbowKit for wallet connection
- Tailwind CSS

**Security**
- Helmet.js for HTTP security
- Rate limiting
- JWT authentication
- End-to-end encryption

## 🔒 Security

- **Encrypted Storage**: All PII encrypted before IPFS storage
- **Soulbound Tokens**: Identity tokens are non-transferable
- **Access Control**: Role-based permissions with OpenZeppelin AccessControl
- **No Raw Data On-Chain**: Only cryptographic hashes stored on blockchain
- **Consent-Based Sharing**: Users must explicitly grant access

## 🌐 Deployment

### Polygon Mumbai Testnet

1. **Get MATIC**: Obtain test MATIC from [Mumbai Faucet](https://faucet.polygon.technology/)

2. **Configure credentials**
   ```bash
   # In .env
   POLYGON_MUMBAI_RPC=https://rpc-mumbai.maticvigil.com
   PRIVATE_KEY=your_private_key
   POLYGONSCAN_API_KEY=your_api_key
   ```

3. **Deploy**
   ```bash
   npm run deploy:mumbai
   ```

4. **Verify contracts**
   ```bash
   npx hardhat verify --network mumbai <contract_address>
   ```

## 📚 Additional Documentation

- [API Documentation](./docs/API_DOCS.md)
- [User Guide](./docs/USER_GUIDE.md)
- [Smart Contract Documentation](./docs/CONTRACTS.md)

## 🤝 Contributing

Contributions are welcome! Please read our contributing guidelines and submit pull requests.

## 📄 License

This project is licensed under the MIT License.

## ⚠️ Disclaimer

This is a Proof of Concept (POC) for educational and demonstration purposes. Before using in production:

- Conduct thorough security audits
- Implement additional compliance measures
- Review data protection regulations in your jurisdiction
- Perform penetration testing
- Set up proper key management

## 🙋 Support

For questions or issues, please open a GitHub issue or contact the development team.

---

**Built with ❤️ for a decentralized future**
# blockchain-identity-verification
