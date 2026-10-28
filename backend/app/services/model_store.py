"""Lazy, thread-safe loading of ONNX sessions.

Models are only loaded when their task is first used, so a school laptop that
only runs the digit demo never pays for the object detector's memory.
"""
from __future__ import annotations

import threading
from pathlib import Path

import onnxruntime as ort

from app.config import settings
from app.errors import ApiError
from app.models.manifest import MODELS


BUNDLED_DIR = Path(__file__).resolve().parent.parent / "models" / "bundled"


class ModelStore:
    def __init__(self, weights_dir: Path | None = None):
        self.weights_dir = weights_dir or settings.weights_dir
        self._sessions: dict[str, ort.InferenceSession] = {}
        self._lock = threading.Lock()

    def path(self, key: str) -> Path:
        spec = MODELS[key]
        return (BUNDLED_DIR if spec.bundled else self.weights_dir) / spec.filename

    def available(self, key: str) -> bool:
        return self.path(key).is_file()

    def session(self, key: str) -> ort.InferenceSession:
        with self._lock:
            if key in self._sessions:
                return self._sessions[key]
            path = self.path(key)
            if not path.is_file():
                raise ApiError(
                    503,
                    "model_missing",
                    f"The {key} model is not installed on the server. Run: python -m app.models.download",
                )
            options = ort.SessionOptions()
            if settings.ort_threads > 0:
                options.intra_op_num_threads = settings.ort_threads
            options.log_severity_level = 3
            session = ort.InferenceSession(str(path), options, providers=["CPUExecutionProvider"])
            self._sessions[key] = session
            return session

    def status(self) -> dict[str, dict[str, object]]:
        return {
            key: {"installed": self.available(key), "loaded": key in self._sessions, "purpose": spec.purpose}
            for key, spec in MODELS.items()
        }


store = ModelStore()
