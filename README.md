# Quick Origins

AI-Powered Portfolio Intelligence for Hedera Network

## Setup

### Prerequisites

1. **OpenAI API Key**: Set your OpenAI API key as an environment variable:
   ```bash
   export OPENAI_API_KEY="your-openai-api-key-here"
   ```

2. **WalletConnect Project ID**: Set your WalletConnect project ID as an environment variable:
   ```bash
   export WALLETCONNECT_PROJECT_ID="your-walletconnect-project-id-here"
   ```

### Running the Project

Build and run all services:

```bash
make dev
```

This will start:
- Backend API server (Python FastAPI)
- Frontend application (React/TypeScript)
- All necessary dependencies

## Features

- 🔗 **Hedera Network Integration**: Connect MetaMask and HashPack wallets
- 📊 **Portfolio Analysis**: Real-time portfolio tracking and valuation
- 🤖 **AI Assistant**: GPT-powered financial analysis and insights
- 📈 **Returns Analytics**: Historical performance and risk metrics
- 🎨 **Modern UI**: Clean, professional interface optimized for demos

## Architecture

- **Backend**: FastAPI with SQLite database for OHLCV data
- **Frontend**: React/TypeScript with Vite
- **AI Integration**: OpenAI GPT with Langchain for portfolio analysis
- **Blockchain**: Hedera Network via SDK and agent toolkit 