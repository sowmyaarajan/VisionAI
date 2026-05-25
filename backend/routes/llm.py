"""LLM proxy — server-side fan-out to Anthropic / OpenAI / OpenRouter / Azure /
Gemini / Ollama / Custom. Avoids browser CORS for OpenAI/Azure and keeps API
keys out of mixed-origin pre-flight noise.

Returns a single normalized `{ text }` payload.
"""
from __future__ import annotations
import time
from typing import Any, Dict, List, Optional

import httpx
from fastapi import APIRouter, HTTPException

from ..schemas import LlmRequest, LlmTestResponse, LlmChatResponse


router = APIRouter(prefix="/api/llm", tags=["llm"])


PROVIDER_DEFAULTS: Dict[str, Dict[str, Any]] = {
    "claude": {
        "endpoint": "https://api.anthropic.com/v1/messages",
        "modelDefault": "claude-sonnet-4-5",
    },
    "openai": {
        "endpoint": "https://api.openai.com/v1/chat/completions",
        "modelDefault": "gpt-4o",
    },
    "openrouter": {
        "endpoint": "https://openrouter.ai/api/v1/chat/completions",
        "modelDefault": "deepseek/deepseek-chat-v3.1",
    },
    "deepseek_openrouter": {
        "endpoint": "https://openrouter.ai/api/v1/chat/completions",
        "modelDefault": "deepseek/deepseek-chat-v3.1",
    },
    "azure": {"endpoint": "", "modelDefault": ""},
    "gemini": {
        "endpoint": "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
        "modelDefault": "gemini-2.0-flash",
    },
    "ollama": {
        "endpoint": "http://localhost:11434/api/chat",
        "modelDefault": "llama3.1",
    },
    "custom": {"endpoint": "", "modelDefault": ""},
}


async def _call_provider(req: LlmRequest) -> str:
    cfg = PROVIDER_DEFAULTS.get(req.provider, PROVIDER_DEFAULTS["custom"])
    url = (req.endpoint or cfg["endpoint"]).strip()
    if not url:
        raise HTTPException(status_code=400, detail="Endpoint URL is required.")
    model = (req.model or cfg.get("modelDefault") or "").strip()
    messages = req.messages or []

    timeout = httpx.Timeout(120.0, connect=30.0)
    async with httpx.AsyncClient(timeout=timeout) as client:
        # ── Anthropic ──────────────────────────────────────────────
        if req.provider == "claude":
            if not req.apiKey:
                raise HTTPException(status_code=400, detail="Anthropic API key is required.")
            body: Dict[str, Any] = {
                "model": model or "claude-sonnet-4-5",
                "max_tokens": req.maxTokens,
                "temperature": req.temperature,
                "messages": [{"role": m["role"], "content": m["content"]} for m in messages],
            }
            if req.system:
                body["system"] = req.system
            r = await client.post(
                url,
                headers={
                    "content-type": "application/json",
                    "x-api-key": req.apiKey,
                    "anthropic-version": "2023-06-01",
                },
                json=body,
            )
            if r.status_code >= 400:
                raise HTTPException(status_code=502, detail=f"Anthropic {r.status_code}: {r.text[:600]}")
            data = r.json()
            blocks = data.get("content") or []
            return "".join(b.get("text", "") for b in blocks if isinstance(b, dict))

        # ── Gemini ─────────────────────────────────────────────────
        if req.provider == "gemini":
            if not req.apiKey:
                raise HTTPException(status_code=400, detail="Gemini API key is required.")
            used_model = model or "gemini-2.0-flash"
            full = url.replace("{model}", used_model) + f"?key={req.apiKey}"
            contents = [
                {"role": "model" if m["role"] == "assistant" else "user", "parts": [{"text": m["content"]}]}
                for m in messages
            ]
            body = {
                "contents": contents,
                "generationConfig": {
                    "maxOutputTokens": req.maxTokens,
                    "temperature": req.temperature,
                    **({"responseMimeType": "application/json"} if req.expectJson else {}),
                },
            }
            if req.system:
                body["systemInstruction"] = {"parts": [{"text": req.system}]}
            r = await client.post(full, headers={"content-type": "application/json"}, json=body)
            if r.status_code >= 400:
                raise HTTPException(status_code=502, detail=f"Gemini {r.status_code}: {r.text[:600]}")
            data = r.json()
            try:
                return data["candidates"][0]["content"]["parts"][0]["text"]
            except (KeyError, IndexError, TypeError):
                return ""

        # ── Ollama ─────────────────────────────────────────────────
        if req.provider == "ollama":
            body = {
                "model": model or "llama3.1",
                "messages": (
                    ([{"role": "system", "content": req.system}] if req.system else [])
                    + messages
                ),
                "stream": False,
                "options": {"temperature": req.temperature, "num_predict": req.maxTokens},
                **({"format": "json"} if req.expectJson else {}),
            }
            r = await client.post(url, headers={"content-type": "application/json"}, json=body)
            if r.status_code >= 400:
                raise HTTPException(status_code=502, detail=f"Ollama {r.status_code}: {r.text[:600]}")
            data = r.json()
            return (data.get("message") or {}).get("content", "")

        # ── OpenAI / OpenRouter / Azure / DeepSeek / Custom ────────
        headers: Dict[str, str] = {"content-type": "application/json"}
        if req.provider == "azure":
            if req.apiKey:
                headers["api-key"] = req.apiKey
        else:
            if req.apiKey:
                headers["Authorization"] = f"Bearer {req.apiKey}"
        if req.provider in ("openrouter", "deepseek_openrouter"):
            headers["HTTP-Referer"] = "https://visionai.local"
            headers["X-Title"] = "VisionAI IXP"

        body = {
            **({"model": model} if model and req.provider != "azure" else {}),
            "messages": (
                ([{"role": "system", "content": req.system}] if req.system else [])
                + messages
            ),
            "temperature": req.temperature,
            "max_tokens": req.maxTokens,
            **({"response_format": {"type": "json_object"}} if req.expectJson else {}),
        }
        r = await client.post(url, headers=headers, json=body)
        if r.status_code >= 400:
            raise HTTPException(status_code=502, detail=f"{req.provider} {r.status_code}: {r.text[:600]}")
        data = r.json()
        try:
            return data["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError):
            return ""


@router.post("/test", response_model=LlmTestResponse)
async def test(req: LlmRequest) -> LlmTestResponse:
    t = time.time()
    try:
        # Tiny ping
        ping_req = LlmRequest(
            provider=req.provider,
            endpoint=req.endpoint,
            apiKey=req.apiKey,
            model=req.model,
            messages=[{"role": "user", "content": "Reply with exactly the word: OK"}],
            maxTokens=16,
            temperature=0.0,
            expectJson=False,
        )
        text = await _call_provider(ping_req)
        latency = int((time.time() - t) * 1000)
        return LlmTestResponse(ok=bool((text or "").strip()), latencyMs=latency, text=(text or "").strip()[:120])
    except HTTPException as e:
        return LlmTestResponse(ok=False, error=str(e.detail))
    except Exception as e:
        return LlmTestResponse(ok=False, error=str(e))


@router.post("/chat", response_model=LlmChatResponse)
async def chat(req: LlmRequest) -> LlmChatResponse:
    text = await _call_provider(req)
    return LlmChatResponse(text=text or "")
