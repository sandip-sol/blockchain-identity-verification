# Production Deployment Guide

## Prerequisites

- Node.js ≥ 18
- MongoDB (replica set recommended for availability)
- An Ethereum RPC endpoint (Infura, Alchemy, etc.)
- A funded deployer wallet
- (Optional) Redis for rate-limiter store
- (Optional) Pinata API key for IPFS pinning

---

## 1. Environment Variables

Copy `.env.example` to `.env` and fill in **all** values.

| Variable | Required | Notes |
|---|---|---|
| `PRIVATE_KEY` | ✅ | Deployer wallet private key (never commit) |
| `HOODI_DEPLOY_RPC` | ✅ | RPC URL for target network |
| `JWT_SECRET` | ✅ | 48+ char random string, shared with frontend |
| `MASTER_ENCRYPTION_KEY` | ✅ | 64-char hex (`openssl rand -hex 32`) |
| `MONGODB_URI` | ✅ | Connection string with auth |
| `ALLOWED_ORIGINS` | ✅ | Comma-separated frontend URLs |
| `REDIS_URL` | ⬜ | Enables Redis rate-limiter store |
| `PINATA_API_KEY` / `PINATA_SECRET_KEY` | ⬜ | Production IPFS pinning |

Generate strong secrets:
```bash
# JWT Secret
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"

# Encryption Key
openssl rand -hex 32
```

---

## 2. Smart Contract Deployment

```bash
# Compile
npx hardhat compile

# Run tests
npx hardhat test

# Deploy to testnet
npx hardhat run scripts/deploy.js --network hoodi

# Deploy to mainnet (when ready)
npx hardhat run scripts/deploy.js --network polygon
```

After deployment, update `IDENTITY_TOKEN_ADDRESS`, `TRANSACTION_REGISTRY_ADDRESS`, and `ACCESS_CONTROL_ADDRESS` in `.env`.

---

## 3. Backend Deployment

```bash
cd backend
npm ci --production
NODE_ENV=production node src/server.js
```

For process management, use PM2:
```bash
npm install -g pm2
pm2 start src/server.js --name kyc-api -i max
pm2 save && pm2 startup
```

---

## 4. Frontend Deployment

```bash
cd frontend
npm ci
npm run build
npm start   # or deploy .next/ to Vercel / a Node host
```

---

## 5. HTTPS with Nginx Reverse Proxy

Install Nginx and Certbot:
```bash
sudo apt install nginx certbot python3-certbot-nginx
```

Nginx config (`/etc/nginx/sites-available/kyc-api`):
```nginx
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable HTTPS:
```bash
sudo ln -s /etc/nginx/sites-available/kyc-api /etc/nginx/sites-enabled/
sudo certbot --nginx -d api.yourdomain.com
sudo systemctl reload nginx
```

---

## 6. MongoDB Production Config

- Enable authentication (`--auth` flag or config file)
- Use a replica set for high availability
- Enable TLS for connections
- Set up automated backups (mongodump or cloud snapshots)

---

## 7. Health Checks

| Endpoint | Purpose |
|---|---|
| `GET /health` | Liveness — is the server running? |
| `GET /ready` | Readiness — is the DB connected? |

Configure your load balancer / container orchestrator to poll these.
