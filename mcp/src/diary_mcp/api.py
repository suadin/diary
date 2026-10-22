"""Small HTTP client for the Diary API.

The NAS certificate is signed by the local CA, which is installed in the
system trust store. urllib uses that store, so no separate CA file is needed.
"""

import json
import urllib.error
import urllib.parse
import urllib.request

from .config import get_config


class DiaryAPI:
    """HTTP client for the three AI routes and the read-only day list."""

    def __init__(self) -> None:
        self.config = get_config()

    def _request(
        self,
        method: str,
        path: str,
        token: str | None,
        payload: dict[str, object] | None = None,
    ) -> object:
        url = f"{self.config.api_url}{path}"
        data = json.dumps(payload).encode("utf-8") if payload is not None else None
        headers = {"Accept": "application/json"}
        if token:
            headers["Authorization"] = f"Bearer {token}"
        if data is not None:
            headers["Content-Type"] = "application/json"
        request = urllib.request.Request(url, data=data, headers=headers, method=method)
        try:
            with urllib.request.urlopen(request, timeout=15) as response:
                return json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as error:
            detail = error.read().decode("utf-8", "replace").strip()
            raise RuntimeError(
                f"Diary API {method} {path} failed ({error.code}): {detail}"
            ) from error
        except urllib.error.URLError as error:
            raise RuntimeError(
                f"Diary API not reachable at {url}: {error.reason}"
            ) from error

    def _text(self, path: str, token: str | None) -> str:
        url = f"{self.config.api_url}{path}"
        request = urllib.request.Request(url, headers={"Accept": "text/markdown"})
        if token:
            request.add_header("Authorization", f"Bearer {token}")
        try:
            with urllib.request.urlopen(request, timeout=15) as response:
                return response.read().decode("utf-8")
        except urllib.error.HTTPError as error:
            detail = error.read().decode("utf-8", "replace").strip()
            raise RuntimeError(
                f"Diary API GET {path} failed ({error.code}): {detail}"
            ) from error
        except urllib.error.URLError as error:
            raise RuntimeError(
                f"Diary API not reachable at {url}: {error.reason}"
            ) from error

    def append_entry(
        self, day: str, title: str, content: str, author: str = "AI"
    ) -> dict[str, object]:
        return self._request(  # type: ignore[return-value]
            "POST",
            "/ai/entries",
            self.config.write_token,
            {"date": day, "title": title, "content": content, "author": author},
        )

    def search(self, query: str = "") -> list[dict[str, object]]:
        suffix = f"?q={urllib.parse.quote(query)}" if query else ""
        return self._request(  # type: ignore[return-value]
            "GET", f"/ai/search{suffix}", self.config.read_token
        )

    def list_days(self) -> list[dict[str, object]]:
        return self._request("GET", "/api/days", None)  # type: ignore[return-value]

    def skill(self) -> str:
        return self._text("/ai/skill", self.config.read_token)
