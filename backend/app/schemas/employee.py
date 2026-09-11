from __future__ import annotations

import datetime as dt
from decimal import Decimal

from pydantic import BaseModel, ConfigDict

from app.schemas.common import DEFAULT_EMPLOYMENT_STATUS, resolve_status_filter


class EmployeeSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    employee_code: str
    first_name: str
    last_name: str
    email: str
    department_name: str
    country_name: str
    job_title: str
    job_level: str
    salary_usd: Decimal
    hire_date: dt.date
    employment_status: str


class EmployeeDetailResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    employee_code: str
    first_name: str
    last_name: str
    email: str
    department_id: int
    department_name: str
    country_id: int
    country_name: str
    job_title: str
    job_level: str
    salary_local: Decimal
    salary_usd: Decimal
    currency_code: str
    hire_date: dt.date
    employment_status: str
    manager_id: int | None
    created_at: dt.datetime
    updated_at: dt.datetime


class EmployeeCreateRequest(BaseModel):
    first_name: str
    last_name: str
    email: str
    department_id: int
    country_id: int
    job_title: str
    job_level: str
    salary_local: Decimal
    hire_date: dt.date
    employment_status: str = DEFAULT_EMPLOYMENT_STATUS


class EmployeeUpdateRequest(BaseModel):
    first_name: str
    last_name: str
    email: str
    department_id: int
    country_id: int
    job_title: str
    job_level: str
    salary_local: Decimal
    hire_date: dt.date
    employment_status: str


class EmployeeListResponse(BaseModel):
    items: list[EmployeeSummary]
    page: int
    page_size: int
    total_items: int
    total_pages: int


class EmployeeListParams(BaseModel):
    """Employee-directory list filters: paging, lookups, status, search, and sort.

    A standalone sibling of `EmployeeFilterParams` (`app/schemas/common.py`) rather than a
    subclass — this endpoint doesn't expose hire-date filters, so inheriting would carry
    fields the router never populates. Reuses `resolve_status_filter` to keep the `All`
    convention in one place.
    """

    model_config = ConfigDict(frozen=True)

    page: int = 1
    page_size: int = 25
    department_id: int | None = None
    country_id: int | None = None
    employment_status: str = DEFAULT_EMPLOYMENT_STATUS
    search: str | None = None
    sort_by: str = "last_name"
    sort_dir: str = "asc"

    @property
    def status_filter(self) -> str | None:
        return resolve_status_filter(self.employment_status)

    @property
    def clamped_page(self) -> int:
        return max(self.page, 1)

    @property
    def clamped_page_size(self) -> int:
        return min(max(self.page_size, 1), 100)
