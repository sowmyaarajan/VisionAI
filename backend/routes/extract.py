from __future__ import annotations
import asyncio
import json
import time
from typing import Any, Dict, Optional

from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from starlette.responses import StreamingResponse

from ..schemas import IxpConfig
from ..ixp_service import run_pipeline
from ..adapters import uipath_to_ui


router = APIRouter(prefix="/api/extract", tags=["extract"])


def _sse(event: str, data: Any) -> bytes:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n".encode("utf-8")


@router.post("")
async def extract(file: UploadFile = File(...), config: str = Form(...)):
    """Multipart upload + JSON 'config' string.

    Streams SSE frames:
      event: step   data: {step, status, detail, ms}
      event: result data: <UI-shaped extraction JSON>
      event: done   data: {ms}
      event: error  data: {message, step?}
    """
    try:
        cfg_obj = IxpConfig(**json.loads(config))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid config: {e}")

    resolved = cfg_obj.resolved()
    if not (resolved["client_id"] and resolved["client_secret"] and resolved["org_name"] and resolved["project_name"]):
        raise HTTPException(status_code=400, detail="Missing client_id/secret, org, or project_name.")

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Empty file.")
    filename = file.filename or "document.pdf"
    size_bytes = len(file_bytes)

    queue: asyncio.Queue = asyncio.Queue()
    loop = asyncio.get_running_loop()

    def on_step(step: str, status: str, detail: str, ms: Optional[int]) -> None:
        # Thread-safe push from the worker thread
        payload = {"step": step, "status": status, "detail": detail, "ms": ms}
        loop.call_soon_threadsafe(queue.put_nowait, ("step", payload))

    async def worker():
        t_start = time.time()
        try:
            extraction, durations = await asyncio.to_thread(
                run_pipeline, resolved, file_bytes, filename, on_step
            )
            elapsed = int((time.time() - t_start) * 1000)
            ui = uipath_to_ui(
                extraction,
                filename=filename,
                size_bytes=size_bytes,
                processed_ms=elapsed,
                project_name=resolved.get("project_name", ""),
            )
            await queue.put(("result", ui))
            await queue.put(("done", {"ms": elapsed, "durations": durations}))
        except Exception as e:
            await queue.put(("error", {"message": str(e)}))
        finally:
            await queue.put(("__end__", None))

    async def event_stream():
        task = asyncio.create_task(worker())
        try:
            while True:
                event, data = await queue.get()
                if event == "__end__":
                    break
                yield _sse(event, data)
        finally:
            if not task.done():
                task.cancel()

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )
