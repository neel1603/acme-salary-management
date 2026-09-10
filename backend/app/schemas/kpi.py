from __future__ import annotations

from decimal import Decimal

from pydantic import BaseModel, ConfigDict


class KpiSummaryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    headcount: int
    total_payroll_usd: Decimal
    average_salary_usd: Decimal
    median_salary_usd: Decimal
