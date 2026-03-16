const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const logger = require('./services/logger');

// ── Production startup validation ──────────────────────────────────
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const REQUIRED_ENV_VARS = ['JWT_SECRET', 'MASTER_ENCRYPTION_KEY', 'MONGODB_URI', 'ALLOWED_ORIGINS'];

if (IS_PRODUCTION) {
    const missing = REQUIRED_ENV_VARS.filter(v => !process.env[v]);
    if (missing.length > 0) {
        logger.error(`FATAL: Missing required environment variables: ${missing.join(', ')}`);
        process.exit(1);
    }
}

const kycRoutes = require('./routes/kycRoutes');
const transactionRoutes = require('./routes/transactionRoutes');
const accessRoutes = require('./routes/accessRoutes');
const envelopeRoutes = require('./routes/envelopeRoutes');
const activityRoutes = require('./routes/activityRoutes');
const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const web3Service = require('./services/web3Service');
const ipfsService = require('./services/ipfsService');

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet());
app.use(compression());

// CORS configuration
const corsOptions = {
    origin: IS_PRODUCTION
        ? (process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'])
        : true, // Allow all origins in development
    credentials: true
};
app.use(cors(corsOptions));

// ── Rate Limiting (Redis store in production, in-memory for dev) ───
let rateLimitStore;
if (IS_PRODUCTION && process.env.REDIS_URL) {
    try {
        const RedisStore = require('rate-limit-redis').default;
        const Redis = require('ioredis');
        const redisClient = new Redis(process.env.REDIS_URL);
        rateLimitStore = new RedisStore({ sendCommand: (...args) => redisClient.call(...args) });
        logger.info('Rate limiter using Redis store');
    } catch (err) {
        logger.warn('Redis rate-limit store failed, falling back to in-memory', { error: err.message });
    }
}

const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
    ...(rateLimitStore ? { store: rateLimitStore } : {})
});
app.use('/api/', limiter);

// Stricter rate limiting for auth endpoints (brute-force protection)
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: { error: 'Too many authentication attempts. Please try again later.' },
    ...(rateLimitStore ? { store: rateLimitStore } : {})
});
app.use('/api/auth/', authLimiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// HTTP request logging via morgan -> winston
const morganFormat = IS_PRODUCTION ? 'combined' : 'dev';
app.use(morgan(morganFormat, {
    stream: { write: (msg) => logger.info(msg.trim(), { type: 'http' }) }
}));

// Database connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/kyc-kyb-platform')
    .then(async () => {
        logger.info('MongoDB connected');

        // Migration: drop old unique index on 'address' field if it exists
        try {
            await mongoose.connection.collection('accounts').dropIndex('address_1');
            logger.info('Dropped old address_1 unique index');
        } catch (e) {
            if (!e.message.includes('index not found')) {
                logger.warn('Index migration note', { message: e.message });
            }
        }
    })
    .catch(err => logger.error('MongoDB connection error', { error: err.message }));

// Initialize services
const initializeServices = async () => {
    try {
        await web3Service.initialize();
        await ipfsService.initialize();

        if (web3Service.isInitialized) {
            web3Service.listenToEvents();
        }

        logger.info('All services initialized');
    } catch (error) {
        logger.warn('Service initialization warning — some features may not be available', { error: error.message });
    }
};

initializeServices();

// API Routes
app.use('/api/kyc', kycRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/transaction', transactionRoutes);
app.use('/api/access', accessRoutes);
app.use('/api/envelopes', envelopeRoutes);
app.use('/api/activity', activityRoutes);

// Health check endpoint (liveness)
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

// Readiness probe (all critical services must be up)
app.get('/ready', (req, res) => {
    const dbReady = mongoose.connection.readyState === 1;
    if (dbReady) {
        return res.status(200).json({ status: 'ready' });
    }
    res.status(503).json({ status: 'not ready', reason: 'database not connected' });
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
            health: '/health',
            ready: '/ready'
        }
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

// Error handling middleware
app.use((err, req, res, next) => {
    logger.error('Unhandled error', { error: err.message, stack: err.stack, path: req.path });

    res.status(err.status || 500).json({
        error: IS_PRODUCTION ? 'Internal server error' : err.message,
        ...(IS_PRODUCTION ? {} : { stack: err.stack })
    });
});

// Start server
const server = app.listen(PORT, () => {
    logger.info('KYC/KYB Backend Server started', {
        port: PORT,
        env: process.env.NODE_ENV || 'development',
        url: `http://localhost:${PORT}`
    });
});

// ── Graceful Shutdown ──────────────────────────────────────────────
const gracefulShutdown = async (signal) => {
    logger.info(`${signal} received — shutting down gracefully`);

    server.close(async () => {
        logger.info('HTTP server closed');

        try {
            await mongoose.connection.close();
            logger.info('MongoDB connection closed');
        } catch (err) {
            logger.error('Error closing MongoDB', { error: err.message });
        }

        process.exit(0);
    });

    // Force shutdown after 10 seconds
    setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
    }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

module.exports = app;
