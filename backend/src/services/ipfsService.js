/**
 * IPFS Service
 * Handles decentralized storage operations for encrypted documents.
 * Supports: IPFS node, Pinata (production), local fallback (development).
 */

const logger = require('./logger');

class IPFSService {
    constructor() {
        this.client = null;
        this.isInitialized = false;
        this.pinataApiKey = null;
        this.pinataSecretKey = null;
        this.usePinata = false;
    }

    /**
     * Initialize IPFS client
     */
    async initialize() {
        if (this.isInitialized) return;

        // Pinata (preferred for production)
        if (process.env.PINATA_API_KEY && process.env.PINATA_SECRET_KEY) {
            this.pinataApiKey = process.env.PINATA_API_KEY;
            this.pinataSecretKey = process.env.PINATA_SECRET_KEY;
            this.usePinata = true;
            this.isInitialized = true;
            logger.info('IPFS service initialized with Pinata');
            return;
        }

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
                ipfsConfig.headers = { authorization: auth };
            }

            this.client = create(ipfsConfig);
            this.isInitialized = true;

            logger.info('IPFS client initialized', { host: ipfsConfig.host });
        } catch (error) {
            logger.error('IPFS initialization failed', { error: error.message });
            throw new Error(`IPFS initialization failed: ${error.message}`);
        }
    }

    // ──────────────────────────── Pinata helpers ────────────────────────────

    async _pinataUpload(data) {
        const https = require('https');
        return new Promise((resolve, reject) => {
            const body = JSON.stringify({ pinataContent: data });
            const req = https.request({
                hostname: 'api.pinata.cloud',
                path: '/pinning/pinJSONToIPFS',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'pinata_api_key': this.pinataApiKey,
                    'pinata_secret_api_key': this.pinataSecretKey,
                    'Content-Length': Buffer.byteLength(body)
                }
            }, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const parsed = JSON.parse(data);
                        if (parsed.IpfsHash) resolve(parsed.IpfsHash);
                        else reject(new Error('Pinata upload failed: ' + data));
                    } catch (e) { reject(e); }
                });
            });
            req.on('error', reject);
            req.write(body);
            req.end();
        });
    }

    async _pinataRetrieve(cid) {
        const https = require('https');
        return new Promise((resolve, reject) => {
            https.get(`https://gateway.pinata.cloud/ipfs/${cid}`, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try { resolve(JSON.parse(data)); }
                    catch (e) { reject(new Error('Failed to parse Pinata data')); }
                });
            }).on('error', reject);
        });
    }

    // ──────────────────────────── Public API ────────────────────────────────

    /**
     * Upload encrypted data to IPFS (or local fallback)
     * @param {Object} encryptedData - Encrypted data object
     * @returns {string} - IPFS CID or local ID
     */
    async uploadToIPFS(encryptedData) {
        if (!this.isInitialized) await this.initialize();

        // Pinata path
        if (this.usePinata) {
            try {
                const cid = await this._pinataUpload(encryptedData);
                logger.info('Uploaded to Pinata IPFS', { cid });
                return cid;
            } catch (error) {
                logger.warn('Pinata upload failed, falling back to local', { error: error.message });
                return this.saveLocally(encryptedData);
            }
        }

        try {
            const dataBuffer = Buffer.from(JSON.stringify(encryptedData));
            const result = await this.client.add(dataBuffer, { timeout: 5000 });

            logger.info('Uploaded to IPFS', { cid: result.path });
            return result.path;
        } catch (error) {
            logger.warn('IPFS upload failed, falling back to local storage', { error: error.message });
            if (process.env.NODE_ENV === 'production') {
                logger.error('CRITICAL: Local fallback used in production — data is NOT replicated');
            }
            return this.saveLocally(encryptedData);
        }
    }

    /**
     * Upload raw bytes to IPFS with local fallback.
     * @param {Buffer} bytes
     * @param {string} filename
     */
    async uploadRaw(bytes, filename = 'file.bin') {
        if (!this.isInitialized) await this.initialize();

        try {
            const result = await this.client.add(bytes, { timeout: 10000, pin: true, wrapWithDirectory: false });
            logger.info('Uploaded raw to IPFS', { cid: result.path, filename });
            return result.path;
        } catch (error) {
            logger.warn('IPFS raw upload failed, falling back to local', { error: error.message });
            return this.saveLocallyRaw(bytes, filename);
        }
    }

    /**
     * Retrieve raw bytes from IPFS or local.
     * @param {string} cid
     * @returns {Buffer}
     */
    async retrieveRaw(cid) {
        if (cid.startsWith('localraw-')) {
            return this.retrieveLocallyRaw(cid);
        }

        if (!this.isInitialized) await this.initialize();

        try {
            const chunks = [];
            for await (const chunk of this.client.cat(cid, { timeout: 10000 })) {
                chunks.push(chunk);
            }
            return Buffer.concat(chunks);
        } catch (error) {
            logger.warn('IPFS raw retrieval failed, checking local', { error: error.message });
            return this.retrieveLocallyRaw(cid);
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

        // Pinata path
        if (this.usePinata) {
            try {
                return await this._pinataRetrieve(cid);
            } catch (error) {
                logger.warn('Pinata retrieval failed, checking local', { error: error.message });
                return this.retrieveLocally(cid);
            }
        }

        if (!this.isInitialized) await this.initialize();

        try {
            const chunks = [];
            for await (const chunk of this.client.cat(cid, { timeout: 5000 })) {
                chunks.push(chunk);
            }
            const data = Buffer.concat(chunks).toString('utf8');
            logger.info('Retrieved from IPFS', { cid });
            return JSON.parse(data);
        } catch (error) {
            logger.warn('IPFS retrieval failed, checking local', { error: error.message });
            return this.retrieveLocally(cid);
        }
    }

    async pinDocument(cid) {
        if (cid.startsWith('local-')) return true;
        if (this.usePinata) return true; // Pinata auto-pins on upload
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

    // ──────────────────────────── Local Fallback ────────────────────────────

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
        logger.info('Saved locally', { id });
        return id;
    }

    saveLocallyRaw(bytes, filename) {
        const fs = require('fs');
        const path = require('path');
        const uploadDir = path.join(__dirname, '../../uploads_raw');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        const id = 'localraw-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
        const safe = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
        const filePath = path.join(uploadDir, `${id}-${safe}`);
        fs.writeFileSync(filePath, bytes);
        logger.info('Saved raw locally', { id });
        return id;
    }

    retrieveLocallyRaw(idOrPath) {
        const fs = require('fs');
        const path = require('path');
        const uploadDir = path.join(__dirname, '../../uploads_raw');

        if (idOrPath.startsWith('localraw-')) {
            if (!fs.existsSync(uploadDir)) throw new Error('Local raw storage not initialized');
            const files = fs.readdirSync(uploadDir);
            const match = files.find(f => f.startsWith(idOrPath + '-'));
            if (!match) throw new Error('Raw document not found locally');
            return fs.readFileSync(path.join(uploadDir, match));
        }

        return fs.readFileSync(path.join(uploadDir, idOrPath));
    }

    retrieveLocally(id) {
        const fs = require('fs');
        const path = require('path');
        const filePath = path.join(__dirname, '../../uploads', id + '.json');

        try {
            return JSON.parse(fs.readFileSync(filePath, 'utf8'));
        } catch (e) {
            logger.error('Local retrieval failed', { id, error: e.message });
            throw new Error('Document not found locally or on IPFS');
        }
    }
}

// Export singleton instance
module.exports = new IPFSService();
