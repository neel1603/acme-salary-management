from __future__ import annotations

import datetime as dt

from pydantic import BaseModel, ConfigDict

DEFAULT_EMPLOYMENT_STATUS = "Active"
ALL_EMPLOYMENT_STATUSES = "All"


class EmployeeFilterParams(BaseModel):
    """Shared employee-filter shape for the KPI/breakdown endpoints.

    An unset `employment_status` defaults to Active; pass `All` explicitly to include
    every status. `department_id`/`country_id` are left unset by whichever breakdown
    endpoint is grouping on that dimension.
    """

    model_config = ConfigDict(frozen=True)

    department_id: int | None = None
    country_id: int | None = None
    employment_status: str = DEFAULT_EMPLOYMENT_STATUS
    hire_date_from: dt.date | None = None
    hire_date_to: dt.date | None = None

    @property
    def status_filter(self) -> str | None:
        """None means "don't filter by status" — the explicit `All` escape hatch."""
        if self.employment_status.lower() == ALL_EMPLOYMENT_STATUSES.lower():
            return None
        return self.employment_status
