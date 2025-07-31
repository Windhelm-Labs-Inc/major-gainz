# Centralized Environment Configuration

## Overview

The Origins project now uses a **centralized environment configuration** with a single top-level `.env` file that automatically syncs to all services.

## Quick Start

1. **Copy the template**:
   ```bash
   cp .env.example .env
   ```

2. **Edit your configuration**:
   ```bash
   nano .env  # Add your OpenAI API key and other settings
   ```

3. **Run development**:
   ```bash
   make dev          # Automatically syncs .env to services
   make dev-secure   # Secure bundled frontend + synced .env
   make docker-dev   # Docker development with synced .env
   ```

## File Structure

```
quick-origins-poc/
├── .env              # 🎯 MAIN CONFIG - Edit this file only
├── .env.example      # Template for .env
├── services/
│   ├── backend/
│   │   └── .env      # 🤖 Auto-generated from top-level .env
│   └── frontend/
│       └── .env.local # 🤖 Auto-generated from top-level .env
└── docker-compose.yml # Uses top-level .env
```

## Environment Variables

### Backend Variables (Auto-synced)
- `OPENAI_API_KEY` - Required for chat functionality
- `DATABASE_URL` - Database connection string
- `SAUCER_SWAP_API_KEY` - Optional DeFi platform API key
- `HEDERA_NETWORK` - Network selection (mainnet/testnet)
- `DEFI_TEST_MODE` - Testing configuration
- `UVICORN_HOST` - API server host
- `UVICORN_LOG_LEVEL` - Logging level
- `CORS_ORIGINS` - CORS allowed origins

### Frontend Variables (Auto-synced)
- `VITE_WALLETCONNECT_PROJECT_ID` - Public WalletConnect ID
- `VITE_HEDERA_NETWORK` - Network selection for frontend

### Docker/Deployment Variables
- `BACKEND_PORT` - Backend service port (default: 8000)
- `FRONTEND_PORT` - Frontend service port (default: 3000)

## Development Workflow

### 1. Local Development
```bash
# Edit the main configuration
nano .env

# Start development (auto-syncs environment)
make dev
```

### 2. Docker Development
```bash
# Edit the main configuration
nano .env

# Run with Docker (auto-syncs + builds)
make docker-compose-dev
```

### 3. Manual Environment Sync
```bash
# Manually sync .env to services (rarely needed)
make sync-env
```

## Environment Sync Behavior

When you run `make dev`, `make dev-secure`, `make docker-dev`, or `make docker-compose-dev`:

1. **Auto-sync**: Top-level `.env` automatically syncs to services
2. **Backend sync**: Relevant backend variables → `services/backend/.env`
3. **Frontend sync**: Relevant frontend variables → `services/frontend/.env.local`
4. **Warning headers**: Generated files include warnings not to edit manually

## Security Model

### ✅ Secure Variables (Backend Only)
- `OPENAI_API_KEY` - Never exposed to frontend
- `DATABASE_URL` - Server-side only
- `SAUCER_SWAP_API_KEY` - Backend API calls only

### ✅ Public Variables (Frontend Safe)
- `VITE_WALLETCONNECT_PROJECT_ID` - Public by design
- `VITE_HEDERA_NETWORK` - Network selection

### 🔐 Environment Priority
1. **Top-level .env** (highest priority)
2. **System environment variables** (override .env)
3. **Service defaults** (fallback)

## Production Deployment

### Environment Variables (Recommended)
```bash
# Set environment variables directly (no .env file)
export OPENAI_API_KEY="sk-proj-production-key"
export DATABASE_URL="postgresql://user:pass@host:port/origins_prod"
export HEDERA_NETWORK="mainnet"
export VITE_HEDERA_NETWORK="mainnet"
```

### Docker Production
```bash
# Use environment variables in docker-compose.production.yml
docker-compose -f docker-compose.production.yml up
```

## Migration from Service-Specific .env Files

If you have existing service-specific `.env` files:

1. **Backup existing files**:
   ```bash
   cp services/backend/.env services/backend/.env.backup
   cp services/frontend/.env.local services/frontend/.env.local.backup
   ```

2. **Merge into top-level .env**:
   ```bash
   # Copy values from service-specific files to top-level .env
   nano .env
   ```

3. **Test the new setup**:
   ```bash
   make sync-env  # Verify sync works
   make dev       # Test development
   ```

## Troubleshooting

### Common Issues

1. **"Top-level .env file not found"**
   ```bash
   cp .env.example .env
   nano .env  # Add your configuration
   ```

2. **Environment not syncing**
   ```bash
   make sync-env  # Manual sync
   ```

3. **Docker not picking up changes**
   ```bash
   docker-compose down
   make docker-compose-dev  # Rebuilds with new .env
   ```

### Debug Environment Loading
```bash
# Check what variables are loaded
make sync-env
cat services/backend/.env
cat services/frontend/.env.local
```

## Benefits

✅ **Single source of truth** - All configuration in one place  
✅ **Automatic synchronization** - No manual copying between services  
✅ **Docker integration** - Seamless container environment injection  
✅ **Security maintained** - Proper separation of backend/frontend variables  
✅ **Development friendly** - Easy switching between mainnet/testnet  
✅ **Production ready** - Environment variable override support