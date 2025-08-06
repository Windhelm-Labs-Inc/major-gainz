"""Basic unit tests for the RAG helper."""
import sys, pathlib
BASE_DIR = pathlib.Path(__file__).resolve().parents[1] / "agent_support"
sys.path.append(str(BASE_DIR))
from hedera_rag_server.rag_index import query_knowledge


def test_query_knowledge_returns_string() -> None:
    """query_knowledge should return a non-empty string."""
    answer = query_knowledge("What is Hedera Hashgraph?")
    assert isinstance(answer, str)
    assert answer.strip(), "The answer should not be empty"


def test_query_knowledge_contains_expected_keyword() -> None:
    """A simple semantic query should retrieve an expected fact snippet."""
    answer = query_knowledge("What is the native cryptocurrency of Hedera?")
    # We expect the response to mention HBAR in some form
    assert "HBAR" in answer.upper()
