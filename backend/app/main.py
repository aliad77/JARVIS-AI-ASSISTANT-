"""FastAPI application factory.

Run locally with ``python -m app`` (binds to 127.0.0.1 only). When a built
frontend exists at ``frontend/dist`` it is served from ``/``; during
development the Vite dev server proxies ``/api`` here instead.
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from app import __version__
from app.api import routes_core, routes_learning
from app.config import PROJECT_DIR, Settings, get_settings
from app.security.guard import LocalGuardMiddleware
from app.services import Services, build_services

log = logging.getLogger("jarvis")

FRONTEND_DIST = PROJECT_DIR / "frontend" / "dist"

_NOT_BUILT_PAGE = """<!doctype html><html lang="en"><head><meta charset="utf-8"><title>JARVIS</title>
<style>body{background:#0B0B10;color:#F5F5F7;font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0}
main{max-width:560px;padding:24px;border:2px solid #FF4058;background:#15151F}code{color:#FF6979}</style></head>
<body><main><h1>JARVIS backend is online</h1><p>The web interface has not been built yet.</p>
<p>For development, start the frontend dev server (<code>start-jarvis-dev.bat</code>) and open
<code>http://localhost:5173</code>.</p></main></body></html>"""


def create_app(settings: Settings | None = None, services: Services | None = None) -> FastAPI:
    settings = settings or get_settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        yield
        app.state.services.close()

    app = FastAPI(title="JARVIS", version=__version__, lifespan=lifespan,
                  docs_url=None, redoc_url=None, openapi_url=None)
    app.state.services = services or build_services(settings)

    app.add_middleware(
        LocalGuardMiddleware,
        allowed_hosts=settings.allowed_hosts(),
        allowed_origins=settings.allowed_origins(),
        token=app.state.services.token,
    )

    @app.exception_handler(RequestValidationError)
    async def _validation_error(_request: Request, exc: RequestValidationError) -> JSONResponse:
        # Keep messages short and never echo large inputs back.
        problems = [f"{'.'.join(str(p) for p in e.get('loc', [])[1:])}: {e.get('msg')}" for e in exc.errors()[:5]]
        return JSONResponse({"detail": "Invalid request.", "problems": problems}, status_code=422)

    @app.exception_handler(Exception)
    async def _unexpected(_request: Request, exc: Exception) -> JSONResponse:
        log.exception("Unhandled error: %s", exc)
        return JSONResponse({"detail": "JARVIS hit an unexpected error. Please try again."}, status_code=500)

    app.include_router(routes_core.router)
    app.include_router(routes_learning.router)

    _mount_frontend(app, FRONTEND_DIST)
    return app


def _mount_frontend(app: FastAPI, dist: Path) -> None:
    index = dist / "index.html"
    if not index.is_file():
        @app.get("/", include_in_schema=False)
        def _not_built() -> HTMLResponse:
            return HTMLResponse(_NOT_BUILT_PAGE)
        return

    assets = dist / "assets"
    if assets.is_dir():
        app.mount("/assets", StaticFiles(directory=assets), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    def _spa(path: str) -> FileResponse:
        if path == "api" or path.startswith("api/"):
            raise HTTPException(404, "Not found.")
        candidate = (dist / path).resolve()
        if path and candidate.is_file() and dist.resolve() in candidate.parents:
            return FileResponse(candidate)
        return FileResponse(index)
