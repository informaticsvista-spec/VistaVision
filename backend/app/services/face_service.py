"""Multi-face detection (YuNet) + visible-expression estimate (ensemble of two models).

Expression = weighted average of (1) a MobileFaceNet classifier trained on in-the-wild RAF-DB photos that
works on *aligned* faces (using YuNet's eye/nose/mouth landmarks, plus a mirrored second look), and (2) FER+.

Nothing here identifies anyone: no embeddings are computed or stored, and the
expression output is only an estimate of the *visible* expression.
"""
from __future__ import annotations

import threading
import time

import cv2
import numpy as np

from app.errors import ApiError
from app.services.model_store import ModelStore, store

# FER+ output order (ONNX Model Zoo): neutral, happiness, surprise, sadness, anger, disgust, fear, contempt
EXPRESSIONS = ["Neutral", "Happy", "Surprise", "Sad", "Angry", "Disgust", "Fear", "Contempt"]
# MobileFaceNet (RAF-DB) output order.
MFN_LABELS = ["Angry", "Disgust", "Fear", "Happy", "Neutral", "Sad", "Surprise"]
MFN_WEIGHT = 0.6  # share of the ensemble taken from the aligned-face model
# Standard 112x112 five-point face template (right eye, left eye, nose, right mouth corner, left mouth corner).
FACE_TEMPLATE = np.array([[38.2946, 51.6963], [73.5318, 51.5014], [56.0252, 71.7366], [41.5493, 92.3655], [70.7299, 92.2041]], np.float32)
DETECT_MAX_SIDE = 640
MIN_FACE_PIXELS = 24


TEMPERATURE = 1.8  # softens over-confident logits so "100%" is not shown for an estimate


def softmax(values: np.ndarray, temperature: float = TEMPERATURE) -> np.ndarray:
    values = values / temperature
    shifted = values - np.max(values)
    exp = np.exp(shifted)
    return exp / exp.sum()


class FaceService:
    def __init__(self, models: ModelStore = store):
        self._models = models
        self._detector: cv2.FaceDetectorYN | None = None
        self._lock = threading.Lock()  # YuNet's detector object is not thread-safe

    def _get_detector(self, width: int, height: int, score_threshold: float) -> cv2.FaceDetectorYN:
        if self._detector is None:
            path = self._models.path("face")
            if not path.is_file():
                raise ApiError(503, "model_missing", "The face model is not installed. Run: python -m app.models.download")
            self._detector = cv2.FaceDetectorYN.create(str(path), "", (width, height), score_threshold, 0.3, 50)
        self._detector.setInputSize((width, height))
        self._detector.setScoreThreshold(score_threshold)
        return self._detector

    def detect(self, image: np.ndarray, score_threshold: float = 0.6) -> list[dict]:
        height, width = image.shape[:2]
        scale = min(1.0, DETECT_MAX_SIDE / max(height, width))
        small = cv2.resize(image, (round(width * scale), round(height * scale)), interpolation=cv2.INTER_AREA) if scale < 1 else image
        sh, sw = small.shape[:2]
        with self._lock:
            detector = self._get_detector(sw, sh, score_threshold)
            _, found = detector.detect(small)
        faces = []
        if found is None:
            return faces
        for row in found:
            x, y, w, h = (float(v) for v in row[:4])
            x0, y0 = max(0.0, x), max(0.0, y)
            x1, y1 = min(float(sw), x + w), min(float(sh), y + h)
            if x1 - x0 < 2 or y1 - y0 < 2:
                continue
            faces.append(
                {
                    "pixel_box": (x0 / scale, y0 / scale, (x1 - x0) / scale, (y1 - y0) / scale),
                    "score": float(row[14]),
                    "landmarks": (row[4:14].reshape(5, 2) / scale).astype(np.float32),
                }
            )
        # Reading order: left to right, so "Face 01" is stable-ish in still images.
        faces.sort(key=lambda face: face["pixel_box"][0])
        return faces

    def _ferplus(self, image: np.ndarray, pixel_box: tuple[float, float, float, float]) -> dict[str, float] | None:
        height, width = image.shape[:2]
        x, y, w, h = pixel_box
        margin = 0.08  # FER+ was trained on slightly loose crops
        x0, y0 = int(max(0, x - w * margin)), int(max(0, y - h * margin))
        x1, y1 = int(min(width, x + w * (1 + margin))), int(min(height, y + h * (1 + margin)))
        if min(x1 - x0, y1 - y0) < MIN_FACE_PIXELS:
            return None
        crop = cv2.cvtColor(image[y0:y1, x0:x1], cv2.COLOR_BGR2GRAY)
        crop = cv2.resize(crop, (64, 64), interpolation=cv2.INTER_AREA).astype(np.float32)
        session = self._models.session("emotion")
        logits = session.run(None, {session.get_inputs()[0].name: crop[None, None]})[0][0]
        return dict(zip(EXPRESSIONS, softmax(logits.astype(np.float64))))

    def _aligned(self, image: np.ndarray, landmarks: np.ndarray) -> dict[str, float] | None:
        matrix, _ = cv2.estimateAffinePartial2D(landmarks, FACE_TEMPLATE, method=cv2.LMEDS)
        if matrix is None:
            return None
        face = cv2.warpAffine(image, matrix, (112, 112), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
        rgb = cv2.cvtColor(face, cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0
        batch = np.stack([rgb, rgb[:, ::-1]])  # original + mirrored view
        batch = ((batch - 0.5) / 0.5).transpose(0, 3, 1, 2).astype(np.float32)
        session = self._models.session("emotion2")
        name = session.get_inputs()[0].name
        probs = np.mean([softmax(session.run(None, {name: batch[i : i + 1]})[0][0].astype(np.float64)) for i in range(2)], axis=0)
        return dict(zip(MFN_LABELS, probs))

    def estimate_expression(self, image: np.ndarray, pixel_box: tuple[float, float, float, float], landmarks: np.ndarray | None = None) -> dict[str, float] | None:
        fer = self._ferplus(image, pixel_box)
        mfn = self._aligned(image, landmarks) if landmarks is not None and self._models.available("emotion2") else None
        if fer is None and mfn is None:
            return None
        if mfn is None:
            return {k: float(v) for k, v in fer.items()}
        if fer is None:
            return {name: float(mfn.get(name, 0.0)) for name in EXPRESSIONS}
        return {name: float(MFN_WEIGHT * mfn.get(name, 0.0) + (1 - MFN_WEIGHT) * fer[name]) for name in EXPRESSIONS}

    def analyze(
        self,
        image: np.ndarray,
        score_threshold: float = 0.6,
        uncertain_threshold: float = 0.45,
        max_faces: int = 20,
    ) -> dict:
        started = time.perf_counter()
        height, width = image.shape[:2]
        detected = self.detect(image, score_threshold)[:max_faces]
        faces = []
        for face in detected:
            x, y, w, h = face["pixel_box"]
            probabilities = self.estimate_expression(image, face["pixel_box"], face.get("landmarks"))
            if probabilities is None:
                expression = {"label": "Uncertain", "top_label": None, "confidence": 0.0, "uncertain": True, "probabilities": {}}
            else:
                top_label = max(probabilities, key=probabilities.get)
                confidence = probabilities[top_label]
                uncertain = confidence < uncertain_threshold
                expression = {
                    "label": "Uncertain" if uncertain else top_label,
                    "top_label": top_label,
                    "confidence": round(confidence, 4),
                    "uncertain": uncertain,
                    "probabilities": {k: round(v, 4) for k, v in probabilities.items()},
                }
            faces.append(
                {
                    "box": {"x": x / width, "y": y / height, "w": w / width, "h": h / height},
                    "detection_score": round(face["score"], 4),
                    "expression": expression,
                }
            )
        return {
            "image": {"width": width, "height": height},
            "face_count": len(faces),
            "faces": faces,
            "elapsed_ms": round((time.perf_counter() - started) * 1000, 1),
            "disclaimer": "Expressions are estimates of visible facial expression, not a measure of how anyone feels.",
        }


face_service = FaceService()
