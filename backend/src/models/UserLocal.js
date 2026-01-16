const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../../data/users');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

class UserLocal {
    constructor(data) {
        this._data = { ...data };
        // Assign default values if not present
        this._data.verificationStatus = this._data.verificationStatus || 'PENDING';
        this._data.verificationType = this._data.verificationType || 'NONE';
        this._data.createdAt = this._data.createdAt || new Date();
        this._data.updatedAt = new Date();

        // Map top-level properties to _data for easy access (mimicking Mongoose document)
        Object.keys(this._data).forEach(key => {
            this[key] = this._data[key];
        });
    }

    static async findOne(query) {
        try {
            if (!query.walletAddress) return null;

            const walletAddress = query.walletAddress.toLowerCase();
            const filePath = path.join(DATA_DIR, `${walletAddress}.json`);

            if (fs.existsSync(filePath)) {
                const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                return new UserLocal(data);
            }
            return null;
        } catch (error) {
            console.error('Local DB findOne error:', error);
            return null;
        }
    }

    async save() {
        try {
            if (!this.walletAddress) {
                throw new Error('Wallet address required for local storage');
            }

            const walletAddress = this.walletAddress.toLowerCase();
            const filePath = path.join(DATA_DIR, `${walletAddress}.json`);

            // Update timestamps
            this._data.updatedAt = new Date();

            // Sync properties back to _data
            Object.keys(this).forEach(key => {
                if (key !== '_data') {
                    this._data[key] = this[key];
                }
            });

            fs.writeFileSync(filePath, JSON.stringify(this._data, null, 2));
            console.log(`💾 Saved user locally: ${walletAddress}`);
            return this;
        } catch (error) {
            console.error('Local DB save error:', error);
            throw error;
        }
    }
}

module.exports = UserLocal;
