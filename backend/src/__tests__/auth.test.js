/**
 * Backend API Tests — Auth Routes
 *
 * These tests exercise the authentication endpoints using supertest
 * against the Express app (without a live MongoDB).
 * A real integration-test suite would use mongodb-memory-server.
 */

const request = require('supertest');

// Minimal in-memory stub for mongoose so we can load the express app
// without a real database. Full integration tests should use
// mongodb-memory-server instead.
jest.mock('mongoose', () => {
    const mConnection = {
        readyState: 1,
        close: jest.fn().mockResolvedValue(),
        collection: () => ({ dropIndex: jest.fn().mockRejectedValue(new Error('index not found')) })
    };
    return {
        connect: jest.fn().mockResolvedValue(),
        connection: mConnection,
        Schema: class Schema {
            constructor() { return {}; }
        },
        model: jest.fn().mockReturnValue(function MockModel() { }),
        Types: { ObjectId: { isValid: () => true } }
    };
});

// Stub heavy services so requiring server.js doesn't crash
jest.mock('../services/web3Service', () => ({
    initialize: jest.fn().mockResolvedValue(),
    isInitialized: false,
    listenToEvents: jest.fn()
}));

jest.mock('../services/ipfsService', () => ({
    initialize: jest.fn().mockResolvedValue(),
    isInitialized: false
}));

// Set required env vars
process.env.JWT_SECRET = 'test-jwt-secret-for-ci';
process.env.MASTER_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
process.env.MONGODB_URI = 'mongodb://localhost:27017/test';
process.env.ALLOWED_ORIGINS = 'http://localhost:3000';

describe('API Smoke Tests', () => {
    let app;

    beforeAll(() => {
        app = require('../server');
    });

    describe('Health & Root', () => {
        it('GET /health returns 200 with status', async () => {
            const res = await request(app).get('/health');
            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('status', 'healthy');
            expect(res.body).toHaveProperty('services');
            expect(res.body).toHaveProperty('timestamp');
        });

        it('GET /ready returns 200 when db is connected', async () => {
            const res = await request(app).get('/ready');
            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('status', 'ready');
        });

        it('GET / returns API info', async () => {
            const res = await request(app).get('/');
            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('name');
            expect(res.body).toHaveProperty('endpoints');
        });

        it('GET /nonexistent returns 404', async () => {
            const res = await request(app).get('/nonexistent');
            expect(res.status).toBe(404);
            expect(res.body).toHaveProperty('error');
        });
    });

    describe('Auth Routes — Input Validation', () => {
        it('POST /api/auth/register with empty body returns 400', async () => {
            const res = await request(app)
                .post('/api/auth/register')
                .send({});
            expect(res.status).toBe(400);
        });

        it('POST /api/auth/register with invalid email returns 400', async () => {
            const res = await request(app)
                .post('/api/auth/register')
                .send({ email: 'not-an-email', password: 'StrongP@ss1' });
            expect(res.status).toBe(400);
        });

        it('POST /api/auth/login with empty body returns 400', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({});
            expect(res.status).toBe(400);
        });
    });

    describe('Protected Routes — No Token', () => {
        it('GET /api/kyc/status/0x123 without auth returns 401', async () => {
            const res = await request(app).get('/api/kyc/status/0x123');
            expect(res.status).toBe(401);
        });
    });
});
