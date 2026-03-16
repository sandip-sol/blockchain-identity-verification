const logger = require('./logger');
const crypto = require('crypto');

/**
 * Encryption Service
 * Handles AES-256-GCM encryption/decryption for sensitive data
 * Keys are derived from user wallet signatures
 */

const ALGORITHM = process.env.ENCRYPTION_ALGORITHM || 'aes-256-gcm';
const MASTER_KEY = process.env.MASTER_ENCRYPTION_KEY;
if (!MASTER_KEY) {
    logger.error('❌ FATAL: MASTER_ENCRYPTION_KEY environment variable is required');
    process.exit(1);
}

class EncryptionService {
    /**
     * Generate encryption key from wallet signature
     * @param {string} walletSignature - User's wallet signature
     * @returns {Buffer} - Derived encryption key
     */
    static generateEncryptionKey(walletSignature) {
        // Use PBKDF2 to derive key from signature
        return crypto.pbkdf2Sync(
            walletSignature,
            MASTER_KEY,
            100000, // iterations
            32,     // key length
            'sha256'
        );
    }

    /**
     * Encrypt data with user-specific key
     * @param {Object|string} data - Data to encrypt
     * @param {string} walletAddress - User's wallet address
     * @param {string} walletSignature - User's wallet signature
     * @returns {Object} - Encrypted data with IV and auth tag
     */
    static encryptData(data, walletAddress, walletSignature) {
        try {
            const key = this.generateEncryptionKey(walletSignature);
            const iv = crypto.randomBytes(16);
            const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

            const dataString = typeof data === 'string' ? data : JSON.stringify(data);

            let encrypted = cipher.update(dataString, 'utf8', 'hex');
            encrypted += cipher.final('hex');

            const authTag = cipher.getAuthTag();

            return {
                encryptedData: encrypted,
                iv: iv.toString('hex'),
                authTag: authTag.toString('hex'),
                walletAddress
            };
        } catch (error) {
            throw new Error(`Encryption failed: ${error.message}`);
        }
    }

    /**
     * Decrypt data with user-specific key
     * @param {Object} encryptedObj - Object containing encrypted data, IV, and auth tag
     * @param {string} walletSignature - User's wallet signature for key derivation
     * @returns {Object|string} - Decrypted data
     */
    static decryptData(encryptedObj, walletSignature) {
        try {
            const key = this.generateEncryptionKey(walletSignature);
            const decipher = crypto.createDecipheriv(
                ALGORITHM,
                key,
                Buffer.from(encryptedObj.iv, 'hex')
            );

            decipher.setAuthTag(Buffer.from(encryptedObj.authTag, 'hex'));

            let decrypted = decipher.update(encryptedObj.encryptedData, 'hex', 'utf8');
            decrypted += decipher.final('utf8');

            // Try to parse as JSON, otherwise return as string
            try {
                return JSON.parse(decrypted);
            } catch {
                return decrypted;
            }
        } catch (error) {
            throw new Error(`Decryption failed: ${error.message}`);
        }
    }

    /**
     * Create SHA-256 hash of data for on-chain storage
     * @param {Object|string} data - Data to hash
     * @returns {string} - Hex hash string
     */
    static hashData(data) {
        const dataString = typeof data === 'string' ? data : JSON.stringify(data);
        return crypto.createHash('sha256').update(dataString).digest('hex');
    }

    /**
     * Create hash with 0x prefix for blockchain
     * @param {Object|string} data - Data to hash
     * @returns {string} - Hash with 0x prefix
     */
    static hashDataForBlockchain(data) {
        return '0x' + this.hashData(data);
    }

    /**
     * Verify data against hash
     * @param {Object|string} data - Original data
     * @param {string} hash - Hash to verify against
     * @returns {boolean} - True if hash matches
     */
    static verifyHash(data, hash) {
        const computedHash = this.hashData(data);
        const cleanHash = hash.startsWith('0x') ? hash.slice(2) : hash;
        return computedHash === cleanHash;
    }

    /**
     * Generate random encryption key (for master key generation)
     * @returns {string} - Hex encoded random key
     */
    static generateRandomKey() {
        return crypto.randomBytes(32).toString('hex');
    }
}

module.exports = EncryptionService;
