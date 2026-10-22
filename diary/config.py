"""Local paths and credentials for Diary."""

from dataclasses import dataclass
import os
from pathlib import Path
import secrets
from urllib.parse import urlsplit


ROOT = Path(__file__).resolve().parent.parent


@dataclass(frozen=True)
class Settings:
    data_dir: Path
    config_dir: Path
    host: str
    port: int
    ai_read_token: str
    ai_write_token: str
    public_origin: str | None = None

    @property
    def database_path(self) -> Path:
        return self.data_dir / "diary.sqlite3"

    @property
    def skill_path(self) -> Path:
        return self.data_dir / "AI-SKILL.md"

    @property
    def metrics_path(self) -> Path:
        return self.data_dir / "test-metrics.json"


def _read_credentials(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not path.exists():
        return values
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip()
    return values


def settings() -> Settings:
    config_home = Path(os.environ.get("XDG_CONFIG_HOME", Path.home() / ".config"))
    data_home = Path(os.environ.get("XDG_DATA_HOME", Path.home() / ".local" / "share"))
    config_dir = Path(os.environ.get("DIARY_CONFIG_DIR", config_home / "diary"))
    data_dir = Path(os.environ.get("DIARY_DATA_DIR", data_home / "diary"))
    credentials = _read_credentials(config_dir / "credentials.env")
    return Settings(
        data_dir=data_dir,
        config_dir=config_dir,
        host=os.environ.get("DIARY_HOST", "127.0.0.1"),
        port=int(os.environ.get("DIARY_PORT", "8125")),
        ai_read_token=os.environ.get("DIARY_AI_READ_TOKEN", credentials.get("DIARY_AI_READ_TOKEN", "")),
        ai_write_token=os.environ.get("DIARY_AI_WRITE_TOKEN", credentials.get("DIARY_AI_WRITE_TOKEN", "")),
        public_origin=os.environ.get("DIARY_PUBLIC_ORIGIN") or None,
    )


def setup(settings_value: Settings) -> Path:
    ensure_local_paths(settings_value, require_credentials=False)
    settings_value.config_dir.mkdir(parents=True, exist_ok=True, mode=0o700)
    settings_value.data_dir.mkdir(parents=True, exist_ok=True, mode=0o700)
    settings_value.config_dir.chmod(0o700)
    settings_value.data_dir.chmod(0o700)
    credentials_path = settings_value.config_dir / "credentials.env"
    required = {"DIARY_AI_READ_TOKEN", "DIARY_AI_WRITE_TOKEN"}
    if credentials_path.exists():
        missing = required - _read_credentials(credentials_path).keys()
        if missing:
            raise RuntimeError(f"credentials file is missing required values: {', '.join(sorted(missing))}")
    else:
        values = {
            "DIARY_AI_READ_TOKEN": secrets.token_urlsafe(32),
            "DIARY_AI_WRITE_TOKEN": secrets.token_urlsafe(32),
        }
        body = "\n".join(f"{key}={value}" for key, value in values.items()) + "\n"
        descriptor = os.open(credentials_path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(descriptor, "w", encoding="utf-8") as credentials_file:
            credentials_file.write(body)
    credentials_path.chmod(0o600)
    return credentials_path


def ensure_local_paths(settings_value: Settings, require_credentials: bool = True) -> None:
    if settings_value.host not in {"127.0.0.1", "::1", "localhost"}:
        raise ValueError("Diary only supports loopback binding; keep DIARY_HOST on localhost.")
    if not 1 <= settings_value.port <= 65535:
        raise ValueError("DIARY_PORT must be between 1 and 65535.")
    if settings_value.public_origin:
        try:
            public_origin = urlsplit(settings_value.public_origin)
            valid_origin = (
                public_origin.scheme == "https"
                and bool(public_origin.hostname)
                and bool(public_origin.netloc)
                and public_origin.username is None
                and public_origin.password is None
                and public_origin.path in {"", "/"}
                and not public_origin.query
                and not public_origin.fragment
            )
            public_origin.port
        except ValueError as error:
            raise ValueError("DIARY_PUBLIC_ORIGIN must be a valid HTTPS origin.") from error
        if not valid_origin:
            raise ValueError("DIARY_PUBLIC_ORIGIN must be a valid HTTPS origin.")
    for path in (settings_value.data_dir, settings_value.config_dir):
        resolved = path.resolve()
        if resolved == ROOT or ROOT in resolved.parents:
            raise ValueError("Diary data and credentials must stay outside the repository.")
    os.umask(0o077)
    settings_value.data_dir.mkdir(parents=True, exist_ok=True, mode=0o700)
    settings_value.data_dir.chmod(0o700)
    if require_credentials and (not settings_value.ai_read_token or not settings_value.ai_write_token):
        raise RuntimeError("Diary is not configured. Run `python3 -m diary setup` first.")
