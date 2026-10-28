"""Turn a photo of paper (or a canvas drawing) into MNIST-style 28x28 digit tiles.

The MNIST classifier only works when its input looks like MNIST: a single white
digit on a black background, scaled to fit a 20x20 box and centred by its centre
of mass inside a 28x28 frame. This module does that for any number of digits:

1. grayscale + lighting normalisation (paper) or Otsu threshold (canvas)
2. connected-component grouping to find each digit, ignoring specks and page edges
3. stroke-width normalisation (pen lines on a webcam are thinner than MNIST's)
4. scale to 20 px, centre by centre of mass, return float tiles in [0, 1]

No model is needed here, so every step is unit-testable.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

import cv2
import numpy as np

from app.errors import ApiError

Source = Literal["paper", "canvas"]
Mode = Literal["single", "multi"]

WORK_MAX_SIDE = 900  # analysis resolution; keeps thresholds scale independent
MIN_DIGIT_HEIGHT_FRACTION = 0.035  # of the shorter image side; smaller blobs are treated as noise
RELATIVE_MIN_HEIGHT = 0.30  # a blob must be at least this tall relative to the tallest digit


@dataclass
class DigitCrop:
    box: tuple[int, int, int, int]  # x, y, w, h in the analysed image
    tile: np.ndarray  # 28x28 float32 in [0, 1], white digit on black
    ink_ratio: float


@dataclass
class PreprocessResult:
    crops: list[DigitCrop]
    mask: np.ndarray  # binary mask (uint8 0/255) at analysis resolution, for display
    size: tuple[int, int]  # (width, height) of the analysed image


def _binary_mask(gray: np.ndarray, source: Source) -> np.ndarray:
    if source == "canvas":
        blurred = cv2.GaussianBlur(gray, (3, 3), 0)
        _, mask = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY_INV | cv2.THRESH_OTSU)
        return mask

    # Paper: divide by an estimate of the paper brightness so shadows and uneven
    # lighting disappear, then Otsu-threshold the flattened image.
    height, width = gray.shape
    k = max(15, (min(height, width) // 25) | 1)
    background = cv2.medianBlur(cv2.dilate(gray, np.ones((7, 7), np.uint8)), k)
    flat = cv2.divide(gray, background, scale=255)
    flat = cv2.GaussianBlur(flat, (5, 5), 0)
    threshold, mask = cv2.threshold(flat, 0, 255, cv2.THRESH_BINARY_INV | cv2.THRESH_OTSU)
    # If even the "ink" is nearly as bright as the paper there is nothing written.
    if threshold > 235:
        return np.zeros_like(mask)
    return mask


def _group_components(mask: np.ndarray) -> list[tuple[int, int, int, int, np.ndarray]]:
    """Group nearby ink fragments into candidate digits. Returns (x, y, w, h, pixel_mask)."""
    height, width = mask.shape
    # Small on purpose: only joins broken pen strokes. Touching digits are separated by _split_wide.
    kernel_size = max(3, int(round(0.005 * min(height, width))) | 1)
    grouped = cv2.dilate(mask, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (kernel_size, kernel_size)))
    count, labels, stats, _ = cv2.connectedComponentsWithStats(grouped, connectivity=8)

    groups = []
    for index in range(1, count):
        x, y, w, h, area = (int(v) for v in stats[index])
        if area > 0.5 * height * width:
            continue  # table, page or shadow
        touches_border = x <= 1 or y <= 1 or x + w >= width - 1 or y + h >= height - 1
        if touches_border and (w > 0.45 * width or h > 0.45 * height):
            continue  # page edge or something cut off by the frame
        pixels = ((labels[y : y + h, x : x + w] == index) & (mask[y : y + h, x : x + w] > 0)).astype(np.uint8) * 255
        if cv2.countNonZero(pixels) < 12:
            continue
        groups.append((x, y, w, h, pixels))
    return groups


def _split_wide(group, max_aspect: float = 1.15) -> list:
    """Split a blob that is too wide to be one digit (digits that touch) at its thinnest columns."""
    x, y, w, h, pixels = group
    if w <= max_aspect * h:
        return [group]
    parts_wanted = max(2, int(round(w / (0.62 * h))))
    columns = np.convolve((pixels > 0).sum(axis=0).astype(float), np.ones(3) / 3, mode="same")
    segment = w / parts_wanted
    cuts = [0]
    for k in range(1, parts_wanted):
        centre = int(round(k * segment))
        lo = max(cuts[-1] + int(0.3 * h), centre - int(0.3 * segment))
        hi = min(w - 1, centre + int(0.3 * segment))
        if hi <= lo:
            continue
        cut = lo + int(np.argmin(columns[lo : hi + 1]))
        if columns[cut] <= 0.5 * columns.max():  # only cut at a real narrow neck
            cuts.append(cut)
    cuts.append(w)
    parts = []
    for a, b in zip(cuts[:-1], cuts[1:]):
        sub = pixels[:, a:b]
        ys, xs = np.nonzero(sub)
        if len(xs) < 12:
            continue
        parts.append((x + a + int(xs.min()), y + int(ys.min()), int(xs.max() - xs.min() + 1), int(ys.max() - ys.min() + 1),
                      sub[ys.min() : ys.max() + 1, xs.min() : xs.max() + 1].copy()))
    return parts if len(parts) > 1 else [group]


def _merge_overlapping(groups: list) -> list:
    """Merge pieces stacked on top of each other (e.g. a detached top bar)."""
    merged = True
    groups = list(groups)
    while merged:
        merged = False
        for i in range(len(groups)):
            for j in range(i + 1, len(groups)):
                xi, yi, wi, hi, _ = groups[i]
                xj, yj, wj, hj, _ = groups[j]
                overlap = min(xi + wi, xj + wj) - max(xi, xj)
                if overlap > 0.6 * min(wi, wj):
                    groups[i] = _union(groups[i], groups[j])
                    del groups[j]
                    merged = True
                    break
            if merged:
                break
    return groups


def _union(a, b):
    x0, y0 = min(a[0], b[0]), min(a[1], b[1])
    x1, y1 = max(a[0] + a[2], b[0] + b[2]), max(a[1] + a[3], b[1] + b[3])
    canvas = np.zeros((y1 - y0, x1 - x0), np.uint8)
    for x, y, w, h, pixels in (a, b):
        region = canvas[y - y0 : y - y0 + h, x - x0 : x - x0 + w]
        np.maximum(region, pixels, out=region)
    return (x0, y0, x1 - x0, y1 - y0, canvas)


def _normalise_stroke(pixels: np.ndarray) -> np.ndarray:
    """Bring pen thickness close to MNIST's (~13% of the digit's size)."""
    height, width = pixels.shape
    size = max(height, width)
    pad = max(4, size // 6)
    padded = cv2.copyMakeBorder(pixels, pad, pad, pad, pad, cv2.BORDER_CONSTANT, value=0)
    distance = cv2.distanceTransform(padded, cv2.DIST_L2, 3)
    foreground = distance[padded > 0]
    if foreground.size == 0:
        return padded
    stroke = 4.0 * float(foreground.mean())  # mean of a triangular profile is width / 4
    target = 0.13 * size
    if stroke < 0.8 * target:
        k = int(round(target - stroke)) + 1
        padded = cv2.dilate(padded, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k)))
    elif stroke > 1.6 * target:
        k = int(round(stroke - 1.3 * target)) + 1
        eroded = cv2.erode(padded, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k)))
        if cv2.countNonZero(eroded) > 0.25 * cv2.countNonZero(padded):
            padded = eroded
    return padded


def to_mnist_tile(pixels: np.ndarray) -> np.ndarray:
    """Binary digit pixels (uint8 0/255) -> 28x28 float32 tile, MNIST style."""
    adjusted = _normalise_stroke(pixels)
    ys, xs = np.nonzero(adjusted)
    adjusted = adjusted[ys.min() : ys.max() + 1, xs.min() : xs.max() + 1]
    height, width = adjusted.shape
    scale = 20.0 / max(height, width)
    new_w, new_h = max(1, round(width * scale)), max(1, round(height * scale))
    resized = cv2.resize(adjusted, (new_w, new_h), interpolation=cv2.INTER_AREA).astype(np.float32) / 255.0

    tile = np.zeros((28, 28), np.float32)
    y0, x0 = (28 - new_h) // 2, (28 - new_w) // 2
    tile[y0 : y0 + new_h, x0 : x0 + new_w] = resized

    total = tile.sum()
    if total > 0:
        rows, cols = np.indices(tile.shape)
        cy, cx = (rows * tile).sum() / total, (cols * tile).sum() / total
        shift = np.float32([[1, 0, 13.5 - cx], [0, 1, 13.5 - cy]])
        tile = cv2.warpAffine(tile, shift, (28, 28), flags=cv2.INTER_LINEAR, borderValue=0)
    return np.clip(tile, 0.0, 1.0)


def extract_digits(image_bgr: np.ndarray, source: Source = "paper", mode: Mode = "multi", max_digits: int = 8) -> PreprocessResult:
    height, width = image_bgr.shape[:2]
    scale = min(1.0, WORK_MAX_SIDE / max(height, width))
    if scale < 1:
        image_bgr = cv2.resize(image_bgr, (round(width * scale), round(height * scale)), interpolation=cv2.INTER_AREA)
    gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
    h, w = gray.shape

    mask = _binary_mask(gray, source)
    groups = _group_components(mask)
    groups = [g for g in groups if g[3] >= MIN_DIGIT_HEIGHT_FRACTION * min(h, w)]
    if groups:
        tallest = max(g[3] for g in groups)
        groups = [g for g in groups if g[3] >= RELATIVE_MIN_HEIGHT * tallest]
    if not groups:
        raise ApiError(
            422,
            "no_digit_found",
            "No handwriting was found. Use a dark pen, write large, and fill most of the frame.",
        )

    if mode == "single":
        combined = groups[0]
        for group in groups[1:]:
            combined = _union(combined, group)
        groups = [combined]
    else:
        groups = _merge_overlapping(groups)
        groups = [part for group in groups for part in _split_wide(group)]
        groups.sort(key=lambda g: g[0])
        if len(groups) > max_digits:
            raise ApiError(422, "too_many_digits", f"I found {len(groups)} separate marks. Try up to {max_digits} digits, or crop closer.")

    crops = []
    for x, y, bw, bh, pixels in groups:
        ink_ratio = cv2.countNonZero(pixels) / float(bw * bh)
        crops.append(DigitCrop(box=(x, y, bw, bh), tile=to_mnist_tile(pixels), ink_ratio=float(ink_ratio)))
    return PreprocessResult(crops=crops, mask=mask, size=(w, h))
