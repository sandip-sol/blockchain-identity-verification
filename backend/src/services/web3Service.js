const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

/**
 * Web3 Service
 * Handles blockchain interactions with smart contracts
 */

class Web3Service {
    constructor() {
        this.provider = null;
        this.signer = null;
        this.contracts = {};
        this.isInitialized = false;
    }

    /**
     * Initialize Web3 provider and contracts
     */
    async initialize() {
        if (this.isInitialized) return;

        try {
            // Setup provider
            const rpcUrl = process.env.RPC_URL || process.env.POLYGON_MUMBAI_RPC || 'http://localhost:8545';
            this.provider = new ethers.JsonRpcProvider(rpcUrl);

            // Setup signer if private key available
            if (process.env.PRIVATE_KEY) {
                this.signer = new ethers.Wallet(process.env.PRIVATE_KEY, this.provider);
                console.log('✅ Signer initialized:', this.signer.address);
            }

            // Load contract ABIs and addresses
            await this.loadContracts();

            this.isInitialized = true;
            console.log('✅ Web3 service initialized');
        } catch (error) {
            console.error('❌ Web3 initialization failed:', error.message);
            throw new Error(`Web3 initialization failed: ${error.message}`);
        }
    }

    /**
     * Load contract ABIs and create contract instances
     */
    async loadContracts() {
        try {
            // Load deployment info
            const deploymentPath = path.join(
                __dirname,
                '../../../deployments/localhost-latest.json'
            );

            if (fs.existsSync(deploymentPath)) {
                const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));

                // Load ABIs from artifacts
                const identityTokenABI = this.loadABI('IdentityToken');
                const transactionRegistryABI = this.loadABI('TransactionRegistry');
                const accessControlABI = this.loadABI('DataAccessControl');
                let documentRegistryABI;
                try {
                    documentRegistryABI = this.loadABI('DocumentSignatureRegistry');
                } catch (e) {
                    documentRegistryABI = null;
                }

                // Create contract instances
                this.contracts.identityToken = new ethers.Contract(
                    deployment.contracts.IdentityToken,
                    identityTokenABI,
                    this.signer || this.provider
                );

                this.contracts.transactionRegistry = new ethers.Contract(
                    deployment.contracts.TransactionRegistry,
                    transactionRegistryABI,
                    this.signer || this.provider
                );

                this.contracts.accessControl = new ethers.Contract(
                    deployment.contracts.DataAccessControl,
                    accessControlABI,
                    this.signer || this.provider
                );

                // Optional DocuSign-like registry
                const regAddr = process.env.DOCUSIGN_REGISTRY_ADDRESS || deployment.contracts.DocumentSignatureRegistry;
                if (documentRegistryABI && regAddr) {
                    this.contracts.documentRegistry = new ethers.Contract(
                        regAddr,
                        documentRegistryABI,
                        this.signer || this.provider
                    );
                }

                console.log('✅ Contracts loaded successfully');
            } else {
                console.warn('⚠️  No deployment file found. Contracts not loaded.');
            }
        } catch (error) {
            console.error('Contract loading error:', error.message);
        }
    }

    /**
     * Load contract ABI from artifacts
     */
    loadABI(contractName) {
        // Hardhat artifacts are stored under artifacts/contracts/<SourceFile>.sol/<ContractName>.json.
        // Some contracts in this repo have different source filenames (e.g., AccessControl.sol -> DataAccessControl).
        // So we search for the correct artifact path by contract name.
        const contractsDir = path.join(__dirname, '../../../artifacts/contracts');

        // Fast path: expected convention
        const conventional = path.join(contractsDir, `${contractName}.sol`, `${contractName}.json`);
        if (fs.existsSync(conventional)) {
            const artifact = JSON.parse(fs.readFileSync(conventional, 'utf8'));
            return artifact.abi;
        }

        // Search path: look for any <ContractName>.json under artifacts/contracts/**
        const entries = fs.readdirSync(contractsDir, { withFileTypes: true });
        for (const entry of entries) {
            if (!entry.isDirectory()) continue;
            const candidate = path.join(contractsDir, entry.name, `${contractName}.json`);
            if (fs.existsSync(candidate)) {
                const artifact = JSON.parse(fs.readFileSync(candidate, 'utf8'));
                return artifact.abi;
            }
        }

        throw new Error(`ABI for ${contractName} not found under artifacts/contracts`);
    }

    /**
     * Mint identity token
     */
    async mintIdentityToken(userAddress, dataHash, verificationType, expiryDate) {
        if (!this.isInitialized) await this.initialize();

        try {
            const tx = await this.contracts.identityToken.mintIdentityToken(
                userAddress,
                dataHash,
                verificationType,
                expiryDate
            );

            const receipt = await tx.wait();
            console.log('✅ Identity token minted:', receipt.hash);

            // Extract token ID from event
            const event = receipt.logs.find(log => {
                try {
                    const parsed = this.contracts.identityToken.interface.parseLog(log);
                    return parsed.name === 'IdentityMinted';
                } catch {
                    return false;
                }
            });

            if (event) {
                const parsed = this.contracts.identityToken.interface.parseLog(event);
                return {
                    txHash: receipt.hash,
                    tokenId: parsed.args.tokenId.toString(),
                    blockNumber: receipt.blockNumber
                };
            }

            return { txHash: receipt.hash, blockNumber: receipt.blockNumber };
        } catch (error) {
            throw new Error(`Minting failed: ${error.message}`);
        }
    }

    /**
     * Register transaction on-chain
     */
    async registerTransaction(txHash, txType, metadata) {
        if (!this.isInitialized) await this.initialize();

        try {
            const tx = await this.contracts.transactionRegistry.registerTransaction(
                txHash,
                txType,
                metadata
            );

            const receipt = await tx.wait();
            console.log('✅ Transaction registered:', receipt.hash);

            // Extract token ID from TransactionRegistered event
            const eventLog = receipt.logs.find((log) => {
                try {
                    const parsed = this.contracts.transactionRegistry.interface.parseLog(log);
                    return parsed.name === 'TransactionRegistered';
                } catch {
                    return false;
                }
            });

            if (eventLog) {
                const parsed = this.contracts.transactionRegistry.interface.parseLog(eventLog);
                return {
                    txHash: receipt.hash,
                    tokenId: parsed.args.tokenId.toString(),
                    blockNumber: receipt.blockNumber
                };
            }

            return { txHash: receipt.hash, blockNumber: receipt.blockNumber };
        } catch (error) {
            throw new Error(`Transaction registration failed: ${error.message}`);
        }
    }

    /**
     * Batch register transactions on-chain
     */
    async batchRegisterTransactions(txHashes, txTypes, metadataHashes) {
        if (!this.isInitialized) await this.initialize();

        try {
            const tx = await this.contracts.transactionRegistry.batchRegisterTransactions(
                txHashes,
                txTypes,
                metadataHashes
            );

            const receipt = await tx.wait();
            console.log('✅ Batch transactions registered:', receipt.hash);

            // Try to parse TransactionBatchRegistered event for tokenIds
            const eventLog = receipt.logs.find((log) => {
                try {
                    const parsed = this.contracts.transactionRegistry.interface.parseLog(log);
                    return parsed.name === 'TransactionBatchRegistered';
                } catch {
                    return false;
                }
            });

            if (eventLog) {
                const parsed = this.contracts.transactionRegistry.interface.parseLog(eventLog);
                const tokenIds = parsed.args.tokenIds.map((x) => x.toString());
                return { txHash: receipt.hash, tokenIds, blockNumber: receipt.blockNumber };
            }

            return { txHash: receipt.hash, blockNumber: receipt.blockNumber };
        } catch (error) {
            throw new Error(`Batch transaction registration failed: ${error.message}`);
        }
    }

    /**
     * Anchor a completed envelope on-chain (optional DocuSign-like proof).
     * Contract: DocumentSignatureRegistry
     */
    async anchorEnvelope({ envelopeIdBytes32, documentFinalHash, signers, finalCID }) {
        if (!this.isInitialized) await this.initialize();
        if (!this.signer) throw new Error('PRIVATE_KEY not configured');
        if (!this.contracts.documentRegistry) throw new Error('DocumentSignatureRegistry not configured');

        try {
            const tx = await this.contracts.documentRegistry.completeEnvelope(
                envelopeIdBytes32,
                documentFinalHash,
                signers,
                finalCID || ''
            );
            const receipt = await tx.wait();
            return { txHash: receipt.hash, blockNumber: receipt.blockNumber };
        } catch (error) {
            throw new Error(`Envelope anchoring failed: ${error.message}`);
        }
    }

    /**
     * Access control helpers
     */
    async getAccessControlDomain() {
        if (!this.isInitialized) await this.initialize();
        const net = await this.provider.getNetwork();
        return {
            name: 'KYC-KYB DataAccessControl',
            version: '1',
            chainId: Number(net.chainId),
            verifyingContract: await this.contracts.accessControl.getAddress()
        };
    }

    async getAccessNonce(ownerAddress) {
        if (!this.isInitialized) await this.initialize();
        return Number(await this.contracts.accessControl.getNonce(ownerAddress));
    }

    async hasAccess(requester, dataOwner, tokenId) {
        if (!this.isInitialized) await this.initialize();
        return await this.contracts.accessControl.hasAccess(requester, dataOwner, tokenId);
    }

    async getAccessGrantDetails(accessId) {
        if (!this.isInitialized) await this.initialize();
        return await this.contracts.accessControl.getAccessGrantDetails(accessId);
    }

    async getTxReceipt(txHash) {
        if (!this.isInitialized) await this.initialize();
        return await this.provider.getTransactionReceipt(txHash);
    }

    async isSignerVerifier() {
        if (!this.isInitialized) await this.initialize();
        if (!this.signer) return false;
        const addr = await this.signer.getAddress();
        const role = await this.contracts.identityToken.VERIFIER_ROLE();
        return await this.contracts.identityToken.hasRole(role, addr);
    }

    /**
     * Verify EIP-712 signature
     */
    verifySignature(message, signature, expectedAddress) {
        try {
            const recoveredAddress = ethers.verifyMessage(message, signature);
            return recoveredAddress.toLowerCase() === expectedAddress.toLowerCase();
        } catch (error) {
            console.error('Signature verification failed:', error);
            return false;
        }
    }

    /**
     * Verify typed data signature (EIP-712)
     */
    verifyTypedDataSignature(domain, types, value, signature, expectedAddress) {
        try {
            const recoveredAddress = ethers.verifyTypedData(domain, types, value, signature);
            return recoveredAddress.toLowerCase() === expectedAddress.toLowerCase();
        } catch (error) {
            console.error('Typed data signature verification failed:', error);
            return false;
        }
    }

    /**
     * Check if user is verified
     */
    async isVerified(userAddress) {
        if (!this.isInitialized) await this.initialize();

        try {
            // If contracts not loaded, return false gracefully
            if (!this.contracts.identityToken) {
                console.warn('⚠️ IdentityToken contract not loaded, returning false for isVerified');
                return false;
            }
            return await this.contracts.identityToken.isVerified(userAddress);
        } catch (error) {
            throw new Error(`Verification check failed: ${error.message}`);
        }
    }

    /**
     * Get user's IdentityToken id ("digital identity number") if present.
     * Returns string tokenId or null.
     */
    async getIdentityTokenId(userAddress) {
        if (!this.isInitialized) await this.initialize();

        try {
            const tokenId = await this.contracts.identityToken.userToToken(userAddress);
            const n = Number(tokenId);
            return n && n > 0 ? String(n) : null;
        } catch (error) {
            // If contract interface doesn't expose userToToken, just return null
            return null;
        }
    }

    /**
     * Get token metadata
     */
    async getTokenMetadata(tokenId) {
        if (!this.isInitialized) await this.initialize();

        try {
            const metadata = await this.contracts.identityToken.getTokenMetadata(tokenId);
            return {
                dataHash: metadata.dataHash,
                verifier: metadata.verifier,
                verificationType: metadata.verificationType,
                verifiedAt: Number(metadata.verifiedAt),
                expiryDate: Number(metadata.expiryDate),
                isRevoked: metadata.isRevoked
            };
        } catch (error) {
            throw new Error(`Failed to get metadata: ${error.message}`);
        }
    }

    /**
     * Listen to contract events
     */
    listenToEvents() {
        if (!this.isInitialized) {
            throw new Error('Web3 service not initialized');
        }

        // Listen to IdentityMinted events
        this.contracts.identityToken.on('IdentityMinted', (tokenId, user, verifier, type, expiry, event) => {
            console.log('📢 IdentityMinted event:', {
                tokenId: tokenId.toString(),
                user,
                verifier,
                type,
                expiry: new Date(Number(expiry) * 1000)
            });
        });

        // Listen to TransactionRegistered events
        this.contracts.transactionRegistry.on('TransactionRegistered', (tokenId, registeredBy, txHash, txType, timestamp, event) => {
            console.log('📢 TransactionRegistered event:', {
                tokenId: tokenId.toString(),
                registeredBy,
                txHash,
                txType,
                timestamp: new Date(Number(timestamp) * 1000)
            });
        });

        console.log('👂 Event listeners attached');
    }

    /**
     * Get current gas price
     */
    async getGasPrice() {
        if (!this.isInitialized) await this.initialize();
        const feeData = await this.provider.getFeeData();
        return feeData.gasPrice;
    }

    /**
     * Get network info
     */
    async getNetworkInfo() {
        if (!this.isInitialized) await this.initialize();
        return await this.provider.getNetwork();
    }
}

// Export singleton instance
module.exports = new Web3Service();
