FROM python:3.12-alpine

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /opt/diary
COPY diary/ ./diary/
COPY docs/ ./docs/
COPY README.md ./README.md
COPY RELEASE-NOTES.md ./RELEASE-NOTES.md
COPY web/ ./web/
COPY tests/ ./tests/
COPY mcp/src/diary_mcp/config.py ./mcp/src/diary_mcp/config.py
COPY e2e/specs/diary.spec.js ./e2e/specs/diary.spec.js

EXPOSE 8125
CMD ["sh", "-c", "python3 -m diary setup && exec python3 -m diary serve"]
