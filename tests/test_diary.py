import importlib.util
import json
from pathlib import Path
import re
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
from diary.readme import documents, readme_pages
from diary.server import DiaryServer
from diary.store import (
    add_entry,
    delete_entries,
    entry_page,
    entry_topic,
    get_entry,
    initialize,
    list_days,
    list_entries,
    search_entries,
    search_page,
    top_tags,
)


def covers(*slugs):
    def decorate(method):
        method.covers = slugs
        return method

    return decorate


class StoreTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.database = Path(self.temp.name) / "diary.sqlite3"
        initialize(self.database)

    def tearDown(self):
        self.temp.cleanup()

    def add(self, day, title, content, source_key=None):
        return add_entry(self.database, day, title, content, source_key)

    @covers("entries-and-writing", "navigation-and-deep-links", "journal-navigation")
    def test_entries_and_days_sort_newest_first(self):
        self.add("2026-10-20", "Older note", "first")
        self.add("2026-10-21", "New note", "second")
        self.assertEqual(list_days(self.database), [
            {"date": "2026-10-21", "count": 1},
            {"date": "2026-10-20", "count": 1},
        ])
        self.assertEqual(list_entries(self.database, "2026-10-20")[0]["title"], "Older note")
        self.assertNotIn("tags", list_entries(self.database)[0])

    @covers("entries-and-writing", "navigation-and-deep-links", "journal-navigation")
    def test_search_matches_title_and_content_only(self):
        self.add("2026-10-20", "Boot notes", "A tested route")
        self.assertEqual(len(search_entries(self.database, "tested")), 1)
        self.assertEqual(len(search_entries(self.database, "boot")), 1)
        self.assertEqual(search_entries(self.database, "hub"), [])
        self.assertEqual(search_entries(self.database, "absent"), [])

    @covers("entries-and-writing")
    def test_search_escapes_like_wildcards(self):
        self.add("2026-10-20", "Percent % marker", "underscore _ marker")
        self.assertEqual(len(search_entries(self.database, "%")), 1)
        self.assertEqual(len(search_entries(self.database, "_")), 1)

    @covers("human-controls")
    def test_delete_by_exact_day_and_inclusive_cutoff(self):
        self.add("2026-10-19", "Old", "old")
        self.add("2026-10-20", "Middle", "middle")
        self.add("2026-10-21", "Latest", "latest")
        self.assertEqual(delete_entries(self.database, before="2026-10-20"), 2)
        self.assertEqual(delete_entries(self.database, day="2026-10-21"), 1)
        self.assertEqual(list_entries(self.database), [])

    @covers("entries-and-writing", "navigation-and-deep-links", "journal-navigation")
    def test_top_tags_and_tag_search_use_the_title_topic(self):
        self.add("2026-10-21", "Diary — First", "body one")
        self.add("2026-10-21", "Diary — Second", "body two")
        self.add("2026-10-21", "hub — Boot", "body three")
        self.add("2026-10-21", "No topic", "Diary appears in the body only")
        self.assertEqual(top_tags(self.database), [
            {"tag": "Diary", "count": 2},
            {"tag": "hub", "count": 1},
        ])
        self.assertEqual(len(top_tags(self.database, 1)), 1)
        tagged = search_entries(self.database, "", "diary")
        self.assertEqual([entry["title"] for entry in tagged], ["Diary — Second", "Diary — First"])
        both = search_entries(self.database, "body two", "Diary")
        self.assertEqual([entry["title"] for entry in both], ["Diary — Second"])
        self.assertEqual(search_entries(self.database, "", "missing"), [])

    @covers("navigation-and-deep-links", "journal-navigation")
    def test_top_tags_show_eight_by_count_then_latest_use(self):
        for index in range(12):
            self.add("2026-10-21", f"Topic {index:02} — Entry", "body")
        self.add("2026-10-21", "Diary — One", "body")
        self.add("2026-10-21", "Diary — Two", "body")
        tags = [item["tag"] for item in top_tags(self.database)]
        self.assertEqual(len(tags), 8)
        self.assertEqual(tags[0], "Diary")
        self.assertEqual(tags[1:], [f"Topic {index:02}" for index in range(11, 4, -1)])
        self.assertEqual(len(top_tags(self.database, 20)), 13)

    @covers("navigation-and-deep-links", "journal-navigation")
    def test_tag_filter_follows_the_same_topic_rule_as_the_sidebar(self):
        self.add("2026-10-21", "Hub: Boot — Doku", "body colon first")
        self.add("2026-10-21", "four-wins: Power-Scheibe", "body colon")
        self.assertEqual(top_tags(self.database), [
            {"tag": "four-wins", "count": 1},
            {"tag": "Hub", "count": 1},
        ])
        self.assertEqual([e["title"] for e in search_entries(self.database, "", "Hub")], ["Hub: Boot — Doku"])
        self.assertEqual(search_entries(self.database, "", "Hub: Boot"), [])
        self.assertEqual([e["title"] for e in search_entries(self.database, "", "FOUR-WINS")], ["four-wins: Power-Scheibe"])

    @covers("navigation-and-deep-links", "entries-and-writing", "journal-navigation")
    def test_search_combines_text_with_a_tag_or_a_day(self):
        self.add("2026-10-21", "Diary — One", "alpha")
        self.add("2026-10-22", "Diary — Two", "alpha")
        self.add("2026-10-22", "Hub — Three", "alpha")
        self.add("2026-10-22", "Diary — Four", "beta")
        titles = lambda rows: [entry["title"] for entry in rows]
        self.assertEqual(titles(search_entries(self.database, "alpha")), ["Hub — Three", "Diary — Two", "Diary — One"])
        self.assertEqual(titles(search_entries(self.database, "alpha", "Diary")), ["Diary — Two", "Diary — One"])
        self.assertEqual(titles(search_entries(self.database, "alpha", None, "2026-10-22")), ["Hub — Three", "Diary — Two"])
        self.assertEqual(titles(search_entries(self.database, "alpha", "Diary", "2026-10-22")), ["Diary — Two"])
        self.assertEqual(titles(search_entries(self.database, "", "Diary", "2026-10-22")), ["Diary — Four", "Diary — Two"])
        self.assertEqual(search_entries(self.database, "beta", "Hub"), [])

    @covers("navigation-and-deep-links", "journal-navigation")
    def test_search_page_windows_results_and_reports_the_total(self):
        for index in range(10):
            self.add("2026-10-21", f"Diary — Note {index:02}", "same body")
        first = search_page(self.database, "", "Diary", None, 0, 8)
        second = search_page(self.database, "", "Diary", None, 8, 8)
        self.assertEqual(first["total"], 10)
        self.assertEqual(len(first["entries"]), 8)
        self.assertEqual(len(second["entries"]), 2)
        self.assertEqual(second["entries"][0]["title"], "Diary — Note 01")
        narrowed = search_page(self.database, "same", "Diary", "2026-10-22", 0, 8)
        self.assertEqual((narrowed["total"], narrowed["entries"]), (0, []))

    @covers("entries-and-writing", "navigation-and-deep-links", "journal-navigation")
    def test_colon_titles_yield_topics_and_the_earliest_separator_wins(self):
        self.assertEqual(entry_topic("die-wand: ganz auf Englisch"), "die-wand")
        self.assertEqual(entry_topic("Hub: Boot — Doku"), "Hub")
        self.assertEqual(entry_topic("Hub — Boot: Doku"), "Hub")
        self.assertEqual(entry_topic(": ohne Thema"), None)
        self.assertEqual(entry_topic("Offen"), None)

    @covers("entries-and-writing")
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

    @covers("navigation-and-deep-links", "journal-navigation")
    def test_entry_page_windows_a_day_and_reports_its_total(self):
        for index in range(7):
            self.add("2026-10-21", f"Note {index}", "body")
        first = entry_page(self.database, "2026-10-21", 0, 5)
        self.assertEqual(first["total"], 7)
        self.assertEqual(first["offset"], 0)
        self.assertEqual([entry["title"] for entry in first["entries"]],
                         [f"Note {index}" for index in range(6, 1, -1)])
        second = entry_page(self.database, "2026-10-21", 5, 5)
        self.assertEqual(second["offset"], 5)
        self.assertEqual([entry["title"] for entry in second["entries"]],
                         ["Note 1", "Note 0"])
        self.assertEqual(entry_page(self.database, "2026-10-20", 0, 5)["total"], 0)
        with self.assertRaises(ValueError):
            entry_page(self.database, "2026-02-30", 0, 5)

    @covers("human-controls")
    def test_delete_requires_exactly_one_valid_filter(self):
        with self.assertRaises(ValueError):
            delete_entries(self.database)
        with self.assertRaises(ValueError):
            delete_entries(self.database, day="2026-10-21", before="2026-10-20")
        with self.assertRaises(ValueError):
            delete_entries(self.database, before="tomorrow")

    @covers("entries-and-writing")
    def test_author_defaults_normalizes_and_has_a_limit(self):
        default_id = add_entry(self.database, "2026-10-21", "Default author", "body")
        self.assertEqual(get_entry(self.database, default_id)["author"], "AI")
        named_id = add_entry(self.database, "2026-10-21", "Named author", "body",
                             author="  opencode/model  ")
        self.assertEqual(get_entry(self.database, named_id)["author"], "opencode/model")
        empty_id = add_entry(self.database, "2026-10-21", "Empty author", "body", author="   ")
        self.assertEqual(get_entry(self.database, empty_id)["author"], "AI")
        with self.assertRaises(ValueError):
            add_entry(self.database, "2026-10-21", "Long author", "body", author="x" * 81)

    @covers("entries-and-writing", "navigation-and-deep-links")
    def test_get_entry_returns_one_entry_or_none(self):
        entry_id = add_entry(self.database, "2026-10-21", "Find me", "body")
        entry = get_entry(self.database, entry_id)
        self.assertEqual(entry["title"], "Find me")
        self.assertEqual(entry["date"], "2026-10-21")
        self.assertIsNone(get_entry(self.database, entry_id + 100))

    @covers("entries-and-writing", "data")
    def test_migration_adds_author_to_legacy_entries(self):
        with sqlite3.connect(self.database) as database:
            database.execute("DROP TABLE entries")
            database.execute(
                "CREATE TABLE entries (id INTEGER PRIMARY KEY, day TEXT NOT NULL, "
                "title TEXT NOT NULL, content TEXT NOT NULL, created_at TEXT NOT NULL, "
                "source_key TEXT UNIQUE)"
            )
            database.execute(
                "INSERT INTO entries(day, title, content, created_at) VALUES (?, ?, ?, ?)",
                ("2026-10-20", "Old entry", "body", "2026-10-20T10:00:00+00:00"),
            )
        initialize(self.database)
        entry = get_entry(self.database, 1)
        self.assertEqual(entry["author"], "AI")
        self.assertEqual(entry["title"], "Old entry")

    @covers("data")
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
    @covers("entries-and-writing", "data")
    def test_splits_level_two_sections_and_intro_as_distinct_entries(self):
        entries = split_log("# 2026-10-21\nA short introduction.\n\n## 1. Hub — Boot and tests\nDetails.\n\n## Open\nLater.")
        self.assertEqual([entry[0] for entry in entries], ["Daily summary", "Hub — Boot and tests", "Open"])
        self.assertEqual(entries[1][1], "Details.")

    @covers("data")
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


class ReadmeTests(unittest.TestCase):
    @covers("documentation-reader")
    def test_pages_are_split_at_level_two_headings_with_an_overview(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "README.md"
            path.write_text(
                "# Diary\n\nIntro text.\n\n## One\nFirst body.\n\n## Two\nSecond body.\n",
                encoding="utf-8",
            )
            document = readme_pages(path)
            self.assertEqual(document["title"], "Diary")
            self.assertEqual([page["title"] for page in document["pages"]],
                             ["Overview", "One", "Two"])
            self.assertEqual(document["pages"][0]["markdown"], "Intro text.")
            self.assertEqual([page["slug"] for page in document["pages"]],
                             ["overview", "one", "two"])

    @covers("documentation-reader")
    def test_duplicate_headings_get_distinct_slugs(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "README.md"
            path.write_text("# Same\n\n## Setup\nA\n\n## Setup\nB\n", encoding="utf-8")
            document = readme_pages(path)
            self.assertEqual([page["slug"] for page in document["pages"]],
                             ["setup", "setup-2"])

    @covers("documentation-reader")
    def test_documents_collect_the_readme_and_docs_without_the_ai_skill(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / "docs").mkdir()
            (root / "README.md").write_text("# Diary\n\n## One\nBody.\n", encoding="utf-8")
            (root / "RELEASE-NOTES.md").write_text(
                "# Release notes\n\nIntro.\n\n## 1.1.0\nNew.\n", encoding="utf-8"
            )
            (root / "docs" / "guide.md").write_text("# Guide\n\n## Part\nText.\n", encoding="utf-8")
            (root / "docs" / "AI-SKILL.md").write_text("# Hidden\n", encoding="utf-8")
            result = documents(root)
            self.assertEqual(
                [item["slug"] for item in result], ["readme", "guide", "release-notes"]
            )
            self.assertEqual(
                [item["title"] for item in result], ["README", "Guide", "RELEASE NOTES"]
            )
            self.assertEqual(result[0]["pages"][0]["slug"], "one")
            self.assertEqual(
                [page["title"] for page in result[2]["pages"]], ["All versions"]
            )
            self.assertEqual([page["slug"] for page in result[2]["pages"]], ["all"])
            self.assertNotIn("Overview", result[2]["pages"][0]["markdown"])


class ConfigTests(unittest.TestCase):
    @covers("data", "deployment")
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

    @covers("data", "deployment")
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
            with patch.dict("os.environ", {**env, "DIARY_PUBLIC_ORIGIN": "https://192.0.2.50:8444"}, clear=True):
                self.assertEqual(settings().public_origin, "https://192.0.2.50:8444")
            with patch.dict("os.environ", {**env, "DIARY_PUBLIC_ORIGIN": "https://192.0.2.50:8444/"}, clear=True):
                self.assertEqual(settings().public_origin, "https://192.0.2.50:8444")

    @covers("deployment")
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
            with patch.dict(
                "os.environ",
                {"DIARY_CONFIG_DIR": str(config), "DIARY_AI_READ_TOKEN": "", "DIARY_AI_WRITE_TOKEN": ""},
                clear=True,
            ):
                inherited = settings()
            self.assertEqual((inherited.ai_read_token, inherited.ai_write_token), ("read", "write"))
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
                "http://192.0.2.50:8444",
            )
            with self.assertRaisesRegex(ValueError, "HTTPS origin"):
                ensure_local_paths(unsafe_origin)

    @covers("data", "deployment")
    def test_setup_rejects_empty_credentials_in_an_existing_file(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            config_dir = root / "config"
            config_dir.mkdir()
            (config_dir / "credentials.env").write_text(
                "DIARY_AI_READ_TOKEN=\nDIARY_AI_WRITE_TOKEN=write\n",
                encoding="utf-8",
            )
            current = Settings(root / "data", config_dir, "127.0.0.1", 8125, "r", "w")
            with self.assertRaisesRegex(RuntimeError, "empty values"):
                setup(current)

    @covers("data")
    def test_local_data_and_credentials_cannot_be_inside_repository(self):
        unsafe = Settings(ROOT / "data", ROOT / "config", "127.0.0.1", 8125, "r", "w")
        with self.assertRaisesRegex(ValueError, "outside the repository"):
            ensure_local_paths(unsafe)


class McpConfigTests(unittest.TestCase):
    @covers("ai-client-mcp")
    def test_mcp_client_takes_its_connection_from_the_environment(self):
        path = ROOT / "mcp" / "src" / "diary_mcp" / "config.py"
        spec = importlib.util.spec_from_file_location("diary_mcp_config_under_test", path)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        with patch.dict(
            "os.environ",
            {"DIARY_AI_READ_TOKEN": "read", "DIARY_AI_WRITE_TOKEN": "write"},
            clear=True,
        ):
            config = module.Config()
            self.assertEqual(config.api_url, "http://127.0.0.1:8125")
            self.assertEqual(config.read_token, "read")
            self.assertEqual(config.write_token, "write")
        with patch.dict(
            "os.environ",
            {
                "DIARY_AI_READ_TOKEN": "read",
                "DIARY_AI_WRITE_TOKEN": "write",
                "DIARY_API_URL": "https://journal.example/",
            },
            clear=True,
        ):
            self.assertEqual(module.Config().api_url, "https://journal.example")
        addresses = set(re.findall(r"https?://[^\"'\s]+", path.read_text(encoding="utf-8")))
        self.assertEqual(addresses, {"http://127.0.0.1:8125"})


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
    @covers("ai-api", "writing-guide")
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

    @covers("ai-api")
    def test_ai_writer_can_append_but_cannot_edit_or_delete(self):
        payload = {"date": "2026-10-21", "title": "A note", "content": "Body"}
        status, _, _ = self.request("/ai/entries", "POST", payload, token="write-secret")
        self.assertEqual(status, 201)
        status, _, _ = self.request("/api/entries", "DELETE", {"date": "2026-10-21"}, token="write-secret")
        self.assertEqual(status, 401)
        status, text, _ = self.request("/ai/search?q=Body", token="read-secret")
        self.assertEqual(status, 200)
        self.assertIn("2026-10-21", text)

    @covers("human-controls")
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

    @covers("human-controls")
    def test_human_mutations_reject_missing_or_foreign_origin(self):
        status, _, _ = self.request("/api/skill", "PUT", {"content": "# No"}, origin="https://elsewhere.invalid")
        self.assertEqual(status, 401)
        status, _, _ = self.request("/api/entries", "DELETE", {"date": "2026-10-21"})
        self.assertEqual(status, 401)

    @covers("human-controls", "deployment")
    def test_configured_https_origin_allows_human_mutations_only_for_exact_host(self):
        public_origin = "https://192.0.2.50:8444"
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
            host="192.0.2.50:8444",
        )
        self.assertEqual(status, 200)
        self.server.settings = Settings(
            self.settings.data_dir,
            self.settings.config_dir,
            self.settings.host,
            self.settings.port,
            self.settings.ai_read_token,
            self.settings.ai_write_token,
            public_origin + "/",
        )
        status, _, _ = self.request(
            "/api/skill",
            "PUT",
            {"content": "# Updated with a trailing slash"},
            origin=public_origin,
            host="192.0.2.50:8444",
        )
        self.assertEqual(status, 200)
        status, _, _ = self.request(
            "/api/skill",
            "PUT",
            {"content": "# Wrong origin"},
            origin="https://192.0.2.51:8444",
            host="192.0.2.51:8444",
        )
        self.assertEqual(status, 401)
        status, _, _ = self.request(
            "/api/skill",
            "PUT",
            {"content": "# Wrong host"},
            origin=public_origin,
            host="192.0.2.51:8444",
        )
        self.assertEqual(status, 401)

    @covers("ai-api")
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

    @covers("tests", "footer")
    def test_metrics_endpoint_reports_not_measured_before_first_test(self):
        status, text, _ = self.request("/api/metrics")
        self.assertEqual(status, 200)
        metrics = json.loads(text)
        self.assertIsNone(metrics["coverage"])
        self.assertFalse(metrics["running"])
        self.assertIsNone(metrics["e2e"])

    @covers("tests", "footer")
    def test_metrics_endpoint_includes_end_to_end_results(self):
        self.settings.e2e_metrics_path.write_text(
            json.dumps({"tests": 12, "failures": 0, "coverage": 61.5,
                        "measuredAt": "2026-10-22T14:00:00+00:00"}),
            encoding="utf-8",
        )
        metrics = json.loads(self.request("/api/metrics")[1])
        self.assertEqual(metrics["e2e"]["tests"], 12)
        self.assertEqual(metrics["e2e"]["coverage"], 61.5)
        self.settings.e2e_metrics_path.write_text("not json", encoding="utf-8")
        self.assertIsNone(json.loads(self.request("/api/metrics")[1])["e2e"])

    @covers("navigation-and-deep-links", "journal-navigation")
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

    @covers("navigation-and-deep-links", "journal-navigation")
    def test_entry_page_endpoint_windows_and_validates(self):
        for index in range(7):
            self.request("/ai/entries", "POST", {
                "date": "2026-10-21", "title": f"Note {index}", "content": "Body",
            }, token="write-secret")
        status, text, _ = self.request("/api/entries/page?date=2026-10-21")
        self.assertEqual(status, 200)
        page = json.loads(text)
        self.assertEqual(page["total"], 7)
        self.assertEqual(page["offset"], 0)
        self.assertEqual(page["limit"], 8)
        self.assertEqual(len(page["entries"]), 7)
        status, text, _ = self.request("/api/entries/page?date=2026-10-21&offset=5&limit=5")
        self.assertEqual(status, 200)
        self.assertEqual(len(json.loads(text)["entries"]), 2)
        for path in (
            "/api/entries/page",
            "/api/entries/page?date=bad",
            "/api/entries/page?date=2026-10-21&offset=-1",
            "/api/entries/page?date=2026-10-21&limit=0",
            "/api/entries/page?date=2026-10-21&limit=51",
        ):
            self.assertEqual(self.request(path)[0], 400, path)

    @covers("documentation-reader")
    def test_docs_endpoint_returns_documents_with_slugged_pages(self):
        status, text, _ = self.request("/api/docs")
        self.assertEqual(status, 200)
        result = json.loads(text)
        self.assertEqual(
            [item["slug"] for item in result["documents"]],
            ["readme", "app-specs", "basic-specs", "release-notes"],
        )
        self.assertEqual(result["documents"][1]["title"], "APP SPECS")
        self.assertEqual(result["documents"][2]["title"], "BASIC SPECS")
        self.assertEqual(result["documents"][3]["title"], "RELEASE NOTES")
        release_notes = result["documents"][3]
        self.assertEqual([page["title"] for page in release_notes["pages"]], ["All versions"])
        self.assertEqual([page["slug"] for page in release_notes["pages"]], ["all"])
        self.assertIn("## 1.1.0", release_notes["pages"][0]["markdown"])
        self.assertIn("## 1.0.0", release_notes["pages"][0]["markdown"])
        readme = result["documents"][0]
        titles = [page["title"] for page in readme["pages"]]
        self.assertIn("What it does", titles)
        self.assertIn("Local setup", titles)
        self.assertEqual(titles[0], "Overview")
        self.assertTrue(all(page["slug"] for page in readme["pages"]))
        self.assertEqual(len({page["slug"] for page in readme["pages"]}), len(readme["pages"]))

    @covers("navigation-and-deep-links", "entries-and-writing", "journal-navigation")
    def test_entry_endpoint_reads_one_entry_and_validates_the_id(self):
        status, text, _ = self.request("/ai/entries", "POST", {
            "date": "2026-10-21", "title": "Deep link", "content": "Body",
            "author": "opencode/model",
        }, token="write-secret")
        self.assertEqual(status, 201)
        entry_id = json.loads(text)["id"]
        status, text, _ = self.request(f"/api/entry?id={entry_id}")
        self.assertEqual(status, 200)
        entry = json.loads(text)
        self.assertEqual(entry["title"], "Deep link")
        self.assertEqual(entry["author"], "opencode/model")
        self.assertEqual(self.request("/api/entry")[0], 400)
        self.assertEqual(self.request("/api/entry?id=abc")[0], 400)
        self.assertEqual(self.request("/api/entry?id=0")[0], 400)
        self.assertEqual(self.request("/api/entry?id=99999")[0], 404)

    @covers("entries-and-writing", "ai-api")
    def test_author_must_be_text_and_defaults_to_ai(self):
        status, _, _ = self.request("/ai/entries", "POST", {
            "date": "2026-10-21", "title": "Bad author", "content": "Body", "author": 7,
        }, token="write-secret")
        self.assertEqual(status, 400)
        status, text, _ = self.request("/ai/entries", "POST", {
            "date": "2026-10-21", "title": "Default author", "content": "Body",
        }, token="write-secret")
        self.assertEqual(status, 201)
        entry_id = json.loads(text)["id"]
        self.assertEqual(json.loads(self.request(f"/api/entry?id={entry_id}")[1])["author"], "AI")

    @covers("writing-guide", "human-controls")
    def test_skill_reset_restores_the_seed_and_needs_same_origin(self):
        self.request("/api/skill", "PUT", {"content": "# Changed\n"}, origin=self.base)
        status, _, _ = self.request("/api/skill/reset", "POST")
        self.assertEqual(status, 401)
        status, text, _ = self.request("/api/skill/reset", "POST", origin=self.base)
        self.assertEqual(status, 200)
        self.assertIn("AI diary writing guide", json.loads(text)["content"])
        self.assertIn("AI diary writing guide", self.request("/ai/skill", token="read-secret")[1])

    @covers("deployment")
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
        self.request("/ai/entries", "POST", {
            "date": "2026-10-22", "title": "Diary — Tagged note", "content": "Tagged body",
        }, token="write-secret")
        for index in range(12):
            self.request("/ai/entries", "POST", {
                "date": "2026-10-22",
                "title": f"Topic {index:02} — Tagged note",
                "content": "Tagged body",
            }, token="write-secret")
        status, tags, _ = self.request("/api/tags")
        self.assertEqual(status, 200)
        self.assertEqual(len(json.loads(tags)), 8)
        status, limited_tags, _ = self.request("/api/tags?limit=3")
        self.assertEqual(len(json.loads(limited_tags)), 3)
        status, filtered, _ = self.request("/api/search?tag=Diary")
        self.assertEqual(status, 200)
        self.assertEqual([entry["title"] for entry in json.loads(filtered)], ["Diary — Tagged note"])
        self.assertEqual(self.request("/api/tags?limit=0")[0], 400)
        status, paged, _ = self.request("/api/search/page?q=Tagged&limit=8")
        self.assertEqual(status, 200)
        self.assertEqual((json.loads(paged)["total"], len(json.loads(paged)["entries"])), (13, 8))
        status, by_day, _ = self.request("/api/search?date=2026-10-22&q=tagged")
        self.assertEqual(status, 200)
        self.assertEqual(len(json.loads(by_day)), 13)
        self.assertEqual(self.request("/api/search?date=2026-02-30")[0], 400)
        self.assertEqual(self.request("/api/search/page?date=nope")[0], 400)
        status, window, _ = self.request("/api/entries/page?date=2026-10-22")
        self.assertEqual(json.loads(window)["limit"], 8)
        status, default_page, _ = self.request("/api/search/page?q=Tagged")
        self.assertEqual(json.loads(default_page)["limit"], 8)
        status, page, headers = self.request("/")
        self.assertEqual(status, 200)
        self.assertIn("Diary", page)
        self.assertIn('id="days-newer"', page)
        self.assertIn('id="entries-newer"', page)
        self.assertIn('id="readme-button"', page)
        self.assertIn('id="doc-sections"', page)
        self.assertIn('id="e2e-metrics"', page)
        self.assertIn('id="guide-toggle"', page)
        self.assertIn('id="run-tests"', page)
        self.assertIn('href="https://github.com/suadin/diary"', page)
        self.assertNotIn('id="login-button"', page)
        self.assertNotIn('id="login-dialog"', page)
        self.assertIn("Content-Security-Policy", headers)
        for asset in ("/app.js", "/style.css", "/diary.svg"):
            self.assertEqual(self.request(asset)[0], 200)

    @covers("writing-guide", "tests")
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

    @covers("ai-api")
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

    @covers("human-controls")
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

    @covers("human-controls")
    def test_invalid_delete_filters_are_rejected(self):
        status, _, _ = self.request("/api/entries", "DELETE", {"date": "2026-10-21", "before": "2026-10-20"}, origin=self.base)
        self.assertEqual(status, 400)


class TestRunnerTests(ServerTestCase):
    test_command = [sys.executable, "-c", "import time; time.sleep(0.6)"]

    @covers("tests")
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

    @covers("tests", "human-controls", "local-access")
    def test_start_requires_same_origin(self):
        status, _, _ = self.request("/api/tests", "POST")
        self.assertEqual(status, 401)

    @covers("tests")
    def test_start_is_refused_once_results_exist(self):
        self.settings.metrics_path.write_text(
            '{"tests":28,"failures":0,"coverage":72.9,"measuredAt":"2026-10-22T09:51:50+00:00"}',
            encoding="utf-8",
        )
        status, text, _ = self.request("/api/tests", "POST", origin=self.base)
        self.assertEqual(status, 409)
        self.assertIn("already exist", json.loads(text)["error"])
        self.assertFalse(json.loads(self.request("/api/metrics")[1])["running"])


class TraceabilityTests(unittest.TestCase):
    @covers("tests")
    def test_every_requirement_section_is_named_by_a_test(self):
        sections = set()
        for name in ("BASIC-SPECS.md", "APP-SPECS.md"):
            sections.update(
                page["slug"]
                for page in readme_pages(ROOT / "docs" / name)["pages"]
            )
        sections -= {"overview"}
        covered = set()
        suite = unittest.defaultTestLoader.discover(str(ROOT / "tests"))

        def walk(items):
            for item in items:
                if isinstance(item, unittest.TestSuite):
                    walk(item)
                    continue
                method = getattr(item, item._testMethodName, None)
                covered.update(getattr(method, "covers", ()))

        walk(suite)
        spec = (ROOT / "e2e" / "specs" / "diary.spec.js").read_text(encoding="utf-8")
        covered.update(re.findall(r'"@([a-z0-9-]+)"', spec))
        self.assertEqual(sections - covered, set())
        self.assertEqual(covered - sections, set())


if __name__ == "__main__":
    unittest.main()
