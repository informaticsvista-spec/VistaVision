from __future__ import annotations

from fastapi import APIRouter, File, Query, UploadFile
from fastapi.concurrency import run_in_threadpool

from app.services.image_io import read_upload
from app.services.object_service import COCO_LABELS, object_service

router = APIRouter(prefix="/objects", tags=["objects"])


@router.get("/labels")
def supported_labels() -> dict:
    """The complete list of object types the model can name."""
    return {"count": len(COCO_LABELS), "labels": COCO_LABELS}


@router.post("/detect")
async def detect_objects(
    file: UploadFile = File(...),
    min_score: float = Query(0.4, ge=0.1, le=0.95),
    max_results: int = Query(12, ge=1, le=30),
) -> dict:
    image = await read_upload(file, max_side=1280)
    return await run_in_threadpool(object_service.detect, image, min_score, max_results)
