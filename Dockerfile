FROM python:3.12-alpine

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /opt/diary
COPY diary/ ./diary/
COPY docs/ ./docs/
COPY README.md ./README.md
COPY web/ ./web/
COPY tests/ ./tests/

EXPOSE 8125
CMD ["sh", "-c", "python3 -m diary setup && exec python3 -m diary serve"]
