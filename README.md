# Quick Origins POC

This repository contains a proof-of-concept for an AI-powered portfolio intelligence tool for the Hedera Network. It combines wallet connectivity, portfolio analysis, and an AI assistant to provide users with insights into their token holdings.

## Setup

1.  **OpenAI API Key**: Sign up at [https://openai.com/api/](https://openai.com/api/) and get an API key.
2.  **WalletConnect Project ID**: Create a free project at [https://cloud.walletconnect.com/](https://cloud.walletconnect.com/) to get a Project ID.
3.  **Configuration**: Populate `services/frontend/appSettings.json` with your OpenAI key and WalletConnect Project ID.

## Running the Project

### Using Docker (Recommended)

Platform-specific helper scripts are provided to build and run the entire application stack in Docker:

-   `docker-build-and-run.sh` (Linux/macOS)
-   `docker-build-and-run.ps1` (Windows PowerShell)
-   `docker-build-and-run.bat` (Windows Command Prompt)

### Using Local Development Environment

To run the backend and frontend services locally:

```bash
make dev
```

This command will:
- Install all dependencies for both the frontend and backend.
- Start the Python FastAPI backend server on port 8000.
- Start the React/TypeScript frontend development server on port 3000.

## Core Features

-   🔗 **Multi-Wallet Connectivity**: Connect with MetaMask and HashPack wallets to fetch your Hedera portfolio.
-   📊 **Interactive Portfolio Dashboard**: View your token holdings in an interactive pie chart and table. Click on any token to dive deeper into its holder analytics.
-   📈 **In-Depth Token Holder Analysis**: For any selected token, a detailed analysis panel slides into view, showing:
    -   Your percentile ranking among all holders (e.g., "Whale 🐋" or "Small Holder 🦐").
    -   An interactive cumulative distribution chart visualizing holder thresholds.
    -   A list of the top 10 holders for that token.
-   🤖 **AI-Powered Financial Assistant**: Engage with an advanced AI assistant built with Langchain and GPT-4o. The assistant has access to your portfolio, real-time returns data, and token holder analysis.
-   🧠 **Intelligent AI Scratchpad**: The assistant now uses an intelligent "scratchpad" to maintain context. It tracks your selected token, portfolio summary, and holder analysis data, and only injects this context into the conversation when it has changed, making interactions more efficient and relevant.

## Recent Updates

-   **Agent Persistence**: The Langchain agent is now persistent and no longer resets on every UI update, preserving conversation history and improving performance.
-   **Bug Fixes**: Resolved a "Maximum update depth exceeded" error in React caused by an infinite re-render loop in the UI components.
-   **UI/UX Enhancements**: Improved layout centering, added hover effects, and ensured a smoother user experience when interacting with the portfolio and analysis panel.

## Architecture

-   **Backend**: Python FastAPI server providing RESTful APIs for portfolio data, OHLCV prices, and token holder statistics. Data is stored in a local SQLite database.
-   **Frontend**: A responsive web application built with React, TypeScript, and Vite. It uses `react-chartjs-2` for data visualization.
-   **AI Integration**: Leverages the `hedera-agent-kit` and Langchain to create a tool-calling AI agent powered by OpenAI's GPT models.
-   **Blockchain**: Connects to the Hedera Network using the Hedera SDK.
-   **Containerization**: Docker and Docker Compose are configured for easy setup and deployment.
