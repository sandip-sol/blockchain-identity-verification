const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

// ── Production startup validation ──────────────────────────────────
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const REQUIRED_ENV_VARS = ['JWT_SECRET', 'MASTER_ENCRYPTION_KEY', 'MONGODB_URI'];

if (IS_PRODUCTION) {
    const missing = REQUIRED_ENV_VARS.filter(v => !process.env[v]);
    if (missing.length > 0) {
        console.error(`❌ FATAL: Missing required environment variables: ${missing.join(', ')}`);
        process.exit(1);
    }
}

const kycRoutes = require('./routes/kycRoutes');
const transactionRoutes = require('./routes/transactionRoutes');
const accessRoutes = require('./routes/accessRoutes');
const envelopeRoutes = require('./routes/envelopeRoutes');
const activityRoutes = require('./routes/activityRoutes');
const authRoutes = require('./routes/authRoutes');
const web3Service = require('./services/web3Service');
const ipfsService = require('./services/ipfsService');

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet());
app.use(compression());

// CORS configuration
const corsOptions = {
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: true
};
app.use(cors(corsOptions));

// Rate limiting
const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100
});
app.use('/api/', limiter);

// Stricter rate limiting for auth endpoints (brute-force protection)
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // 20 auth attempts per window
    message: { error: 'Too many authentication attempts. Please try again later.' }
});
app.use('/api/auth/', authLimiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging
if (process.env.NODE_ENV !== 'production') {
    app.use(morgan('dev'));
} else {
    app.use(morgan('combined'));
}

// Database connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/kyc-kyb-platform')
    .then(async () => {
        console.log('✅ MongoDB connected');

        // Migration: drop old unique index on 'address' field if it exists
        // This is needed because we changed from wallet-first auth to email-first auth
        try {
            await mongoose.connection.collection('accounts').dropIndex('address_1');
            console.log('✅ Dropped old address_1 unique index');
        } catch (e) {
            // Index might not exist, which is fine
            if (!e.message.includes('index not found')) {
                console.log('⚠️ Note:', e.message);
            }
        }
    })
    .catch(err => console.error('❌ MongoDB connection error:', err));

// Initialize services
const initializeServices = async () => {
    try {
        await web3Service.initialize();
        await ipfsService.initialize();

        // Start event listeners
        if (web3Service.isInitialized) {
            web3Service.listenToEvents();
        }

        console.log('✅ All services initialized');
    } catch (error) {
        console.error('⚠️  Service initialization warning:', error.message);
        console.log('Some features may not be available');
    }
};

initializeServices();

// API Routes
app.use('/api/kyc', kycRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/transaction', transactionRoutes);
app.use('/api/access', accessRoutes);
app.use('/api/envelopes', envelopeRoutes);
app.use('/api/activity', activityRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'healthy',
        services: {
            web3: web3Service.isInitialized,
            ipfs: ipfsService.isInitialized,
            database: mongoose.connection.readyState === 1
        },
        timestamp: new Date().toISOString()
    });
});

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        name: 'KYC/KYB Blockchain Platform API',
        version: '1.0.0',
        endpoints: {
            kyc: '/api/kyc',
            transactions: '/api/transaction',
            access: '/api/access',
            envelopes: '/api/envelopes',
            health: '/health'
        }
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err.stack);

    res.status(err.status || 500).json({
        error: process.env.NODE_ENV === 'production'
            ? 'Internal server error'
            : err.message,
        ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
    });
});

// Start server
app.listen(PORT, () => {
    console.log('='.repeat(60));
    console.log(`🚀 KYC/KYB Backend Server`);
    console.log('='.repeat(60));
    console.log(`🌐 Server running on http://localhost:${PORT}`);
    console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log('='.repeat(60));
});

module.exports = app;
