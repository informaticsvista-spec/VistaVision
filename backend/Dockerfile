# VistaVision API container. Build from the backend/ folder:  docker build -t vistavision-api .
FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /srv
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app ./app
# Fetch and checksum-verify the four pretrained models at build time.
RUN python -m app.models.download
EXPOSE 8000
# Most hosts inject $PORT; fall back to 8000 locally.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
