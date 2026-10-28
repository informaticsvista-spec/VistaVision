# One container serving both the API and the web app. Works on Hugging Face Spaces (free), Render, Fly.io, Cloud Run...
# Build from the repository root:  docker build -t vistavision .   then   docker run -p 7860:7860 vistavision
FROM node:22-slim AS web
WORKDIR /web
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend ./
RUN npm run build

FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 VISTA_FRONTEND_DIST=/srv/dist PORT=7860
RUN apt-get update && apt-get install -y --no-install-recommends libglib2.0-0 libgomp1 && rm -rf /var/lib/apt/lists/*
WORKDIR /srv
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/app ./app
RUN python -m app.models.download
COPY --from=web /web/dist ./dist
# Hugging Face Spaces runs containers as user 1000; the files above are world-readable, nothing is written at run time.
RUN useradd -m -u 1000 user
USER user
EXPOSE 7860
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-7860}"]
