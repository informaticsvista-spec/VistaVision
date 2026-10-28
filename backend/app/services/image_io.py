"""Safe image input: size limits, format checks, EXIF rotation, down-scaling.

Uploaded images are decoded in memory and never written to disk.
"""
from __future__ import annotations

import base64
import io

import cv2
import numpy as np
from fastapi import UploadFile
from PIL import Image, ImageOps, UnidentifiedImageError

from app.config import settings
from app.errors import ApiError

ALLOWED_FORMATS = {"JPEG", "PNG", "WEBP"}
Image.MAX_IMAGE_PIXELS = 40_000_000  # guards against decompression bombs


async def read_upload(file: UploadFile, max_side: int | None = None) -> np.ndarray:
    """Return the upload as a BGR uint8 array, or raise a friendly ApiError."""
    limit = settings.max_upload_bytes
    buffer = bytearray()
    while chunk := await file.read(1024 * 256):
        buffer.extend(chunk)
        if len(buffer) > limit:
            raise ApiError(413, "image_too_large", f"Image is larger than {limit // (1024 * 1024)} MB. Please use a smaller photo.")
    if not buffer:
        raise ApiError(400, "empty_file", "The uploaded file is empty.")
    return decode_image(bytes(buffer), max_side or settings.max_image_side)


def decode_image(data: bytes, max_side: int) -> np.ndarray:
    try:
        with Image.open(io.BytesIO(data)) as image:
            if image.format not in ALLOWED_FORMATS:
                raise ApiError(415, "unsupported_format", "Please upload a JPG, PNG or WebP image.")
            image = ImageOps.exif_transpose(image)
            rgb = image.convert("RGB")
    except ApiError:
        raise
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError, ValueError):
        raise ApiError(400, "invalid_image", "That file could not be read as an image.") from None

    array = np.asarray(rgb, dtype=np.uint8)
    height, width = array.shape[:2]
    if min(height, width) < 16:
        raise ApiError(400, "image_too_small", "The image is too small to analyse.")
    scale = max_side / max(height, width)
    if scale < 1:
        array = cv2.resize(array, (round(width * scale), round(height * scale)), interpolation=cv2.INTER_AREA)
    return cv2.cvtColor(array, cv2.COLOR_RGB2BGR)


def png_data_url(image: np.ndarray) -> str:
    ok, encoded = cv2.imencode(".png", image)
    if not ok:  # pragma: no cover
        raise ApiError(500, "encode_failed", "Could not prepare a preview image.")
    return "data:image/png;base64," + base64.b64encode(encoded.tobytes()).decode("ascii")
