"""Thin orchestration wrapper around the existing uipath_ixp_extraction.py functions.

Reuses get_token / digitize_document / get_project_id / get_extractor_id / run_extraction
directly so backend == script for the 5 IXP steps.
"""
from __future__ import annotations

import os
import sys
import time
import json
import tempfile
import importlib.util
from typing import Callable, Optional, Tuple, Dict, Any


_THIS_DIR = os.path.dirname(os.path.abspath(__file__))
_REPO_DIR = os.path.dirname(_THIS_DIR)


def _load_script():
    """Load uipath_ixp_extraction.py without executing its __main__ guard.

    The script reads UIPATH_CLIENT_ID / UIPATH_CLIENT_SECRET at import time and
    sys.exit()s when missing. We set safe placeholders before import; real
    credentials come from the per-request config and are passed into each call.
    """
    os.environ.setdefault("UIPATH_CLIENT_ID", "placeholder")
    os.environ.setdefault("UIPATH_CLIENT_SECRET", "placeholder")
    script_path = os.path.join(_REPO_DIR, "uipath_ixp_extraction.py")
    spec = importlib.util.spec_from_file_location("uipath_ixp_extraction", script_path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)  # type: ignore
    return mod


_script = _load_script()
get_token = _script.get_token
digitize_document = _script.digitize_document
get_project_id = _script.get_project_id
get_extractor_id = _script.get_extractor_id
run_extraction = _script.run_extraction


StepCallback = Callable[[str, str, str, Optional[int]], None]
# step_key in {auth, digitize, project, extractor, extract, parse}
# status   in {pending, active, done, error}


def test_connection(config: Dict[str, Any]) -> Dict[str, Any]:
    """Validate creds + (optionally) resolve project/extractor IDs.

    Returns a normalized dict matching TestConnectionResponse shape.
    """
    try:
        token = get_token(config)
    except Exception as e:
        return {"ok": False, "error": str(e)}

    expires_in: Optional[int] = None
    # Best-effort extract expires_in from a fresh token call so the UI can show it
    try:
        import requests
        r = requests.post(
            f"{config['base_url']}/{config['org_name']}/identity_/connect/token",
            data={
                "grant_type": "client_credentials",
                "client_id": config["client_id"],
                "client_secret": config["client_secret"],
                "scope": config["scope"],
            },
            timeout=20,
        )
        if r.status_code == 200:
            expires_in = int(r.json().get("expires_in") or 0) or None
    except Exception:
        pass

    out: Dict[str, Any] = {"ok": True, "tokenExpiresIn": expires_in}

    project_name = (config.get("project_name") or "").strip()
    if not project_name:
        return out

    try:
        project_id = get_project_id(config, token, project_name)
        out["projectId"] = project_id
        try:
            out["extractorId"] = get_extractor_id(config, token, project_id)
        except Exception as e:
            out["error"] = f"Project found but extractor lookup failed: {e}"
        return out
    except Exception as e:
        # Surface available IXP project names so the user can fix the typo
        import requests
        try:
            r = requests.get(
                f"{config['base_url']}/{config['org_name']}/{config['tenant_name']}"
                f"/du_/api/framework/projects?api-version=1.1",
                headers={"Authorization": f"Bearer {token}"},
                timeout=20,
            )
            if r.status_code == 200:
                projs = r.json().get("projects", [])
                out["availableProjects"] = [p["name"] for p in projs if p.get("type") == "IXP"]
        except Exception:
            pass
        out["error"] = str(e).strip().lstrip("❌").strip()
        out["ok"] = False
        return out


def run_pipeline(
    config: Dict[str, Any],
    file_bytes: bytes,
    filename: str,
    on_step: StepCallback,
) -> Tuple[Dict[str, Any], Dict[str, int]]:
    """Run the full 5-step IXP flow (+ a parse step) and emit progress.

    Returns (raw_extraction_result, durations_ms).
    """
    durations: Dict[str, int] = {}

    def stamp(step: str, t0: float) -> None:
        durations[step] = int((time.time() - t0) * 1000)

    # ── Step 1: Auth ────────────────────────────────────────────────
    on_step("auth", "active", "POST /identity_/connect/token", None)
    t0 = time.time()
    try:
        token = get_token(config)
    except Exception as e:
        on_step("auth", "error", str(e), int((time.time() - t0) * 1000))
        raise
    stamp("auth", t0)
    on_step("auth", "done", f"token acquired", durations["auth"])

    # ── Step 2: Digitize ────────────────────────────────────────────
    on_step("digitize", "active", "POST /du_/api/.../digitization/start", None)
    t0 = time.time()
    # The script's digitize_document expects a file path; persist to temp.
    safe_name = filename or "document.pdf"
    ext = os.path.splitext(safe_name)[1] or ".pdf"
    with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tf:
        tf.write(file_bytes)
        tmp_path = tf.name
    try:
        try:
            document_id = digitize_document(config, token, tmp_path)
        except Exception as e:
            on_step("digitize", "error", str(e), int((time.time() - t0) * 1000))
            raise
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass
    stamp("digitize", t0)
    on_step("digitize", "done", f"documentId {str(document_id)[:8]}…", durations["digitize"])

    # ── Step 3: Project ─────────────────────────────────────────────
    on_step("project", "active", "GET  /du_/api/framework/projects", None)
    t0 = time.time()
    try:
        project_id = get_project_id(config, token, config["project_name"])
    except Exception as e:
        on_step("project", "error", str(e), int((time.time() - t0) * 1000))
        raise
    stamp("project", t0)
    on_step("project", "done", config["project_name"], durations["project"])

    # ── Step 4: Extractor ───────────────────────────────────────────
    on_step("extractor", "active", "GET  /du_/api/.../extractors", None)
    t0 = time.time()
    try:
        extractor_id = get_extractor_id(config, token, project_id)
    except Exception as e:
        on_step("extractor", "error", str(e), int((time.time() - t0) * 1000))
        raise
    stamp("extractor", t0)
    on_step("extractor", "done", f"{str(extractor_id)[:8]}…", durations["extractor"])

    # ── Step 5: Extract ─────────────────────────────────────────────
    on_step("extract", "active", "POST /du_/api/.../extraction", None)
    t0 = time.time()
    try:
        extraction = run_extraction(config, token, project_id, extractor_id, document_id)
    except Exception as e:
        on_step("extract", "error", str(e), int((time.time() - t0) * 1000))
        raise
    stamp("extract", t0)
    on_step("extract", "done", "extraction returned", durations["extract"])

    # ── Step 6: Parse ───────────────────────────────────────────────
    on_step("parse", "active", "Mapping fields, line items, confidence", None)
    t0 = time.time()
    # Adapter runs in the route; here we just account for the formatting time.
    stamp("parse", t0)
    on_step("parse", "done", "ready", durations["parse"])

    return extraction, durations
