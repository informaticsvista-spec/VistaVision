from __future__ import annotations

import cv2
import numpy as np
import onnxruntime as ort
from fastapi import APIRouter

from app import __version__
from app.config import settings
from app.services.model_store import store

router = APIRouter(tags=["health"])


@router.get("/health")
def health() -> dict:
    models = store.status()
    return {
        "status": "ok" if all(m["installed"] for m in models.values()) else "degraded",
        "version": __version__,
        "models": models,
        "limits": {"max_upload_mb": settings.max_upload_bytes // (1024 * 1024)},
        "runtime": {"opencv": cv2.__version__, "onnxruntime": ort.__version__, "numpy": np.__version__},
    }
