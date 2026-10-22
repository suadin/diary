"""Single-process HTTP API and static web server for a local Diary instance."""

from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import hmac
import json
import mimetypes
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

from diary.config import Settings, ensure_local_paths
from diary.store import (
    add_entry,
    day_page,
    delete_entries,
    initialize,
    list_days,
    list_entries,
    search_entries,
    valid_day,
)
from diary.testrunner import TestRunner


MAX_BODY_BYTES = 100_000


class DiaryServer(ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = True

    def __init__(
        self,
        address: tuple[str, int],
        settings: Settings,
        test_command: list[str] | None = None,
    ):
        ensure_local_paths(settings)
        initialize(settings.database_path)
        self.settings = settings
        self.test_runner = TestRunner(test_command)
        super().__init__(address, DiaryHandler)


class DiaryHandler(BaseHTTPRequestHandler):
    server: DiaryServer

    def log_message(self, format_string: str, *args: object) -> None:
        request = str(args[0]).split(" ", 1) if args else ["request"]
        method = request[0]
        path = urlsplit(request[1]).path if len(request) > 1 else "/"
        status = args[1] if len(args) > 1 else "?"
        print(f"[diary] {self.address_string()} {method} {path} {status}")

    def do_GET(self) -> None:
        route = urlsplit(self.path)
        query = parse_qs(route.query)
        try:
            if route.path == "/":
                self._static("index.html")
            elif route.path in {"/app.js", "/style.css", "/diary.svg"}:
                self._static(route.path.lstrip("/"))
            elif route.path == "/api/days":
                self._json(200, list_days(self.server.settings.database_path))
            elif route.path == "/api/days/page":
                self._json(200, day_page(
                    self.server.settings.database_path,
                    self._integer(query, "offset", 0, minimum=0),
                    self._integer(query, "limit", 7, minimum=1, maximum=50),
                ))
            elif route.path == "/api/entries":
                day = self._query_value(query, "date")
                if day and not valid_day(day):
                    raise ValueError("date must be a real calendar date in YYYY-MM-DD format")
                self._json(200, list_entries(self.server.settings.database_path, day))
            elif route.path == "/api/search":
                self._json(200, search_entries(
                    self.server.settings.database_path,
                    self._query_value(query, "q") or "",
                ))
            elif route.path == "/api/skill":
                self._text(200, self._read_skill(), "text/markdown; charset=utf-8")
            elif route.path == "/api/metrics":
                self._metrics()
            elif route.path == "/ai/skill":
                self._require_bearer(self.server.settings.ai_read_token)
                self._text(200, self._read_skill(), "text/markdown; charset=utf-8")
            elif route.path == "/ai/search":
                self._require_bearer(self.server.settings.ai_read_token)
                self._json(200, search_entries(
                    self.server.settings.database_path,
                    self._query_value(query, "q") or "",
                ))
            else:
                self._json(404, {"error": "not found"})
        except PermissionError as error:
            self._json(401, {"error": str(error)})
        except ValueError as error:
            self._json(400, {"error": str(error)})
        except OSError as error:
            self._json(500, {"error": f"storage error: {error}"})

    def do_POST(self) -> None:
        route = urlsplit(self.path)
        try:
            if route.path == "/api/tests":
                self._require_same_origin()
                started = self.server.test_runner.start()
                self._json(202, {"running": True, "started": started})
            elif route.path == "/ai/entries":
                self._require_bearer(self.server.settings.ai_write_token)
                body = self._read_json()
                unexpected = body.keys() - {"date", "title", "content"}
                if unexpected:
                    raise ValueError(f"unsupported entry fields: {', '.join(sorted(unexpected))}")
                if any(not isinstance(body.get(field), str) for field in ("date", "title", "content")):
                    raise ValueError("date, title, and content must be text")
                entry_id = add_entry(
                    self.server.settings.database_path,
                    body["date"],
                    body["title"],
                    body["content"],
                )
                self._json(201, {"id": entry_id})
            else:
                self._json(404, {"error": "not found"})
        except PermissionError as error:
            self._json(401, {"error": str(error)})
        except ValueError as error:
            self._json(400, {"error": str(error)})
        except OSError as error:
            self._json(500, {"error": f"storage error: {error}"})

    def do_PUT(self) -> None:
        if urlsplit(self.path).path != "/api/skill":
            self._json(404, {"error": "not found"})
            return
        try:
            self._require_same_origin()
            body = self._read_json()
            content = body.get("content")
            if not isinstance(content, str) or not content.strip():
                raise ValueError("skill content cannot be empty")
            if len(content.encode("utf-8")) > MAX_BODY_BYTES:
                raise ValueError("skill is too large")
            self.server.settings.skill_path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
            temporary = self.server.settings.skill_path.with_suffix(".tmp")
            temporary.write_text(content.rstrip() + "\n", encoding="utf-8")
            temporary.chmod(0o600)
            temporary.replace(self.server.settings.skill_path)
            self._json(200, {"ok": True})
        except PermissionError as error:
            self._json(401, {"error": str(error)})
        except ValueError as error:
            self._json(400, {"error": str(error)})
        except OSError as error:
            self._json(500, {"error": f"storage error: {error}"})

    def do_DELETE(self) -> None:
        if urlsplit(self.path).path != "/api/entries":
            self._json(404, {"error": "not found"})
            return
        try:
            self._require_same_origin()
            body = self._read_json()
            day = self._optional_string(body, "date")
            before = self._optional_string(body, "before")
            deleted = delete_entries(self.server.settings.database_path, day, before)
            self._json(200, {"deleted": deleted})
        except PermissionError as error:
            self._json(401, {"error": str(error)})
        except ValueError as error:
            self._json(400, {"error": str(error)})
        except OSError as error:
            self._json(500, {"error": f"storage error: {error}"})

    def _read_skill(self) -> str:
        path = self.server.settings.skill_path
        if not path.exists():
            seed = Path(__file__).resolve().parent.parent / "docs" / "AI-SKILL.md"
            path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
            path.write_text(seed.read_text(encoding="utf-8"), encoding="utf-8")
        path.chmod(0o600)
        return path.read_text(encoding="utf-8")

    def _metrics(self) -> None:
        path = self.server.settings.metrics_path
        running = self.server.test_runner.running()
        if not path.exists():
            self._json(200, {"tests": 0, "coverage": None, "measuredAt": None, "running": running})
            return
        try:
            metrics = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as error:
            self._json(500, {"error": f"cannot read test metrics: {error}"})
            return
        metrics["running"] = running
        self._json(200, metrics)

    def _static(self, filename: str) -> None:
        path = Path(__file__).resolve().parent.parent / "web" / filename
        if not path.is_file():
            self._json(404, {"error": "not found"})
            return
        content_type = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
        self._text(200, path.read_text(encoding="utf-8"), f"{content_type}; charset=utf-8")

    def _read_json(self) -> dict[str, object]:
        length = int(self.headers.get("Content-Length", "0"))
        if length < 1 or length > MAX_BODY_BYTES:
            raise ValueError("request body must be between 1 byte and 100 KB")
        try:
            body = json.loads(self.rfile.read(length))
        except (json.JSONDecodeError, UnicodeDecodeError) as error:
            raise ValueError("request body must be valid JSON") from error
        if not isinstance(body, dict):
            raise ValueError("request body must be a JSON object")
        return body

    def _require_bearer(self, expected: str) -> None:
        provided = self.headers.get("Authorization", "")
        scheme, _, token = provided.partition(" ")
        if scheme.lower() != "bearer" or not hmac.compare_digest(token, expected):
            raise PermissionError("valid bearer token required")

    def _require_same_origin(self) -> None:
        origin = self.headers.get("Origin", "")
        try:
            parsed = urlsplit(origin)
        except ValueError as error:
            raise PermissionError("same-origin browser request required") from error
        host = self.headers.get("Host", "")
        loopback_origin = (
            parsed.scheme == "http"
            and parsed.netloc == host
            and parsed.hostname in {"127.0.0.1", "localhost", "::1"}
        )
        trusted_https_origin = (
            self.server.settings.public_origin is not None
            and origin == self.server.settings.public_origin
            and parsed.netloc == host
        )
        if not loopback_origin and not trusted_https_origin:
            raise PermissionError("same-origin browser request required")

    def _optional_string(self, body: dict[str, object], key: str) -> str | None:
        value = body.get(key)
        if value is None:
            return None
        if not isinstance(value, str) or not value.strip():
            raise ValueError(f"{key} must be a non-empty string")
        return value.strip()

    def _query_value(self, query: dict[str, list[str]], key: str) -> str | None:
        values = query.get(key)
        return values[0] if values else None

    def _integer(
        self,
        query: dict[str, list[str]],
        key: str,
        default: int,
        minimum: int | None = None,
        maximum: int | None = None,
    ) -> int:
        raw = self._query_value(query, key)
        if raw is None:
            return default
        try:
            value = int(raw)
        except ValueError as error:
            raise ValueError(f"{key} must be an integer") from error
        if minimum is not None and value < minimum:
            raise ValueError(f"{key} must be at least {minimum}")
        if maximum is not None and value > maximum:
            raise ValueError(f"{key} must be at most {maximum}")
        return value

    def _json(self, status: int, body: object, headers: dict[str, str] | None = None) -> None:
        encoded = json.dumps(body, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(encoded)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Content-Security-Policy", "default-src 'self'; img-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'")
        if headers:
            for key, value in headers.items():
                self.send_header(key, value)
        self.end_headers()
        self.wfile.write(encoded)

    def _text(self, status: int, body: str, content_type: str, headers: dict[str, str] | None = None) -> None:
        encoded = body.encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(encoded)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Content-Security-Policy", "default-src 'self'; img-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'")
        if headers:
            for key, value in headers.items():
                self.send_header(key, value)
        self.end_headers()
        self.wfile.write(encoded)


def serve(settings_value: Settings) -> None:
    httpd = DiaryServer((settings_value.host, settings_value.port), settings_value)
    print(f"Diary is listening at http://{settings_value.host}:{settings_value.port}")
    print(f"Private data: {settings_value.data_dir}")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping Diary.")
    finally:
        httpd.server_close()
