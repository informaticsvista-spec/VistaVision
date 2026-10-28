"""Handwritten digit recognition: an ensemble of the VistaVision CNN (augmented MNIST + font digits) and the MNIST ONNX model."""
from __future__ import annotations

import time

import cv2
import numpy as np

from app.services.digit_preprocess import Mode, Source, extract_digits
from app.services.image_io import png_data_url
from app.services.model_store import ModelStore, store

LOW_CONFIDENCE = 0.6
VISTA_WEIGHT = 0.8  # share of the ensemble taken from the VistaVision CNN when it is installed
SHIFTS = ((0, 0), (1, 0), (-1, 0), (0, 1), (0, -1))  # test-time averaging over 1-pixel shifts


def softmax(values: np.ndarray) -> np.ndarray:
    exp = np.exp(values - values.max())
    return exp / exp.sum()


class DigitService:
    def __init__(self, models: ModelStore = store):
        self._models = models

    def _run(self, key: str, batch: np.ndarray) -> np.ndarray:
        session = self._models.session(key)
        spec = session.get_inputs()[0]
        if isinstance(spec.shape[0], int):  # the original MNIST model only accepts one image per call
            logits = np.vstack([session.run(None, {spec.name: batch[i : i + 1]})[0] for i in range(len(batch))]).astype(np.float64)
        else:
            logits = session.run(None, {spec.name: batch})[0].astype(np.float64)
        logits -= logits.max(axis=1, keepdims=True)
        exp = np.exp(logits)
        return exp / exp.sum(axis=1, keepdims=True)

    def predict_tiles(self, tiles: list[np.ndarray]) -> np.ndarray:
        """Return an (n, 10) probability matrix: ensemble of models, each averaged over tiny shifts."""
        base = np.stack(tiles)[:, None].astype(np.float32)
        views = np.concatenate([np.roll(base, shift, axis=(2, 3)) for shift in SHIFTS])  # tiles have empty borders, so rolling is a pure shift
        n = len(tiles)

        def averaged(key: str) -> np.ndarray:
            probs = self._run(key, views)
            return probs.reshape(len(SHIFTS), n, 10).mean(axis=0)

        reference = averaged("digit")
        if not self._models.available("digit2"):
            return reference
        return VISTA_WEIGHT * averaged("digit2") + (1 - VISTA_WEIGHT) * reference

    def recognize(self, image_bgr: np.ndarray, source: Source = "paper", mode: Mode = "multi") -> dict:
        started = time.perf_counter()
        processed = extract_digits(image_bgr, source=source, mode=mode)
        probabilities = self.predict_tiles([crop.tile for crop in processed.crops])
        width, height = processed.size

        digits = []
        for crop, probs in zip(processed.crops, probabilities):
            order = np.argsort(probs)[::-1]
            x, y, w, h = crop.box
            tile_preview = cv2.resize((crop.tile * 255).astype(np.uint8), (112, 112), interpolation=cv2.INTER_NEAREST)
            digits.append(
                {
                    "digit": int(order[0]),
                    "confidence": round(float(probs[order[0]]), 4),
                    "alternatives": [
                        {"digit": int(i), "probability": round(float(probs[i]), 4)} for i in order[1:4]
                    ],
                    "box": {"x": x / width, "y": y / height, "w": w / width, "h": h / height},
                    "tile_png": png_data_url(tile_preview),
                }
            )

        confidences = [d["confidence"] for d in digits]
        mask_scale = min(1.0, 360 / max(width, height))
        mask_preview = cv2.resize(processed.mask, (round(width * mask_scale), round(height * mask_scale)), interpolation=cv2.INTER_AREA)
        return {
            "number": "".join(str(d["digit"]) for d in digits),
            "digit_count": len(digits),
            "digits": digits,
            "mean_confidence": round(float(np.mean(confidences)), 4),
            "min_confidence": round(float(np.min(confidences)), 4),
            "low_confidence": bool(np.min(confidences) < LOW_CONFIDENCE),
            "image": {"width": width, "height": height},
            "mask_png": png_data_url(255 - mask_preview),  # dark ink on white, easier to read
            "elapsed_ms": round((time.perf_counter() - started) * 1000, 1),
        }


digit_service = DigitService()
