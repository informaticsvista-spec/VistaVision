"""VistaVision API entry point:  uvicorn app.main:app --reload"""
from __future__ import annotations

import logging
import threading
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware

from app import __version__
from app.config import settings
from app.errors import install_error_handlers
from app.routes import digits, faces, health, objects


def _warm_up() -> None:
    """Load every installed model once in the background, so the first request is not slow."""
    from app.models.manifest import MODELS
    from app.services.model_store import store

    for key in MODELS:
        try:
            if store.available(key) and key != "face":
                store.session(key)
        except Exception:  # noqa: BLE001 - warm-up must never stop the server
            logging.getLogger("vistavision").exception("could not pre-load model %s", key)


@asynccontextmanager
async def lifespan(_: FastAPI):
    threading.Thread(target=_warm_up, name="model-warmup", daemon=True).start()
    yield


def create_app() -> FastAPI:
    app = FastAPI(
        lifespan=lifespan,
        title="VistaVision API",
        version=__version__,
        description="Face/expression, handwritten digit and object recognition for classroom demos. "
        "Images are processed in memory and are never stored.",
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_origin_regex=settings.cors_origin_regex,
        allow_methods=["GET", "POST"],
        allow_headers=["*"],
        max_age=600,
    )
    install_error_handlers(app)
    for router in (health.router, faces.router, digits.router, objects.router):
        app.include_router(router, prefix="/api")
    _mount_frontend(app)
    return app


def _mount_frontend(app: FastAPI) -> None:
    """Serve the built single-page app (optional) with an index.html fallback for client-side routes."""
    dist = settings.frontend_dist
    if not dist or not (dist / "index.html").is_file():
        return
    root = dist.resolve()

    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str) -> FileResponse:
        if path.startswith("api/") or path == "api":
            raise HTTPException(status_code=404)
        candidate = (root / path).resolve()
        if path and candidate.is_file() and root in candidate.parents:
            return FileResponse(candidate)
        return FileResponse(root / "index.html")


app = create_app()
