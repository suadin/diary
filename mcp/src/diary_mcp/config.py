"""Configuration for the Diary MCP server.

Everything machine-specific comes from the environment. The server carries no
default URL other than the loopback address from the README, no token, and no
path that belongs to one installation.
"""

import os
from pathlib import Path


def read_token(value_name: str, file_name: str) -> str:
    """Return a token from an environment value, else from the file it names.

    The value form wins, because an assistant can hand the token over when it
    starts the server. The file form keeps the token out of process listings
    and shell history.
    """
    value = os.getenv(value_name)
    if value:
        return value.strip()
    path_value = os.getenv(file_name)
    if path_value:
        path = Path(path_value).expanduser()
        if not path.exists():
            raise ValueError(f"{file_name} points at {path}, which does not exist.")
        token = path.read_text(encoding="utf-8").strip()
        if not token:
            raise ValueError(f"{path} is empty.")
        return token
    raise ValueError(f"Set {value_name} or {file_name}.")


class Config:
    """Connection details for one Diary instance."""

    def __init__(self) -> None:
        self.api_url = os.getenv("DIARY_API_URL", "http://127.0.0.1:8125").rstrip("/")
        self.read_token = read_token("DIARY_AI_READ_TOKEN", "DIARY_AI_READ_TOKEN_FILE")
        self.write_token = read_token("DIARY_AI_WRITE_TOKEN", "DIARY_AI_WRITE_TOKEN_FILE")


config: Config | None = None


def get_config() -> Config:
    """Get or create the global config instance."""
    global config
    if config is None:
        config = Config()
    return config
