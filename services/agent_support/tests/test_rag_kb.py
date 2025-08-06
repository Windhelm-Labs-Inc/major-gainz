"""Integration tests that verify documents under knowledge_base are searchable."""
import pathlib, sys
import pytest

# Ensure local source import
BASE_DIR = pathlib.Path(__file__).resolve().parents[1] / "agent_support"
sys.path.append(str(BASE_DIR))

from hedera_rag_server import rag_index  # type: ignore

# Skip entire module if LlamaIndex stack is not available
if not getattr(rag_index, "_LLAMA_AVAILABLE", False):  # pragma: no cover
    pytest.skip("LlamaIndex not installed – skipping KB tests", allow_module_level=True)

from hedera_rag_server import build_index  # import AFTER the availability check


@pytest.fixture(scope="module", autouse=True)
def _ensure_index_tmp(tmp_path_factory):  # type: ignore
    """(Re)build the persistent vector index before running KB tests."""
    # Use tmp dir to avoid clobbering developer data
    tmp_dir = tmp_path_factory.mktemp("index_test")

    # Override env var so build_index & rag_index use tmp dir
    import os, importlib
    os.environ["INDEX_DIR"] = str(tmp_dir)

    # Build fresh index
    build_index.main()

    # Reload rag_index so it picks up the freshly built index
    importlib.reload(rag_index)  # type: ignore


def test_query_tinybars():
    """A term present only in KB docs (not in FACTS) should be retrievable."""
    answer = rag_index.query_knowledge("What are tinybars on Hedera?")
    assert "tinybar" in answer.lower()
