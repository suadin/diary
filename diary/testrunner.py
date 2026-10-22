"""Start the test suite from the web page and report whether a run is active."""

from pathlib import Path
import subprocess
import sys
import threading


ROOT = Path(__file__).resolve().parent.parent


class TestRunner:
    """Owns at most one test subprocess and refuses to start a second one."""

    def __init__(self, command: list[str] | None = None) -> None:
        self.command = command or [sys.executable, "-m", "diary", "test"]
        self._lock = threading.Lock()
        self._process: subprocess.Popen | None = None

    def start(self) -> bool:
        """Start a run and return False when one is already in progress."""
        with self._lock:
            if self._active():
                return False
            self._process = subprocess.Popen(self.command, cwd=str(ROOT))
            return True

    def running(self) -> bool:
        with self._lock:
            return self._active()

    def _active(self) -> bool:
        if self._process is None:
            return False
        if self._process.poll() is None:
            return True
        self._process = None
        return False
