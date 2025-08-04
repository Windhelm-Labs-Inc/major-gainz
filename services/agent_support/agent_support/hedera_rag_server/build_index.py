"""Utility to build and persist the Hedera knowledge vector index.

This script walks the *knowledge_base* directory (recursively) and ingests
all files supported by LlamaIndex's `SimpleDirectoryReader`. In addition, it
incorporates the static *FACTS* list defined in *rag_index.py* so that both
structured snippets and unstructured documents are available for semantic
search.

Run with:
    poetry run python -m agent_support.hedera_rag_server.build_index
or via the Makefile helper:
    make index-build
"""
from __future__ import annotations

from pathlib import Path
from typing import List

import logging

from hedera_rag_server.config import INDEX_DIR
from hedera_rag_server.rag_index import (
    _LLAMA_AVAILABLE,
    FACTS,
    EMBED_MODEL_NAME,
)

logger = logging.getLogger(__name__)

if not _LLAMA_AVAILABLE:  # pragma: no cover – executed during manual invocation
    raise SystemExit(
        "LlamaIndex unavailable – cannot build persistent index.\n"
        "Install the full dependency set or use `make install-all`."
    )

from llama_index.core import ServiceContext, VectorStoreIndex, SimpleDirectoryReader  # type: ignore
from llama_index.core.schema import Document  # type: ignore

try:
    from llama_index.embeddings.huggingface import HuggingFaceEmbedding  # old path
except ImportError:
    from llama_index.embeddings.huggingface import HuggingFaceEmbedding  # type: ignore

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

PROJECT_ROOT = Path(__file__).resolve().parents[2]
KNOWLEDGE_BASE_DIR = PROJECT_ROOT / "knowledge_base"


def _load_knowledge_documents() -> List[Document]:  # type: ignore[name-defined]
    """Return all documents found under *knowledge_base* (recursively)."""
    if not KNOWLEDGE_BASE_DIR.exists():
        logger.warning("knowledge_base directory not found – only FACTS will be indexed.")
        return []

    reader = SimpleDirectoryReader(input_dir=str(KNOWLEDGE_BASE_DIR), recursive=True)
    return reader.load_data()  # type: ignore[return-value]


def main() -> None:
    """Build the vector index and persist it to the configured directory."""
    logger.info("Building vector index …")
    embed = HuggingFaceEmbedding(model_name=EMBED_MODEL_NAME)
    service_ctx = ServiceContext.from_defaults(embed_model=embed, llm=None)

    kb_docs = _load_knowledge_documents()
    fact_docs = [Document(text=text) for text in FACTS]  # type: ignore[arg-type]

    docs: List[Document] = fact_docs + kb_docs
    if not docs:
        raise SystemExit("No documents found for indexing.")

    index = VectorStoreIndex.from_documents(docs, service_context=service_ctx)

    persist_path = Path(INDEX_DIR)
    persist_path.mkdir(parents=True, exist_ok=True)
    index.storage_context.persist(str(persist_path))

    logger.info("Persisted index containing %s docs to %s", len(docs), persist_path.resolve())


if __name__ == "__main__":  # pragma: no cover
    main()
