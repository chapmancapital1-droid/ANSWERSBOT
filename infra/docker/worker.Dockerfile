FROM python:3.12-slim AS base
ENV PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
      build-essential libpq-dev curl \
    && rm -rf /var/lib/apt/lists/*
COPY apps/workers/pyproject.toml ./
RUN pip install --upgrade pip && pip install -e ".[dev]" || pip install -e .
COPY apps/workers/ ./
RUN useradd -m -u 1001 celery
USER celery
# Default: runner queue (scan jobs). Override in compose for beat.
CMD ["celery", "-A", "answerspot_workers.celery_app", "worker", "-Q", "runner,celery", "--loglevel=info", "--concurrency=4"]
