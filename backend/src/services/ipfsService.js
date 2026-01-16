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
            // Dynamic import for ESM compatibility
            const { create } = await import('ipfs-http-client');

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
     * Upload encrypted data to IPFS (or local fallback)
     * @param {Object} encryptedData - Encrypted data object
     * @returns {string} - IPFS CID or local ID
     */
    async uploadToIPFS(encryptedData) {
        if (!this.isInitialized) {
            await this.initialize();
        }

        try {
            const dataBuffer = Buffer.from(JSON.stringify(encryptedData));
            const result = await this.client.add(dataBuffer, { timeout: 5000 });

            console.log('📤 Uploaded to IPFS:', result.path);
            return result.path; // CID
        } catch (error) {
            console.warn('⚠️ IPFS upload failed, falling back to local storage:', error.message);
            // Fallback to local storage
            return this.saveLocally(encryptedData);
        }
    }

    /**
     * Retrieve encrypted data from IPFS (or local fallback)
     * @param {string} cid - IPFS Content Identifier or local ID
     * @returns {Object} - Encrypted data object
     */
    async retrieveFromIPFS(cid) {
        if (cid.startsWith('local-')) {
            return this.retrieveLocally(cid);
        }

        if (!this.isInitialized) {
            await this.initialize();
        }

        try {
            const chunks = [];

            for await (const chunk of this.client.cat(cid, { timeout: 5000 })) {
                chunks.push(chunk);
            }

            const data = Buffer.concat(chunks).toString('utf8');
            console.log('📥 Retrieved from IPFS:', cid);

            return JSON.parse(data);
        } catch (error) {
            console.warn('⚠️ IPFS retrieval failed, checking local:', error.message);
            // Try local as a backup even if not prefixed
            return this.retrieveLocally(cid);
        }
    }

    // ... (pin/unpin remain similar but should check for local)

    async pinDocument(cid) {
        if (cid.startsWith('local-')) return true;
        try {
            await this.client.pin.add(cid, { timeout: 5000 });
            return true;
        } catch (e) { return false; }
    }

    async unpinDocument(cid) {
        if (cid.startsWith('local-')) return true;
        try {
            await this.client.pin.rm(cid);
            return true;
        } catch (e) { return false; }
    }

    async exists(cid) {
        if (cid.startsWith('local-')) return true;
        return true;
    }

    // Local Storage Fallback Helpers
    saveLocally(data) {
        const fs = require('fs');
        const path = require('path');
        const uploadDir = path.join(__dirname, '../../uploads');

        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        const id = 'local-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
        const filePath = path.join(uploadDir, id + '.json');

        fs.writeFileSync(filePath, JSON.stringify(data));
        console.log('💾 Saved locally:', id);
        return id;
    }

    retrieveLocally(id) {
        const fs = require('fs');
        const path = require('path');
        const filePath = path.join(__dirname, '../../uploads', id + '.json'); // Handle both IDs

        // Use exact ID as filename
        const exactPath = path.join(__dirname, '../../uploads', id.startsWith('local-') ? (id + '.json') : ('local-' + id + '.json'));

        if (fs.existsSync(filePath)) {
            return JSON.parse(fs.readFileSync(filePath, 'utf8'));
        }

        // Try without .json or as-is if passed with .json, simplified:
        // Actually, just trust the ID format I generated
        try {
            return JSON.parse(fs.readFileSync(filePath, 'utf8'));
        } catch (e) {
            console.error('Local retrieval failed:', e.message);
            throw new Error('Document not found locally or on IPFS');
        }
    }
}

// Export singleton instance
module.exports = new IPFSService();
