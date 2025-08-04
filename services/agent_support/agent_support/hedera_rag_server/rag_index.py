"""RAG (Retrieval-Augmented Generation) helper based on LlamaIndex.

The module keeps a tiny in-memory vector index containing factual
statements about the Hedera network and a selection of HTS tokens.
Clients of the MCP server can query this index via the ``ask`` tool.

The implementation purposefully stays _very_ small so that it works
out-of-the-box inside a light-weight service container while still
show-casing a realistic RAG workflow.
"""
from __future__ import annotations

from typing import List

from typing import Any, List

import logging
logger = logging.getLogger(__name__)

try:
    from llama_index.core import VectorStoreIndex, ServiceContext, Document  # type: ignore
    try:
        from llama_index.embeddings.base import BaseEmbedding  # old path (<0.10.65)
    except ImportError:
        from llama_index.core.base.embeddings.base import BaseEmbedding  # type: ignore  # new path

    try:
        from llama_index.embeddings.huggingface import HuggingFaceEmbedding  # old extra package
    except ImportError:
        from llama_index.embeddings.huggingface import HuggingFaceEmbedding  # type: ignore
    _LLAMA_AVAILABLE = True
except ImportError:  # pragma: no cover – optional dependency missing
    _LLAMA_AVAILABLE = False
    VectorStoreIndex = ServiceContext = Document = BaseEmbedding = Any  # type: ignore


from hedera_rag_server.config import EMBED_MODEL_NAME, SIMILARITY_TOP_K, INDEX_DIR

# ---------------------------------------------------------------------------
# Knowledge base
# ---------------------------------------------------------------------------

FACTS: List[str] = [
    # Hedera network
    "Hedera Hashgraph is a public distributed ledger that utilises the Hashgraph consensus algorithm, offering high throughput, low latency and predictable low fees.",
    "HBAR (token id 0.0.0) is the native cryptocurrency of Hedera Hashgraph. It is used to pay network fees and to secure the network through staking.",
    "Hedera Token Service (HTS) enables the creation of both fungible and non-fungible tokens directly on the Hedera mainnet.",

    # Prominent ecosystem tokens
    "SAUCE (token id 0.0.731861) is the governance and rewards token for SaucerSwap, the flagship decentralised exchange on Hedera.",
    "USDC (token id 0.0.456858) is Circle's U.S. dollar-backed stablecoin natively issued on Hedera. USDC[hts] (token id 0.0.1055459) represents the HTS-wrapped variant.",
    "JAM (token id 0.0.127877) is the utility token for Tune.FM, a music-streaming platform that rewards artists and listeners for engagement.",
    "CLXY (token id 0.0.859814) powers the Calaxy social token marketplace built on Hedera.",
    "HBARX (token id 0.0.834116) is Stader Labs' liquid staking token giving holders a yield-bearing wrapped version of staked HBAR.",
    "HST (token id 0.0.968069) is the governance token for HederaSubnet Technologies.",
    "USDT[hts] (token id 0.0.1055472) is Tether's U.S. dollar-pegged stablecoin bridged onto Hedera via HTS.",
    "DAI[hts] (token id 0.0.1055477) is MakerDAO's decentralised USD-pegged stablecoin available on Hedera through HTS wrapping.",
    "LINK[hts] (token id 0.0.1055495) represents Chainlink's LINK token on the Hedera network.",
    "WBTC[hts] (token id 0.0.1055483) is the wrapped bitcoin representation on Hedera.",
    "WETH[hts] (token id 0.0.541564) is the wrapped ether representation on Hedera.",
    "WHBAR (token id 0.0.1456986) is the wrapped, ERC-20-style representation of HBAR used in DeFi applications.",
    "xSAUCE (token id 0.0.1460200) is the yield-bearing staking derivative of SAUCE.",
    "GRELF (token id 0.0.1159074) is the utility token for Grelf ecosystem products on Hedera.",
    "WBNB[hts] (token id 0.0.1157005) is wrapped Binance Coin on Hedera.",
    "QNT[hts] (token id 0.0.1304757) is Quant Network's token bridged to Hedera via HTS.",
    "WAVAX[hts] (token id 0.0.1157020) is wrapped Avalanche's AVAX token on Hedera.",
    "KARATE (token id 0.0.2283230) underpins Karate Combat's fight sports fan-engagement platform on Hedera.",
    "DOVU (token id 0.0.3716059) is the carbon off-set marketplace token operating on Hedera.",
    "CARAT (token id 0.0.1958126) is used within the CARAT metaverse project built on Hedera.",
    "DAVINCI (token id 0.0.3706639) fuels the DAVINCI gallery and NFT platform on Hedera.",
    "STEAM (token id 0.0.3210123) is a gaming-focused token in the Hedera ecosystem.",
    "PACK (token id 0.0.4794920) enables gameplay economics for HashPack related features.",
    "HCHF (token id 0.0.6070123) is a Swiss-franc-pegged stablecoin available on Hedera.",
    "HLQT (token id 0.0.6070128) is a liquidity-related token in the Hedera DeFi space.",
    "XPACK (token id 0.0.7243470) is the staking derivative of PACK.",
    "BONZO (token id 0.0.8279134) is a community-driven meme token on Hedera; xBONZO (token id 0.0.8490541) is its staked derivative.",
]

# ---------------------------------------------------------------------------
# Build the vector index once at import time
# ---------------------------------------------------------------------------


# Attempt to construct a real embedding model if LlamaIndex is available.
if _LLAMA_AVAILABLE:
    try:
        _embed_model = HuggingFaceEmbedding(model_name=EMBED_MODEL_NAME)  # type: ignore[name-defined]
    except Exception:  # pragma: no cover – any failure (e.g. SciPy/BLAS) triggers fallback

        class _SimpleEmbedding(BaseEmbedding):  # type: ignore[misc]
            """Tiny fallback embedding that encodes by string length."""

            def _get_text_embedding(self, text: str) -> list[float]:  # type: ignore[override]
                return [float(len(text))]

            def _get_query_embedding(self, query: str) -> list[float]:  # type: ignore[override]
                return [float(len(query))]

        _embed_model = _SimpleEmbedding()
else:
    _embed_model = None  # type: ignore[assignment]

if _LLAMA_AVAILABLE:
    import os
    from pathlib import Path
    from llama_index.core import StorageContext, load_index_from_storage  # type: ignore

    _service_ctx = ServiceContext.from_defaults(embed_model=_embed_model, llm=None)  # type: ignore[name-defined]

    _persist_path = Path(INDEX_DIR)
    if _persist_path.exists() and any(_persist_path.iterdir()):
        # Load pre-built index to avoid costly regeneration
        _storage_ctx = StorageContext.from_defaults(persist_dir=str(_persist_path))
        _INDEX = load_index_from_storage(_storage_ctx, service_context=_service_ctx)
    else:
        # Build new index and persist it for future startups
        from pathlib import Path
        from llama_index.core import SimpleDirectoryReader  # type: ignore

        # Load knowledge_base docs (if present) and static FACTS
        project_root = Path(__file__).resolve().parents[2]
        kb_dir = project_root / "knowledge_base"
        docs = [Document(text=f) for f in FACTS]  # type: ignore[name-defined]
        if kb_dir.exists():
            kb_docs = SimpleDirectoryReader(input_dir=str(kb_dir), recursive=True).load_data()  # type: ignore
            docs.extend(kb_docs)
        _INDEX = VectorStoreIndex.from_documents(docs, service_context=_service_ctx)  # type: ignore[name-defined]
        _INDEX.storage_context.persist(str(_persist_path))

    _QUERY_ENGINE = _INDEX.as_query_engine(similarity_top_k=SIMILARITY_TOP_K)  # type: ignore[name-defined]

# ---------------------------------------------------------------------------
# Public helper
# ---------------------------------------------------------------------------

def query_knowledge(question: str) -> str:
    """Run a semantic search over the Hedera knowledge base and return an answer.

    The function delegates retrieval and synthesis to LlamaIndex. Because we do
    not attach an LLM, the response will be a simple concatenation of the most
    relevant factual snippets. This keeps the service lightweight while still
    demonstrating the RAG flow.
    """
    logger.debug("query_knowledge invoked question=%s", question)
    if _LLAMA_AVAILABLE:
        response = _QUERY_ENGINE.query(question)  # type: ignore[name-defined]
        logger.debug("LLAMA available – returning engine response length=%s", len(str(response)))
        return str(response)

    # Fallback: naive keyword match over FACTS
    lower_q = question.lower()
    matches = [fact for fact in FACTS if any(word in fact.lower() for word in lower_q.split())]
    if not matches:
        logger.debug("No matches found in fallback path")
        return "I'm not sure."
    # Return up to top 3 matches concatenated
    answer = " ".join(matches[:3])
    logger.debug("Fallback answer length=%s", len(answer))
    return answer
