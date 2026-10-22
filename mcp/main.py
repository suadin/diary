"""Entry point for the Diary MCP server.

Runs straight from a checkout without installation; a packaged install uses the
``diary-mcp`` console script instead.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / "src"))

from diary_mcp.server import main

if __name__ == "__main__":
    main()
