from __future__ import annotations

import cv2
import numpy as np
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.model_store import store


def models_installed(*keys: str) -> bool:
    return all(store.available(key) for key in keys)


def render_digits(text: str, font=cv2.FONT_HERSHEY_DUPLEX, thickness: int = 10, size: float = 4.0, paper: bool = False) -> np.ndarray:
    """Draw dark digits on white (canvas) or on shaded, noisy 'paper' (camera-like)."""
    width, height = 900, 500
    image = np.full((height, width, 3), 255, np.uint8)
    (text_w, text_h), _ = cv2.getTextSize(text, font, size, thickness)
    cv2.putText(image, text, ((width - text_w) // 2, (height + text_h) // 2), font, size, (20, 20, 20), thickness, cv2.LINE_AA)
    if paper:
        rng = np.random.default_rng(0)
        shading = np.linspace(170, 245, width)[None, :, None] * np.ones((height, 1, 1))
        image = (image.astype(np.float32) / 255 * shading).astype(np.uint8)
        image = np.clip(image + rng.normal(0, 6, image.shape), 0, 255).astype(np.uint8)
        image = cv2.GaussianBlur(image, (5, 5), 0)
    return image


def jpeg(image: np.ndarray) -> bytes:
    ok, buffer = cv2.imencode(".jpg", image)
    assert ok
    return buffer.tobytes()


@pytest.fixture(scope="session")
def client() -> TestClient:
    return TestClient(app)
