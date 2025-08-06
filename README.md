# Quick Origins POC

> **⚠️ PROOF OF CONCEPT - For Demo and Dev only**  
> This is a proof-of-concept application for demonstration and development purposes only. Do not use in production environments.

> **📍 UPCOMING CHANGES**  
> We have tickets planned to migrate the backend pricing database from CoinGecko to SaucerSwap for improved Hedera-native pricing data.

This repository contains a proof-of-concept for an AI-powered portfolio intelligence tool for the Hedera Network. It combines wallet connectivity, portfolio analysis, DeFi position tracking, and an AI assistant to provide users with comprehensive insights into their token holdings and DeFi activities.

## Quick Start

### Prerequisites

1. **OpenAI API Key**: Sign up at [https://openai.com/api/](https://openai.com/api/) and get an API key
2. **WalletConnect Project ID**: Create a free project at [https://cloud.walletconnect.com/](https://cloud.walletconnect.com/)
3. **SaucerSwap API Key**: Get from [https://docs.saucerswap.finance/](https://docs.saucerswap.finance/) for enhanced DeFi data

### Environment Setup

1. Copy the environment template:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` with your API keys:
   ```bash
   # Required API keys
   OPENAI_API_KEY=your-openai-api-key
   SAUCER_SWAP_API_KEY=your-saucerswap-api-key
   VITE_WALLETCONNECT_PROJECT_ID=your-walletconnect-project-id
   
   # Network configuration (mainnet is default)
   HEDERA_NETWORK=mainnet
   VITE_HEDERA_NETWORK=mainnet
   ```

### Running the Application

#### Option 1: Local Development (Recommended)
```bash
make dev
```

#### Option 2: Secure Build (No Source Exposure)
```bash
make dev-secure
```

#### Option 3: Docker
```bash
# Docker Compose
make docker-compose-dev
```

## Temporarily removed (can be restored on demand)

* ~~docker-build-and-run.sh~~   – Linux / macOS  
* ~~docker-build-and-run.ps1~~  – Windows PowerShell  
* ~~docker-build-and-run.bat~~  – Windows Command Prompt


The application will be available at:
- **Frontend**: http://localhost:3000
- **Backend**: http://localhost:8000

## Core Features

### Portfolio Management
- 🔗 **Wallet Connectivity**: Connect HashPack wallet
- 📊 **Interactive Portfolio Dashboard**: Real-time token holdings with interactive charts and tables (Temporarily disabled until we move pricing to saucer)
- 🌐 **Network Support**: Toggle between Hedera mainnet and testnet

### Advanced Analytics
- 📈 **Token Holder Analysis**: Detailed holder distribution analytics with percentile rankings
- 📋 **DeFi Position Tracking**: View your positions across DeFi platforms (Bonzo, SaucerSwap)
- 🔍 **Interactive JSON Explorer**: Temporary DeFi validation panel for debugging DeFi integrations

### AI-Powered Insights
- 🤖 **Intelligent Financial Assistant**: GPT-4o powered assistant with portfolio context
- 🧠 **Smart Context Management**: Maintains conversation context with portfolio and holder data
- 🔒 **Secure Backend Proxy**: All AI API calls routed through backend for security

### Security & Development
- 🔐 **Centralized Environment Management**: Ready for Cloud Secrets Injection
- 🛡️ **Source Code Protection**: Secure build process prevents frontend source exposure
- 🐳 **Docker Integration**: Full containerization support with environment injection

## Recent Features & Updates

### Latest Additions
- **DeFi Integration Panel**: Interactive JSON explorer for DeFi position validation
- **Resizable UI Components**: DeFi validation panel with drag-to-resize functionality
- **Backend API Proxy**: Moved OpenAI API calls to backend for enhanced security
- **Cascading Configuration**: Single top-level `.env`, with option to provide service specific .env if debugging or otherwise.
- **Network Selection**: Easy switching between mainnet/testnet (defaults to mainnet)

### Security Improvements
- **Build Security**: Vite configured to prevent serving source code and sensitive files


### Development Experience
- **Process Management**: Improved `make dev` with proper Ctrl+C handling for both services
- **Docker Integration**: Environment variables properly injected into Docker containers
- **Debug Tooling**: Added debug output for environment variable loading and API key validation

## Known Issues

### Current Bugs
- **SaucerSwap API Authentication**: 401 Unauthorized errors when using placeholder API keys
  - **Solution**: Replace placeholder keys in `.env` with real SaucerSwap API credentials
- **TypeScript Compilation**: Minor type compatibility issues (mostly resolved)
- **Environment Sync**: Occasionally requires manual `make sync-env` after `.env` changes

### Limitations
- **Development Database**: Uses SQLite for local development (not production-ready)
- **API Rate Limits**: No rate limiting implemented for external API calls
- **Error Handling**: Some edge cases in DeFi data fetching need improvement

## Architecture

### Backend Services
- **FastAPI Server**: RESTful APIs for portfolio, DeFi, and chat functionality
- **SQLite Database**: Local storage for token holdings and analytics
- **External Integrations**: CoinGecko (pricing), SaucerSwap (DeFi), Hedera Mirror Node
- **AI Proxy**: Secure backend proxy for OpenAI chat completions

### Frontend Application
- **React + TypeScript**: Modern web application with Vite build system
- **Chart.js Integration**: Interactive data visualizations
- **Wallet Integration**: MetaMask and HashPack support via WalletConnect
- **Responsive Design**: Mobile-friendly interface with resizable components

### AI & Intelligence
- **Langchain Integration**: Advanced AI agent with tool-calling capabilities
- **Context Management**: Smart scratchpad system for maintaining conversation context
- **Portfolio Awareness**: AI has access to real-time portfolio and holder data

### DevOps & Deployment
- **Docker Containerization**: Full application stack containerization
- **Environment Management**: Centralized configuration with service-specific injection
- **Development Tooling**: Makefile automation for common development tasks

## Development

### Project Structure
```
quick-origins-poc/
├── services/
│   ├── backend/          # FastAPI backend service
│   ├── frontend/         # React frontend application
│   └── agent_support/    # AI agent support services
├── .env                  # Centralized environment configuration
├── Makefile             # Development automation
└── docker-compose.yml   # Container orchestration
```

### Environment Variables
See [ENVIRONMENT_CENTRALIZED.md](ENVIRONMENT_CENTRALIZED.md) for detailed environment setup documentation.

### Contributing
1. Ensure all API keys are properly configured in `.env`
2. Run `make dev` for local development
3. Use `make sync-env` if environment sync issues occur
4. Test both mainnet and testnet configurations before committing

---

For detailed setup instructions and troubleshooting, see the [centralized environment documentation](ENVIRONMENT_CENTRALIZED.md).
