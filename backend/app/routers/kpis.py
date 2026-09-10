from __future__ import annotations

import datetime as dt

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.common import DEFAULT_EMPLOYMENT_STATUS, EmployeeFilterParams
from app.schemas.kpi import KpiSummaryResponse
from app.services import kpi_service

router = APIRouter(tags=["kpis"])


def kpi_summary_filters(
    department_id: int | None = Query(default=None),
    country_id: int | None = Query(default=None),
    employment_status: str = Query(default=DEFAULT_EMPLOYMENT_STATUS),
    hire_date_from: dt.date | None = Query(default=None),
    hire_date_to: dt.date | None = Query(default=None),
) -> EmployeeFilterParams:
    return EmployeeFilterParams(
        department_id=department_id,
        country_id=country_id,
        employment_status=employment_status,
        hire_date_from=hire_date_from,
        hire_date_to=hire_date_to,
    )


@router.get("/kpis/summary", response_model=KpiSummaryResponse)
def get_kpi_summary(
    filters: EmployeeFilterParams = Depends(kpi_summary_filters),
    db: Session = Depends(get_db),
) -> kpi_service.AggregateStats:
    return kpi_service.get_kpi_summary(db, filters)
