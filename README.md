# Quick Origins POC

###
This is just a very quick attempt at getting some starting resources together to try a few things for the hackathon. Think of it as a playground, not a source of truth. Everything in here is subject to being broken at anytime. 

## Setup -- do not skip.

You need to populate this file with your own OpenAI key and OpenWallet project.

`services/frontend/appSettings.json`

Both take less than two minutes to sign up for, OpenAI is 10 dollar minimum (set a spend limit), and walletconnect is free.

https://openai.com/api/ 
 
https://cloud.walletconnect.com/sign-up  


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
- 📊 **Portfolio Analysis**: Quick and dirty portfolio tracking and valuations, with prices from CoinGecko API
- 🤖 **AI Assistant**: Humble OpenAI GPT-powered insights
- 📈 **Returns Analytics**: Historical performance and risk metrics
- 🎨 **Charts & Simple UI**: Nothing too fancy.

## Architecture

- **Backend**: FastAPI with SQLite database for OHLCV data
- **Frontend**: React/TypeScript with Vite
- **AI Integration**: OpenAI GPT with Langchain for portfolio analysis
- **Blockchain**: Hedera Network via SDK and agent toolkit 
