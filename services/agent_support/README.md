# Hedera RAG Server

Light-weight Retrieval-Augmented Generation (RAG) micro-service for the Hedera ecosystem.  
It exposes a minimal Model-Context-Protocol (MCP) server with a built-in knowledge base and a simple `hello` tool.  

Main building blocks:

* **FastMCP** – framework for serving MCP tools
* **Llama-Index** – in-memory vector store & semantic search
* **Sentence-Transformers** – embedding model (MiniLM) – CPU-only build

## Development workflow

```bash
# create / update virtual-env
make install

# run tests
make test

# start the server (localhost:9090 by default)
make run
```

Configuration such as host, port, model name and similarity-search parameters live in `agent_support/hedera_rag_server/config.py` and can be overridden via environment variables.
