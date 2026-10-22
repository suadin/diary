import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from diary_mcp.config import Config, read_token


class TokenResolutionTests(unittest.TestCase):
    def test_value_wins_over_file(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "token"
            path.write_text("from-file\n", encoding="utf-8")
            environment = {
                "DIARY_AI_READ_TOKEN": "from-value",
                "DIARY_AI_READ_TOKEN_FILE": str(path),
            }
            with patch.dict(os.environ, environment, clear=False):
                self.assertEqual(
                    read_token("DIARY_AI_READ_TOKEN", "DIARY_AI_READ_TOKEN_FILE"), "from-value"
                )

    def test_file_is_stripped(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "token"
            path.write_text("  from-file\n", encoding="utf-8")
            with patch.dict(os.environ, {"DIARY_AI_READ_TOKEN_FILE": str(path)}, clear=False):
                with patch.dict(os.environ, {"DIARY_AI_READ_TOKEN": ""}, clear=False):
                    self.assertEqual(
                        read_token("DIARY_AI_READ_TOKEN", "DIARY_AI_READ_TOKEN_FILE"), "from-file"
                    )

    def test_missing_file_fails_loudly(self):
        environment = {"DIARY_AI_READ_TOKEN_FILE": "/nonexistent/token", "DIARY_AI_READ_TOKEN": ""}
        with patch.dict(os.environ, environment, clear=False):
            with self.assertRaises(ValueError):
                read_token("DIARY_AI_READ_TOKEN", "DIARY_AI_READ_TOKEN_FILE")

    def test_empty_file_fails_loudly(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "token"
            path.write_text("\n", encoding="utf-8")
            with patch.dict(os.environ, {"DIARY_AI_READ_TOKEN_FILE": str(path)}, clear=False):
                with patch.dict(os.environ, {"DIARY_AI_READ_TOKEN": ""}, clear=False):
                    with self.assertRaises(ValueError):
                        read_token("DIARY_AI_READ_TOKEN", "DIARY_AI_READ_TOKEN_FILE")


class ConfigTests(unittest.TestCase):
    def test_loopback_default_and_trailing_slash(self):
        environment = {
            "DIARY_AI_READ_TOKEN": "read",
            "DIARY_AI_WRITE_TOKEN": "write",
        }
        with patch.dict(os.environ, environment, clear=True):
            self.assertEqual(Config().api_url, "http://127.0.0.1:8125")
        overridden = {**environment, "DIARY_API_URL": "https://example.test:8444/"}
        with patch.dict(os.environ, overridden, clear=True):
            self.assertEqual(Config().api_url, "https://example.test:8444")


if __name__ == "__main__":
    unittest.main()
