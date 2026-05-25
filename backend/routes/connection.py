from fastapi import APIRouter
from ..schemas import IxpConfig, TestConnectionResponse
from ..ixp_service import test_connection


router = APIRouter(prefix="/api/connection", tags=["connection"])


@router.post("/test", response_model=TestConnectionResponse)
def test(cfg: IxpConfig) -> TestConnectionResponse:
    resolved = cfg.resolved()
    if not resolved["base_url"] or not resolved["org_name"] or not resolved["client_id"] or not resolved["client_secret"]:
        return TestConnectionResponse(ok=False, error="Missing base URL, org, client ID, or client secret.")
    result = test_connection(resolved)
    return TestConnectionResponse(**result)
