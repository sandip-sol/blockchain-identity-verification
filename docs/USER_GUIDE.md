# User Guide - KYC/KYB Blockchain Platform

## Table of Contents
1. [Getting Started](#getting-started)
2. [Connecting Your Wallet](#connecting-your-wallet)
3. [Submitting KYC Verification](#submitting-kyc-verification)
4. [Managing Your Identity](#managing-your-identity)
5. [Verifying Others](#verifying-others)
6. [Transaction Proofs](#transaction-proofs)
7. [FAQ](#faq)

## Getting Started

### What You Need

Before using the platform, ensure you have:

1. **Web3 Wallet**: MetaMask, Rainbow, or any compatible Ethereum wallet
2. **Cryptocurrency**: Small amount of MATIC (for Mumbai testnet) or ETH for gas fees
3. **Documents**: Government-issued ID, proof of address (for KYC/KYB)
4. **Email Address**: For notifications and communication

### First-Time Setup

1. Visit the platform at `http://localhost:3000` (or production URL)
2. Install MetaMask if you don't have a wallet ([metamask.io](https://metamask.io))
3. Create a new wallet or import existing one
4. Add the network (Mumbai testnet or Polygon mainnet)

## Connecting Your Wallet

### Step-by-Step

1. **Click "Connect Wallet"** button in the top navigation
2. **Select Your Wallet** from the options (MetaMask, WalletConnect, etc.)
3. **Approve Connection** in your wallet popup
4. **Confirm Network** - switch to the correct network if prompted

![wallet_connection](Example: Click connect → Select MetaMask → Approve → Connected!)

> **Note**: Your wallet address is your identity. Make sure you're using the correct account.

## Submitting KYC Verification

### Individual KYC

1. **Navigate to KYC Page**
   - Click "KYC Verification" in the navigation menu
   - Or use the "Get Verified" button on the dashboard

2. **Select Verification Type**
   - Choose **KYC** for individual verification

3. **Fill Personal Information**
   - Full Name (as it appears on ID)
   - Date of Birth
   - Email Address
   - Country of Residence
   - Address (optional)

4. **Upload Documents**
   - **Required**: Government-issued ID (passport, driver's license, national ID)
   - **Required**: Proof of address (utility bill, bank statement, not older than 3 months)
   - Supported formats: JPG, PNG, PDF
   - Max file size: 10MB per file

5. **Review and Submit**
   - Check "I agree to Terms of Service"
   - Click "Submit Application"
   - Approve the transaction in your wallet

6. **Wait for Verification**
   - Processing typically takes 24-48 hours
   - You'll receive an email notification
   - Check status on your dashboard

### Business KYB

1. Follow the same steps as KYC, but select **KYB**
2. Provide business information:
   - Business Name
   - Registration Number
   - Email
   - Country

3. Upload business documents:
   - Certificate of Incorporation
   - Business License
   - Proof of Business Address

## Managing Your Identity

### Dashboard Overview

Your dashboard shows:

- **Verification Status**: Current state of your identity token
- **Token ID**: Your unique Soulbound NFT identifier
- **Expiry Date**: When your verification expires
- **Recent Transactions**: Blockchain activity

### Understanding Status Badges

- ✅ **Verified**: Active, valid verification
- ⏱️ **Pending**: Application under review
- ❌ **Rejected**: Application denied (contact support)
- 🔶 **Expired**: Verification expired (renew required)
- 🚫 **Revoked**: Verification revoked by verifier

### Renewing Verification

When your verification is close to expiry (< 30 days):

1. Dashboard will show a warning banner
2. Click "Renew Verification"
3. Update any changed information
4. Re-upload documents if required
5. Submit renewal application

> **Important**: Soulbound tokens cannot be transferred or sold. They represent YOU and stay with your wallet forever.

## Verifying Others

### How to Check Someone's Verification

1. **Go to Verify Page**
   - Click "Verify Identity" in navigation

2. **Enter Wallet Address**
   - Paste the Ethereum address (0x...)
   - Ensure it's the full 42-character address

3. **Click Verify**
   - System checks the blockchain
   - Results appear instantly

4. **Understand Results**
   - ✅ **Verified**: Address has valid identity token
   - ❌ **Not Verified**: No valid token found

### Privacy Note

- You can only see **IF** someone is verified, not **WHO** they are
- Personal information is encrypted and stored off-chain
- To access details, you need explicit permission from the user

### Requesting Data Access

(Feature coming soon)

1. Click "Request Access" on verification result
2. User receives notification
3. User grants/denies access
4. If granted, view permitted data fields

## Transaction Proofs

### Creating a Proof

1. **Navigate to Transaction Proofs** page
2. **Click "Create Proof"**
3. **Select Transaction**
   - Choose from your transaction history
   - Or enter transaction hash manually

4. **Set Permissions**
   - Choose what data to include
   - Set expiry date (optional)
   - Specify who can view

5. **Generate Proof**
   - Click "Create Proof"
   - Approve blockchain transaction
   - Proof created on-chain

### Sharing Proofs

1. **View Your Proofs** in the transaction table
2. **Click "Share"** on a proof
3. **Copy Link** or send to recipient
4. Recipient can verify proof authenticity

### Revoking Access

1. Go to Transaction Proofs page
2. Find the proof in the table
3. Click "Revoke Access"
4. Approve revocation transaction
5. Access immediately removed

## FAQ

### General

**Q: Is my data safe?**  
A: Yes. All personal information is encrypted before storage. Only cryptographic hashes go on the blockchain.

**Q: Can I transfer my identity token?**  
A: No. Identity tokens are "Soulbound" - permanently attached to your wallet address.

**Q: What happens if I lose access to my wallet?**  
A: Your identity token is tied to your wallet. If you lose the wallet, you'll need to verify again with a new wallet.

**Q: How much does verification cost?**  
A: Only gas fees for blockchain transactions. The verification service itself has no fee in this POC.

### Verification

**Q: How long does verification take?**  
A: Typically 24-48 hours. Complex cases may take longer.

**Q: Why was my application rejected?**  
A: Common reasons include unclear documents, expired documents, or information mismatch. Contact support for details.

**Q: Can I verify with multiple wallets?**  
A: Each wallet needs separate verification. One person can have multiple verified wallets.

**Q: Do I need to reverify?**  
A: Yes, verifications expire after a set period (usually 1 year). You'll receive reminders.

### Privacy

**Q: Who can see my information?**  
A: Only you and approved verifiers. Third parties can only see verification status unless you grant access.

**Q: Can I delete my data?**  
A: You can request data deletion through the platform. Note: blockchain records (hashes only) are immutable.

**Q: Is this GDPR compliant?**  
A: The platform is designed with GDPR principles, but full compliance depends on deployment configuration.

### Technical

**Q: Which networks are supported?**  
A: Currently: Polygon Mumbai (testnet) and Polygon Mainnet. More networks coming soon.

**Q: What if a transaction fails?**  
A: Check your wallet for gas fees. Retry the transaction. Contact support if issues persist.

**Q: Can I use a hardware wallet?**  
A: Yes! Any wallet compatible with WalletConnect works (Ledger, Trezor, etc.)

## Support

### Need Help?

- 📧 **Email**: support@kyc-platform.example
- 💬 **Discord**: [Join our community](#)
- 📖 **Documentation**: [docs.kyc-platform.example](#)
- 🐛 **Report Bug**: [GitHub Issues](#)

### Common Issues

**Wallet won't connect**
- Clear browser cache
- Try different browser
- Update wallet extension
- Check network selection

**Transaction stuck**
- Check gas price
- Speed up transaction in wallet
- Wait for network congestion to clear

**Upload fails**
- Check file size (< 10MB)
- Ensure correct format (JPG, PNG, PDF)
- Try compressing the file

---

**Last Updated**: January 2026  
**Version**: 1.0.0

*For technical documentation, see [README.md](../README.md) and [API_DOCS.md](./API_DOCS.md)*
