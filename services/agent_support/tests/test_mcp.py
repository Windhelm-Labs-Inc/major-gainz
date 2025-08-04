"""Basic unit tests for the FastMCP server tools."""
import sys, pathlib, types

# Ensure local source is importable
BASE_DIR = pathlib.Path(__file__).resolve().parents[1] / "agent_support"
sys.path.append(str(BASE_DIR))

# Provide a minimal stub for the optional FastMCP dependency so we can import the server module without
# installing the real package (which pulls in compiled extensions).
fastmcp_stub = types.ModuleType("fastmcp")
class _DummyFastMCP:
    def __init__(self, *_, **__):
        pass
    def tool(self, *_args, **_kwargs):
        def decorator(func):
            return func
        return decorator
    def run(self, *_, **__):
        raise RuntimeError("FastMCP server run() not available in test stub")
fastmcp_stub.FastMCP = _DummyFastMCP
sys.modules["fastmcp"] = fastmcp_stub

from hedera_rag_server.server import hello


def test_hello_default() -> None:
    """Calling hello() without arguments should greet the world."""
    assert hello() == "Hello, World! \U0001F44B"


def test_hello_custom() -> None:
    """hello(name) should include the provided name in the greeting."""
    custom_name = "Alice"
    assert custom_name in hello(custom_name)
