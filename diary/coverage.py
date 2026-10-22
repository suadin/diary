"""Run the test suite and measure application line coverage using Python's stdlib."""

import ast
from datetime import datetime, timezone
import json
from pathlib import Path
import sys
import trace
import unittest

from diary.config import ensure_local_paths, settings


ROOT = Path(__file__).resolve().parent.parent
APP_DIR = ROOT / "diary"
EXCLUDED = {"__init__.py", "__main__.py", "coverage.py"}


def executable_lines(path: Path) -> set[int]:
    tree = ast.parse(path.read_text(encoding="utf-8"))
    lines: set[int] = set()

    class StatementLines(ast.NodeVisitor):
        def visit_Expr(self, node: ast.Expr) -> None:
            if not (isinstance(node.value, ast.Constant) and isinstance(node.value.value, str)):
                lines.add(node.lineno)
            self.generic_visit(node)

        def generic_visit(self, node: ast.AST) -> None:
            if isinstance(node, ast.stmt) and not (
                isinstance(node, ast.Expr) and isinstance(node.value, ast.Constant) and isinstance(node.value.value, str)
            ):
                lines.add(node.lineno)
            super().generic_visit(node)

    StatementLines().visit(tree)
    return lines


def run() -> int:
    suite = unittest.defaultTestLoader.discover(str(ROOT / "tests"))
    runner = unittest.TextTestRunner(verbosity=2)
    tracer = trace.Trace(count=True, trace=False, ignoredirs=[sys.prefix, sys.exec_prefix, str(ROOT / "tests")])
    trace.threading.settrace(tracer.globaltrace)
    try:
        result = tracer.runfunc(runner.run, suite)
    finally:
        trace.threading.settrace(None)
    counts = tracer.results().counts
    total = 0
    covered = 0
    for source in sorted(APP_DIR.glob("*.py")):
        if source.name in EXCLUDED:
            continue
        statements = executable_lines(source)
        total += len(statements)
        covered += sum((str(source), line) in counts for line in statements)
    coverage_percent = round((covered / total * 100) if total else 100, 1)
    current = settings()
    ensure_local_paths(current, require_credentials=False)
    metrics = {
        "tests": result.testsRun,
        "failures": len(result.failures) + len(result.errors),
        "coveredLines": covered,
        "totalLines": total,
        "coverage": coverage_percent,
        "measuredAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }
    temporary = current.metrics_path.with_suffix(".tmp")
    temporary.write_text(json.dumps(metrics, indent=2) + "\n", encoding="utf-8")
    temporary.chmod(0o600)
    temporary.replace(current.metrics_path)
    print(f"\nDiary application line coverage: {covered}/{total} ({coverage_percent}%)")
    print(f"Test metrics saved to {current.metrics_path}")
    return 0 if result.wasSuccessful() else 1


if __name__ == "__main__":
    raise SystemExit(run())
