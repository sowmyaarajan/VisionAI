from typing import Optional, List, Dict, Any, Literal
from pydantic import BaseModel, Field


class IxpConfig(BaseModel):
    environment: Literal["staging", "production", "custom"] = "production"
    customUrl: Optional[str] = ""
    clientId: str
    clientSecret: str
    tenant: str = Field(..., description="org/tenant — e.g. ps_india/DU_test (slash-separated). If no slash, the same value is used for both.")
    folder: Optional[str] = "Shared"
    project: str
    scopes: Optional[str] = "Du.Digitization.Api Du.Extraction.Api Du.Classification.Api Du.DocumentManager.Document Du.Validation.Api"

    def resolved(self) -> dict:
        env = (self.environment or "production").lower()
        if env == "custom":
            base_url = (self.customUrl or "").rstrip("/")
        elif env == "staging":
            base_url = "https://staging.uipath.com"
        else:
            base_url = "https://cloud.uipath.com"
        raw = (self.tenant or "").strip().strip("/")
        if "/" in raw:
            org, tenant = raw.split("/", 1)
        else:
            org, tenant = raw, raw
        return {
            "base_url": base_url,
            "org_name": org.strip(),
            "tenant_name": tenant.strip(),
            "client_id": self.clientId,
            "client_secret": self.clientSecret,
            "scope": (self.scopes or "").strip() or "Du.Digitization.Api Du.Extraction.Api Du.Classification.Api Du.DocumentManager.Document Du.Validation.Api",
            "project_name": (self.project or "").strip(),
        }


class TestConnectionResponse(BaseModel):
    ok: bool
    tokenExpiresIn: Optional[int] = None
    projectId: Optional[str] = None
    extractorId: Optional[str] = None
    availableProjects: Optional[List[str]] = None
    error: Optional[str] = None


class LlmRequest(BaseModel):
    provider: str
    endpoint: Optional[str] = ""
    apiKey: Optional[str] = ""
    model: Optional[str] = ""
    system: Optional[str] = None
    messages: List[Dict[str, Any]] = []
    maxTokens: int = 2048
    temperature: float = 0.2
    expectJson: bool = False


class LlmTestResponse(BaseModel):
    ok: bool
    latencyMs: Optional[int] = None
    text: Optional[str] = None
    error: Optional[str] = None


class LlmChatResponse(BaseModel):
    text: str
