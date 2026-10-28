"""Object detection with YOLOX-S trained on the 80 COCO categories.

The model can only name things from its fixed label list (see COCO_LABELS).
It includes apples, bananas and oranges, but it cannot recognise every object.
YOLOX-S is roughly twice as accurate as the SSD MobileNet v1 model used in the first version.
"""
from __future__ import annotations

import time

import cv2
import numpy as np

from app.services.model_store import ModelStore, store

_COCO = (
    "person bicycle car motorcycle airplane bus train truck boat traffic_light fire_hydrant stop_sign "
    "parking_meter bench bird cat dog horse sheep cow elephant bear zebra giraffe backpack umbrella "
    "handbag tie suitcase frisbee skis snowboard sports_ball kite baseball_bat baseball_glove skateboard surfboard "
    "tennis_racket bottle wine_glass cup fork knife spoon bowl banana apple sandwich orange broccoli carrot "
    "hot_dog pizza donut cake chair couch potted_plant bed dining_table toilet tv laptop mouse "
    "remote keyboard cell_phone microwave oven toaster sink refrigerator book clock vase scissors teddy_bear "
    "hair_drier toothbrush"
).split()
assert len(_COCO) == 80, len(_COCO)


def pretty(name: str) -> str:
    return name.replace("_", " ").capitalize()


LABELS: list[str] = [pretty(n) for n in _COCO]  # index = YOLOX class id
LABEL_BY_ID: dict[int, str] = dict(enumerate(LABELS))
COCO_LABELS: list[str] = sorted(set(LABELS))

INPUT = 640
STRIDES = (8, 16, 32)


def _grid() -> tuple[np.ndarray, np.ndarray]:
    grids, strides = [], []
    for stride in STRIDES:
        n = INPUT // stride
        xv, yv = np.meshgrid(np.arange(n), np.arange(n))
        grids.append(np.stack((xv, yv), 2).reshape(-1, 2))
        strides.append(np.full((n * n, 1), stride))
    return np.concatenate(grids).astype(np.float32), np.concatenate(strides).astype(np.float32)


_GRID, _STRIDE = _grid()


def letterbox(rgb: np.ndarray) -> tuple[np.ndarray, float]:
    """Resize keeping the aspect ratio and pad bottom/right with grey, as YOLOX expects."""
    height, width = rgb.shape[:2]
    ratio = min(INPUT / height, INPUT / width)
    resized = cv2.resize(rgb, (int(width * ratio), int(height * ratio)), interpolation=cv2.INTER_LINEAR)
    canvas = np.full((INPUT, INPUT, 3), 114, np.uint8)
    canvas[: resized.shape[0], : resized.shape[1]] = resized
    return canvas, ratio


def decode(output: np.ndarray, ratio: float, min_score: float, nms_iou: float = 0.45) -> list[tuple[float, float, float, float, float, int]]:
    """Raw YOLOX output (8400, 85) -> list of (x0, y0, x1, y1, score, class_id) in original pixels."""
    boxes = output.copy()
    boxes[:, :2] = (boxes[:, :2] + _GRID) * _STRIDE
    boxes[:, 2:4] = np.exp(boxes[:, 2:4]) * _STRIDE
    class_scores = boxes[:, 5:] * boxes[:, 4:5]
    class_ids = class_scores.argmax(1)
    scores = class_scores[np.arange(len(class_ids)), class_ids]
    keep = scores >= min_score
    if not keep.any():
        return []
    cx, cy, w, h = boxes[keep, 0], boxes[keep, 1], boxes[keep, 2], boxes[keep, 3]
    xywh = np.stack([cx - w / 2, cy - h / 2, w, h], 1) / ratio
    scores, class_ids = scores[keep], class_ids[keep]
    # Class-aware NMS: offset boxes of different classes so they never suppress each other.
    offset = class_ids[:, None] * 10000.0
    indices = cv2.dnn.NMSBoxes((xywh + np.hstack([offset, offset * 0, offset * 0, offset * 0])).tolist(), scores.tolist(), min_score, nms_iou)
    result = []
    for i in np.array(indices).reshape(-1):
        x, y, bw, bh = xywh[i]
        result.append((float(x), float(y), float(x + bw), float(y + bh), float(scores[i]), int(class_ids[i])))
    return result


class ObjectService:
    def __init__(self, models: ModelStore = store):
        self._models = models

    def detect(self, image_bgr: np.ndarray, min_score: float = 0.35, max_results: int = 12) -> dict:
        started = time.perf_counter()
        height, width = image_bgr.shape[:2]
        rgb = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)
        canvas, ratio = letterbox(rgb)
        blob = np.ascontiguousarray(canvas.transpose(2, 0, 1)[None].astype(np.float32))

        session = self._models.session("object")
        output = session.run(None, {session.get_inputs()[0].name: blob})[0][0]

        detections = []
        for x0, y0, x1, y1, score, class_id in decode(output, ratio, min_score):
            x0, y0 = max(0.0, x0), max(0.0, y0)
            x1, y1 = min(float(width), x1), min(float(height), y1)
            if x1 - x0 < 4 or y1 - y0 < 4:
                continue
            detections.append(
                {
                    "label": LABEL_BY_ID[class_id],
                    "class_id": class_id,
                    "confidence": round(score, 4),
                    "box": {"x": x0 / width, "y": y0 / height, "w": (x1 - x0) / width, "h": (y1 - y0) / height},
                }
            )
        detections.sort(key=lambda d: d["confidence"], reverse=True)
        detections = detections[:max_results]
        return {
            "image": {"width": width, "height": height},
            "detections": detections,
            "count": len(detections),
            "elapsed_ms": round((time.perf_counter() - started) * 1000, 1),
            "note": "The model recognises 80 common object types only. Anything else may be missed or mislabelled.",
        }


object_service = ObjectService()
