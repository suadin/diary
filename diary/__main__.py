"""Diary command line."""

import argparse
from pathlib import Path
import sys

from diary.config import ensure_local_paths, settings, setup
from diary.coverage import run as run_tests
from diary.importer import import_directory
from diary.server import serve
from diary.store import initialize


def main() -> int:
    parser = argparse.ArgumentParser(prog="diary")
    parser.add_argument("command", choices=("setup", "serve", "test", "import"))
    parser.add_argument("source", nargs="?", help="folder containing YYYY-MM-DD.md logs")
    arguments = parser.parse_args()
    current = settings()

    if arguments.command == "setup":
        credentials = setup(current)
        initialize(current.database_path)
        print(f"Diary is ready. Credentials are stored outside the repository at {credentials}.")
        print("Keep that file private. It contains separate AI read and write credentials.")
        return 0
    if arguments.command == "test":
        return run_tests()
    if arguments.command == "import":
        if not arguments.source:
            parser.error("import requires a source folder")
        ensure_local_paths(current)
        initialize(current.database_path)
        result = import_directory(current.database_path, Path(arguments.source).expanduser())
        print(f"Imported {result['imported']} entries from {result['files']} files; skipped {result['skipped']} duplicates or invalid dates.")
        return 0
    ensure_local_paths(current)
    serve(current)
    return 0


if __name__ == "__main__":
    sys.exit(main())
