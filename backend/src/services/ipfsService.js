const { create } = require('ipfs-http-client');

/**
 * IPFS Service
 * Handles decentralized storage operations for encrypted documents
 */

class IPFSService {
    constructor() {
        this.client = null;
        this.isInitialized = false;
    }

    /**
     * Initialize IPFS client
     */
    async initialize() {
        if (this.isInitialized) return;

        try {
            const ipfsConfig = {
                host: process.env.IPFS_HOST || 'localhost',
                port: process.env.IPFS_PORT || 5001,
                protocol: process.env.IPFS_PROTOCOL || 'http'
            };

            // If using Infura or other service
            if (process.env.IPFS_PROJECT_ID && process.env.IPFS_PROJECT_SECRET) {
                const auth = 'Basic ' + Buffer.from(
                    process.env.IPFS_PROJECT_ID + ':' + process.env.IPFS_PROJECT_SECRET
                ).toString('base64');

                ipfsConfig.host = 'ipfs.infura.io';
                ipfsConfig.port = 5001;
                ipfsConfig.protocol = 'https';
                ipfsConfig.headers = {
                    authorization: auth
                };
            }

            this.client = create(ipfsConfig);
            this.isInitialized = true;

            console.log('✅ IPFS client initialized');
        } catch (error) {
            console.error('❌ IPFS initialization failed:', error.message);
            throw new Error(`IPFS initialization failed: ${error.message}`);
        }
    }

    /**
     * Upload encrypted data to IPFS
     * @param {Object} encryptedData - Encrypted data object
     * @returns {string} - IPFS CID
     */
    async uploadToIPFS(encryptedData) {
        if (!this.isInitialized) {
            await this.initialize();
        }

        try {
            const dataBuffer = Buffer.from(JSON.stringify(encryptedData));
            const result = await this.client.add(dataBuffer);

            console.log('📤 Uploaded to IPFS:', result.path);
            return result.path; // CID
        } catch (error) {
            throw new Error(`IPFS upload failed: ${error.message}`);
        }
    }

    /**
     * Retrieve encrypted data from IPFS
     * @param {string} cid - IPFS Content Identifier
     * @returns {Object} - Encrypted data object
     */
    async retrieveFromIPFS(cid) {
        if (!this.isInitialized) {
            await this.initialize();
        }

        try {
            const chunks = [];

            for await (const chunk of this.client.cat(cid)) {
                chunks.push(chunk);
            }

            const data = Buffer.concat(chunks).toString('utf8');
            console.log('📥 Retrieved from IPFS:', cid);

            return JSON.parse(data);
        } catch (error) {
            throw new Error(`IPFS retrieval failed: ${error.message}`);
        }
    }

    /**
     * Pin document to ensure persistence
     * @param {string} cid - IPFS Content Identifier
     */
    async pinDocument(cid) {
        if (!this.isInitialized) {
            await this.initialize();
        }

        try {
            await this.client.pin.add(cid);
            console.log('📌 Pinned to IPFS:', cid);
            return true;
        } catch (error) {
            console.error('Pin failed:', error.message);
            return false;
        }
    }

    /**
     * Unpin document
     * @param {string} cid - IPFS Content Identifier
     */
    async unpinDocument(cid) {
        if (!this.isInitialized) {
            await this.initialize();
        }

        try {
            await this.client.pin.rm(cid);
            console.log('🔓 Unpinned from IPFS:', cid);
            return true;
        } catch (error) {
            console.error('Unpin failed:', error.message);
            return false;
        }
    }

    /**
     * Check if content exists and is accessible
     * @param {string} cid - IPFS Content Identifier
     * @returns {boolean}
     */
    async exists(cid) {
        if (!this.isInitialized) {
            await this.initialize();
        }

        try {
            const stats = await this.client.object.stat(cid, { timeout: 5000 });
            return !!stats;
        } catch (error) {
            return false;
        }
    }
}

// Export singleton instance
module.exports = new IPFSService();
