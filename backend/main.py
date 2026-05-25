"""VisionAI IXP backend.

Run (dev):    python -m uvicorn backend.main:app --reload --port 8000
Run (build):  python -m uvicorn backend.main:app --port 8000
              (then open http://localhost:8000 — serves frontend/dist)
"""
from __future__ import annotations
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.responses import FileResponse, JSONResponse

from .routes import connection, extract, llm


app = FastAPI(title="VisionAI IXP", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(connection.router)
app.include_router(extract.router)
app.include_router(llm.router)


@app.get("/api/health")
def health():
    return {"ok": True, "service": "visionai-ixp"}


# Serve the built frontend if it exists. In dev mode use `npm run dev` instead.
_REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_DIST = os.path.join(_REPO, "frontend", "dist")
if os.path.isdir(_DIST):
    app.mount("/assets", StaticFiles(directory=os.path.join(_DIST, "assets")), name="assets")

    @app.get("/")
    def root():
        return FileResponse(os.path.join(_DIST, "index.html"))

    @app.get("/{path:path}")
    def spa_fallback(path: str):
        # Serve specific built files; otherwise fall back to index.html for SPA routing
        candidate = os.path.join(_DIST, path)
        if os.path.isfile(candidate):
            return FileResponse(candidate)
        return FileResponse(os.path.join(_DIST, "index.html"))
else:
    @app.get("/")
    def root_dev():
        return JSONResponse({
            "ok": True,
            "note": "Frontend not built. Run `cd frontend && npm install && npm run dev` (http://localhost:5173) or `npm run build`.",
        })
