"""Runtime configuration, read from environment variables.

Every setting has a safe default so `uvicorn app.main:app` works out of the box.
"""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path


def _csv(value: str) -> list[str]:
    return [item.strip() for item in value.split(",") if item.strip()]


@dataclass(frozen=True)
class Settings:
    # Where model weights live (see app/models/download.py).
    weights_dir: Path = field(
        default_factory=lambda: Path(
            os.environ.get("VISTA_WEIGHTS_DIR", Path(__file__).parent / "models" / "weights")
        )
    )
    # Browsers allowed to call the API. Use your real frontend origin in production.
    cors_origins: list[str] = field(
        default_factory=lambda: _csv(
            os.environ.get(
                "VISTA_CORS_ORIGINS",
                "http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173",
            )
        )
    )
    # Optional regex, handy for preview deployments (e.g. https://.*\.vercel\.app).
    cors_origin_regex: str | None = field(default_factory=lambda: os.environ.get("VISTA_CORS_ORIGIN_REGEX"))
    max_upload_bytes: int = field(
        default_factory=lambda: int(os.environ.get("VISTA_MAX_UPLOAD_MB", "8")) * 1024 * 1024
    )
    # Images larger than this (longest side) are shrunk before inference.
    max_image_side: int = field(default_factory=lambda: int(os.environ.get("VISTA_MAX_IMAGE_SIDE", "2048")))
    # Optional: folder with the built frontend (frontend/dist). When set, the API also serves the web app,
    # so one HTTPS service is enough for a whole classroom deployment.
    frontend_dist: Path | None = field(
        default_factory=lambda: Path(os.environ["VISTA_FRONTEND_DIST"]) if os.environ.get("VISTA_FRONTEND_DIST") else None
    )
    # onnxruntime intra-op threads. 0 lets the runtime decide.
    ort_threads: int = field(default_factory=lambda: int(os.environ.get("VISTA_ORT_THREADS", "0")))


settings = Settings()
