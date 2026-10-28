from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, File, Query, UploadFile
from fastapi.concurrency import run_in_threadpool

from app.services.digit_service import digit_service
from app.services.image_io import read_upload

router = APIRouter(prefix="/digits", tags=["digits"])


@router.post("/recognize")
async def recognize_digits(
    file: UploadFile = File(...),
    source: Literal["paper", "canvas"] = Query("paper", description="paper = photo of handwriting, canvas = on-screen drawing"),
    mode: Literal["single", "multi"] = Query("multi", description="single = treat all ink as one digit; multi = split into digits"),
) -> dict:
    """Preprocess the image to MNIST format and classify each digit."""
    image = await read_upload(file)
    return await run_in_threadpool(digit_service.recognize, image, source, mode)
