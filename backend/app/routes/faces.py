from __future__ import annotations

from fastapi import APIRouter, File, Query, UploadFile
from fastapi.concurrency import run_in_threadpool

from app.services.face_service import face_service
from app.services.image_io import read_upload

router = APIRouter(prefix="/faces", tags=["faces"])


@router.post("/analyze")
async def analyze_faces(
    file: UploadFile = File(...),
    score_threshold: float = Query(0.6, ge=0.3, le=0.95, description="Minimum face-detection score"),
    uncertain_threshold: float = Query(0.45, ge=0.0, le=1.0, description="Expressions below this confidence are labelled Uncertain"),
    max_faces: int = Query(20, ge=1, le=50),
) -> dict:
    """Detect faces and estimate each visible expression. The image is processed in memory and discarded."""
    image = await read_upload(file, max_side=1280)
    return await run_in_threadpool(face_service.analyze, image, score_threshold, uncertain_threshold, max_faces)
