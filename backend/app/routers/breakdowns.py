from __future__ import annotations

import datetime as dt

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.breakdown import (
    CountryBreakdownItem,
    CountryBreakdownResponse,
    DepartmentBreakdownItem,
    DepartmentBreakdownResponse,
)
from app.schemas.common import DEFAULT_EMPLOYMENT_STATUS, EmployeeFilterParams
from app.services import kpi_service

router = APIRouter(tags=["breakdowns"])


def department_breakdown_filters(
    country_id: int | None = Query(default=None),
    employment_status: str = Query(default=DEFAULT_EMPLOYMENT_STATUS),
    hire_date_from: dt.date | None = Query(default=None),
    hire_date_to: dt.date | None = Query(default=None),
) -> EmployeeFilterParams:
    return EmployeeFilterParams(
        country_id=country_id,
        employment_status=employment_status,
        hire_date_from=hire_date_from,
        hire_date_to=hire_date_to,
    )


def country_breakdown_filters(
    department_id: int | None = Query(default=None),
    employment_status: str = Query(default=DEFAULT_EMPLOYMENT_STATUS),
    hire_date_from: dt.date | None = Query(default=None),
    hire_date_to: dt.date | None = Query(default=None),
) -> EmployeeFilterParams:
    return EmployeeFilterParams(
        department_id=department_id,
        employment_status=employment_status,
        hire_date_from=hire_date_from,
        hire_date_to=hire_date_to,
    )


@router.get("/breakdown/department", response_model=DepartmentBreakdownResponse)
def get_department_breakdown(
    filters: EmployeeFilterParams = Depends(department_breakdown_filters),
    db: Session = Depends(get_db),
) -> DepartmentBreakdownResponse:
    rows = kpi_service.get_department_breakdown(db, filters)
    return DepartmentBreakdownResponse(data=[DepartmentBreakdownItem.model_validate(row) for row in rows])


@router.get("/breakdown/country", response_model=CountryBreakdownResponse)
def get_country_breakdown(
    filters: EmployeeFilterParams = Depends(country_breakdown_filters),
    db: Session = Depends(get_db),
) -> CountryBreakdownResponse:
    rows = kpi_service.get_country_breakdown(db, filters)
    return CountryBreakdownResponse(data=[CountryBreakdownItem.model_validate(row) for row in rows])
