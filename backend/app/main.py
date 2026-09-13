from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers.ai_query import router as ai_query_router
from app.routers.breakdowns import router as breakdowns_router
from app.routers.employees import router as employees_router
from app.routers.kpis import router as kpis_router
from app.routers.lookups import router as lookups_router

app = FastAPI(title="ACME Salary Management API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(settings.allowed_origins),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}


app.include_router(lookups_router, prefix="/api/v1")
app.include_router(kpis_router, prefix="/api/v1")
app.include_router(breakdowns_router, prefix="/api/v1")
app.include_router(employees_router, prefix="/api/v1")
app.include_router(ai_query_router, prefix="/api/v1")
