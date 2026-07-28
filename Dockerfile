# syntax=docker/dockerfile:1

# --- Frontend build ---
FROM node:20-alpine AS frontend
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# --- API + static UI ---
FROM python:3.12-slim AS app
WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    STATIC_DIR=/app/frontend/dist \
    DB_PATH=/app/data/studio.db \
    BACKEND_HOST=0.0.0.0 \
    BACKEND_PORT=8000 \
    CORS_ORIGINS=*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY api/ ./api/
COPY --from=frontend /app/frontend/dist ./frontend/dist

RUN mkdir -p /app/data /app/content-queue /app/content-archive /app/products_contexts

EXPOSE 8000

CMD ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8000"]
