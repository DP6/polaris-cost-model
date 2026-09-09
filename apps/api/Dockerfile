FROM python:3.12-slim AS base
ENV PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
WORKDIR /app

COPY pyproject.toml ./
RUN pip install --no-cache-dir uv && uv pip install --system --no-cache .

COPY src ./src
COPY recommendations.yaml ./recommendations.yaml

ENV PORT=8080
EXPOSE 8080
CMD ["sh", "-c", "uvicorn billing_api.main:app --host 0.0.0.0 --port ${PORT}"]
