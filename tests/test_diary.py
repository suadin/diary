import json
from pathlib import Path
import sqlite3
import sys
import tempfile
import threading
import time
import unittest
from unittest.mock import patch
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from diary.config import ROOT, Settings, ensure_local_paths, setup, settings
from diary.importer import import_directory, split_log
from diary.server import DiaryServer
from diary.store import add_entry, delete_entries, initialize, list_days, list_entries, search_entries


class StoreTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.database = Path(self.temp.name) / "diary.sqlite3"
        initialize(self.database)

    def tearDown(self):
        self.temp.cleanup()

    def add(self, day, title, content, source_key=None):
        return add_entry(self.database, day, title, content, source_key)

    def test_entries_and_days_sort_newest_first(self):
        self.add("2026-10-20", "Older note", "first")
        self.add("2026-10-21", "New note", "second")
        self.assertEqual(list_days(self.database), [
            {"date": "2026-10-21", "count": 1},
            {"date": "2026-10-20", "count": 1},
        ])
        self.assertEqual(list_entries(self.database, "2026-10-20")[0]["title"], "Older note")
        self.assertNotIn("tags", list_entries(self.database)[0])

    def test_search_matches_title_and_content_only(self):
        self.add("2026-10-20", "Boot notes", "A tested route")
        self.assertEqual(len(search_entries(self.database, "tested")), 1)
        self.assertEqual(len(search_entries(self.database, "boot")), 1)
        self.assertEqual(search_entries(self.database, "hub"), [])
        self.assertEqual(search_entries(self.database, "absent"), [])

    def test_search_escapes_like_wildcards(self):
        self.add("2026-10-20", "Percent % marker", "underscore _ marker")
        self.assertEqual(len(search_entries(self.database, "%")), 1)
        self.assertEqual(len(search_entries(self.database, "_")), 1)

    def test_delete_by_exact_day_and_inclusive_cutoff(self):
        self.add("2026-10-19", "Old", "old")
        self.add("2026-10-20", "Middle", "middle")
        self.add("2026-10-21", "Latest", "latest")
        self.assertEqual(delete_entries(self.database, before="2026-10-20"), 2)
        self.assertEqual(delete_entries(self.database, day="2026-10-21"), 1)
        self.assertEqual(list_entries(self.database), [])

    def test_entry_validation_and_idempotent_source_key(self):
        with self.assertRaises(ValueError):
            self.add("2026-02-30", "Invalid date", "content")
        with self.assertRaises(ValueError):
            self.add("2026-10-21", "", "content")
        first = self.add("2026-10-21", "One", "content", "source-1")
        second = self.add("2026-10-21", "One", "content", "source-1")
        self.assertIsNotNone(first)
        self.assertIsNone(second)
        with self.assertRaises(ValueError):
            self.add("2026-10-21", "Long title" * 30, "content")

    def test_delete_requires_exactly_one_valid_filter(self):
        with self.assertRaises(ValueError):
            delete_entries(self.database)
        with self.assertRaises(ValueError):
            delete_entries(self.database, day="2026-10-21", before="2026-10-20")
        with self.assertRaises(ValueError):
            delete_entries(self.database, before="tomorrow")

    def test_migration_drops_legacy_tag_tables_and_preserves_entries(self):
        with sqlite3.connect(self.database) as database:
            database.executescript(
                """
                CREATE TABLE tags (id INTEGER PRIMARY KEY, name TEXT);
                CREATE TABLE entry_tags (entry_id INTEGER, tag_id INTEGER);
                INSERT INTO tags VALUES (1, 'hub');
                INSERT INTO entry_tags VALUES (1, 1);
                """
            )
        self.add("2026-10-21", "Keep this", "entry survives tag migration")
        initialize(self.database)
        self.assertEqual(len(search_entries(self.database, "survives")), 1)
        with sqlite3.connect(self.database) as database:
            tables = {row[0] for row in database.execute("SELECT name FROM sqlite_master WHERE type = 'table'")}
        self.assertNotIn("tags", tables)
        self.assertNotIn("entry_tags", tables)


class ImporterTests(unittest.TestCase):
    def test_splits_level_two_sections_and_intro_as_distinct_entries(self):
        entries = split_log("# 2026-10-21\nA short introduction.\n\n## 1. Hub — Boot and tests\nDetails.\n\n## Open\nLater.")
        self.assertEqual([entry[0] for entry in entries], ["Daily summary", "Hub — Boot and tests", "Open"])
        self.assertEqual(entries[1][1], "Details.")

    def test_import_is_repeatable_and_ignores_non_date_files(self):
        with tempfile.TemporaryDirectory() as folder:
            source = Path(folder)
            (source / "2026-10-21.md").write_text("# Today\n\n## 1. Hub\nA note.\n", encoding="utf-8")
            (source / "README.md").write_text("# Not a day", encoding="utf-8")
            database = source / "diary.sqlite3"
            initialize(database)
            first = import_directory(database, source)
            second = import_directory(database, source)
            self.assertEqual(first["imported"], 2)
            self.assertEqual(second["imported"], 0)
            self.assertEqual(second["skipped"], 2)
            self.assertEqual(list_days(database)[0]["count"], 2)


class ConfigTests(unittest.TestCase):
    def test_setup_creates_private_credentials_and_data_directories(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            config_dir = root / "config"
            data_dir = root / "data"
            current = Settings(data_dir, config_dir, "127.0.0.1", 8125, "", "")
            credentials = setup(current)
            self.assertEqual(credentials.stat().st_mode & 0o777, 0o600)
            self.assertEqual(config_dir.stat().st_mode & 0o777, 0o700)
            self.assertEqual(data_dir.stat().st_mode & 0o777, 0o700)
            self.assertIn("DIARY_AI_READ_TOKEN=", credentials.read_text(encoding="utf-8"))
            self.assertTrue(settings().data_dir)

    def test_settings_read_custom_paths_and_environment_credentials(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            env = {
                "DIARY_CONFIG_DIR": str(root / "config"),
                "DIARY_DATA_DIR": str(root / "data"),
                "DIARY_HOST": "localhost",
                "DIARY_PORT": "9000",
                "DIARY_AI_READ_TOKEN": "read",
                "DIARY_AI_WRITE_TOKEN": "write",
            }
            with patch.dict("os.environ", env, clear=True):
                current = settings()
            self.assertEqual(current.port, 9000)
            self.assertEqual(current.ai_read_token, "read")
            self.assertEqual(current.ai_write_token, "write")
            with patch.dict("os.environ", {**env, "DIARY_PUBLIC_ORIGIN": "https://192.168.178.50:8444"}, clear=True):
                self.assertEqual(settings().public_origin, "https://192.168.178.50:8444")

    def test_settings_load_credentials_file_and_reject_non_loopback(self):
        with tempfile.TemporaryDirectory() as folder:
            config = Path(folder) / "config"
            config.mkdir()
            (config / "credentials.env").write_text(
                "DIARY_AI_READ_TOKEN=read\nDIARY_AI_WRITE_TOKEN=write\n",
                encoding="utf-8",
            )
            with patch.dict("os.environ", {"DIARY_CONFIG_DIR": str(config)}, clear=True):
                current = settings()
            self.assertEqual(current.ai_read_token, "read")
            unsafe = Settings(Path(folder) / "data", config, "0.0.0.0", 8125, "r", "w")
            with self.assertRaises(ValueError):
                ensure_local_paths(unsafe)
            unsafe_origin = Settings(
                Path(folder) / "data",
                config,
                "127.0.0.1",
                8125,
                "r",
                "w",
                "http://192.168.178.50:8444",
            )
            with self.assertRaisesRegex(ValueError, "HTTPS origin"):
                ensure_local_paths(unsafe_origin)

    def test_local_data_and_credentials_cannot_be_inside_repository(self):
        unsafe = Settings(ROOT / "data", ROOT / "config", "127.0.0.1", 8125, "r", "w")
        with self.assertRaisesRegex(ValueError, "outside the repository"):
            ensure_local_paths(unsafe)


class ServerTestCase(unittest.TestCase):
    test_command: list[str] | None = None

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        root = Path(self.temp.name)
        self.settings = Settings(
            data_dir=root / "data",
            config_dir=root / "config",
            host="127.0.0.1",
            port=8125,
            ai_read_token="read-secret",
            ai_write_token="write-secret",
        )
        self.settings.data_dir.mkdir(mode=0o700)
        (self.settings.data_dir / "AI-SKILL.md").write_text("# Test skill\n", encoding="utf-8")
        self.server = DiaryServer(("127.0.0.1", 0), self.settings, test_command=self.test_command)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.base = f"http://127.0.0.1:{self.server.server_port}"

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(timeout=2)
        self.temp.cleanup()

    def request(self, path, method="GET", body=None, token=None, origin=None, host=None):
        headers = {}
        data = None
        if body is not None:
            data = json.dumps(body).encode()
            headers["Content-Type"] = "application/json"
        if token:
            headers["Authorization"] = f"Bearer {token}"
        if origin is not None:
            headers["Origin"] = origin
        if host is not None:
            headers["Host"] = host
        request = Request(f"{self.base}{path}", data=data, method=method, headers=headers)
        try:
            response = urlopen(request)
        except HTTPError as error:
            return error.code, error.read().decode(), error.headers
        return response.status, response.read().decode(), response.headers


class HttpTests(ServerTestCase):
    def test_ai_skill_and_search_are_read_only_and_require_read_token(self):
        status, _, _ = self.request("/ai/skill")
        self.assertEqual(status, 401)
        status, text, _ = self.request("/ai/skill", token="read-secret")
        self.assertEqual(status, 200)
        self.assertIn("Test skill", text)
        status, _, _ = self.request("/ai/skill", "PUT", {"content": "# changed"}, token="read-secret", origin=self.base)
        self.assertEqual(status, 404)
        status, _, _ = self.request("/ai/entries", "POST", {}, token="read-secret")
        self.assertEqual(status, 401)

    def test_ai_writer_can_append_but_cannot_edit_or_delete(self):
        payload = {"date": "2026-10-21", "title": "A note", "content": "Body"}
        status, _, _ = self.request("/ai/entries", "POST", payload, token="write-secret")
        self.assertEqual(status, 201)
        status, _, _ = self.request("/api/entries", "DELETE", {"date": "2026-10-21"}, token="write-secret")
        self.assertEqual(status, 401)
        status, text, _ = self.request("/ai/search?q=Body", token="read-secret")
        self.assertEqual(status, 200)
        self.assertIn("2026-10-21", text)

    def test_local_human_mutations_need_same_origin_but_no_sign_in(self):
        status, _, _ = self.request("/api/skill", "PUT", {"content": "# Updated\n"}, origin=self.base)
        self.assertEqual(status, 200)
        status, text, _ = self.request("/ai/skill", token="read-secret")
        self.assertEqual(status, 200)
        self.assertIn("Updated", text)
        self.request("/ai/entries", "POST", {
            "date": "2026-10-21", "title": "A note", "content": "Body",
        }, token="write-secret")
        status, text, _ = self.request("/api/entries", "DELETE", {"date": "2026-10-21"}, origin=self.base)
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(text)["deleted"], 1)

    def test_human_mutations_reject_missing_or_foreign_origin(self):
        status, _, _ = self.request("/api/skill", "PUT", {"content": "# No"}, origin="https://elsewhere.invalid")
        self.assertEqual(status, 401)
        status, _, _ = self.request("/api/entries", "DELETE", {"date": "2026-10-21"})
        self.assertEqual(status, 401)

    def test_configured_https_origin_allows_human_mutations_only_for_exact_host(self):
        public_origin = "https://192.168.178.50:8444"
        self.server.settings = Settings(
            self.settings.data_dir,
            self.settings.config_dir,
            self.settings.host,
            self.settings.port,
            self.settings.ai_read_token,
            self.settings.ai_write_token,
            public_origin,
        )
        status, _, _ = self.request(
            "/api/skill",
            "PUT",
            {"content": "# Updated over HTTPS"},
            origin=public_origin,
            host="192.168.178.50:8444",
        )
        self.assertEqual(status, 200)
        status, _, _ = self.request(
            "/api/skill",
            "PUT",
            {"content": "# Wrong origin"},
            origin="https://192.168.178.51:8444",
            host="192.168.178.51:8444",
        )
        self.assertEqual(status, 401)
        status, _, _ = self.request(
            "/api/skill",
            "PUT",
            {"content": "# Wrong host"},
            origin=public_origin,
            host="192.168.178.51:8444",
        )
        self.assertEqual(status, 401)

    def test_api_rejects_invalid_payloads_and_unknown_routes(self):
        status, _, _ = self.request("/ai/entries", "POST", {"date": "bad"}, token="write-secret")
        self.assertEqual(status, 400)
        status, _, _ = self.request("/ai/entries", "POST", {
            "date": "2026-10-21", "title": "A note", "content": "Body", "tags": ["topic"],
        }, token="write-secret")
        self.assertEqual(status, 400)
        status, _, _ = self.request("/ai/entries", "POST", {
            "date": "2026-10-21", "title": 7, "content": "Body",
        }, token="write-secret")
        self.assertEqual(status, 400)
        status, _, _ = self.request("/missing")
        self.assertEqual(status, 404)
        status, _, _ = self.request("/api/entries?date=bad")
        self.assertEqual(status, 400)

    def test_metrics_endpoint_reports_not_measured_before_first_test(self):
        status, text, _ = self.request("/api/metrics")
        self.assertEqual(status, 200)
        metrics = json.loads(text)
        self.assertIsNone(metrics["coverage"])
        self.assertFalse(metrics["running"])

    def test_day_page_returns_seven_day_windows_with_totals(self):
        days = [f"2026-10-{day:02d}" for day in range(10, 19)]
        for day in days:
            self.request("/ai/entries", "POST", {
                "date": day, "title": day, "content": "Body",
            }, token="write-secret")
        self.request("/ai/entries", "POST", {
            "date": "2026-10-18", "title": "extra", "content": "Body",
        }, token="write-secret")
        status, text, _ = self.request("/api/days/page")
        self.assertEqual(status, 200)
        page = json.loads(text)
        self.assertEqual([day["date"] for day in page["days"]], list(reversed(days))[:7])
        self.assertEqual(page["totalDays"], 9)
        self.assertEqual(page["totalEntries"], 10)
        self.assertEqual(page["offset"], 0)
        status, text, _ = self.request("/api/days/page?offset=7&limit=7")
        page = json.loads(text)
        self.assertEqual([day["date"] for day in page["days"]], ["2026-10-11", "2026-10-10"])
        self.assertEqual(page["totalDays"], 9)
        for path in (
            "/api/days/page?offset=-1",
            "/api/days/page?limit=0",
            "/api/days/page?limit=51",
            "/api/days/page?offset=abc",
        ):
            self.assertEqual(self.request(path)[0], 400, path)

    def test_web_routes_and_static_page(self):
        self.request("/ai/entries", "POST", {
            "date": "2026-10-21", "title": "A test note", "content": "Searchable body",
        }, token="write-secret")
        status, days, _ = self.request("/api/days")
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(days)[0]["date"], "2026-10-21")
        status, entries, _ = self.request("/api/entries?date=2026-10-21")
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(entries)[0]["title"], "A test note")
        self.assertNotIn("tags", json.loads(entries)[0])
        status, results, _ = self.request("/api/search?q=searchable")
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(results)[0]["date"], "2026-10-21")
        status, page, headers = self.request("/")
        self.assertEqual(status, 200)
        self.assertIn("Diary", page)
        self.assertIn('id="days-newer"', page)
        self.assertIn('id="run-tests"', page)
        self.assertIn('href="https://github.com/suadin/diary"', page)
        self.assertNotIn('id="login-button"', page)
        self.assertNotIn('id="login-dialog"', page)
        self.assertIn("Content-Security-Policy", headers)
        for asset in ("/app.js", "/style.css", "/diary.svg"):
            self.assertEqual(self.request(asset)[0], 200)

    def test_seed_skill_empty_skill_metrics_and_request_validation(self):
        self.settings.skill_path.unlink()
        status, skill, _ = self.request("/api/skill")
        self.assertEqual(status, 200)
        self.assertIn("AI diary writing guide", skill)
        self.assertEqual(self.settings.skill_path.stat().st_mode & 0o777, 0o600)
        status, _, _ = self.request("/api/skill", "PUT", {"content": "  "}, origin=self.base)
        self.assertEqual(status, 400)
        status, _, _ = self.request("/api/skill", "PUT", {"content": "x" * 100_001}, origin=self.base)
        self.assertEqual(status, 400)
        self.settings.metrics_path.write_text(
            '{"tests":15,"coverage":80.0,"measuredAt":"2026-10-21T00:00:00Z"}',
            encoding="utf-8",
        )
        status, metrics, _ = self.request("/api/metrics")
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(metrics)["tests"], 15)

    def test_bad_json_and_non_object_request_bodies_are_rejected(self):
        for payload in (b"{", b"[]"):
            request = Request(
                f"{self.base}/api/skill",
                data=payload,
                method="PUT",
                headers={"Origin": self.base, "Content-Type": "application/json"},
            )
            with self.assertRaises(HTTPError) as invalid:
                urlopen(request)
            self.assertEqual(invalid.exception.code, 400)

    def test_delete_by_day_and_inclusive_cutoff(self):
        for day in ("2026-10-19", "2026-10-20", "2026-10-21"):
            self.request("/ai/entries", "POST", {
                "date": day, "title": day, "content": "Body",
            }, token="write-secret")
        status, body, _ = self.request("/api/entries", "DELETE", {"date": "2026-10-19"}, origin=self.base)
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(body)["deleted"], 1)
        status, body, _ = self.request("/api/entries", "DELETE", {"before": "2026-10-20"}, origin=self.base)
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(body)["deleted"], 1)
        self.assertEqual(len(json.loads(self.request("/api/entries")[1])), 1)

    def test_invalid_delete_filters_are_rejected(self):
        status, _, _ = self.request("/api/entries", "DELETE", {"date": "2026-10-21", "before": "2026-10-20"}, origin=self.base)
        self.assertEqual(status, 400)


class TestRunnerTests(ServerTestCase):
    test_command = [sys.executable, "-c", "import time; time.sleep(0.6)"]

    def test_a_second_start_is_refused_while_a_run_is_active(self):
        status, body, _ = self.request("/api/tests", "POST", origin=self.base)
        self.assertEqual(status, 202)
        self.assertTrue(json.loads(body)["started"])
        status, body, _ = self.request("/api/tests", "POST", origin=self.base)
        self.assertEqual(status, 202)
        self.assertFalse(json.loads(body)["started"])
        self.assertTrue(json.loads(self.request("/api/metrics")[1])["running"])
        time.sleep(1.0)
        self.assertFalse(json.loads(self.request("/api/metrics")[1])["running"])

    def test_start_requires_same_origin(self):
        status, _, _ = self.request("/api/tests", "POST")
        self.assertEqual(status, 401)


if __name__ == "__main__":
    unittest.main()
