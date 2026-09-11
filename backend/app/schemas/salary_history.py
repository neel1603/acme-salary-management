from __future__ import annotations

import datetime as dt
from decimal import Decimal

from pydantic import BaseModel, ConfigDict


class SalaryHistoryItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    old_salary_local: Decimal
    new_salary_local: Decimal
    hike_percent: Decimal
    changed_at: dt.datetime


class SalaryHistoryResponse(BaseModel):
    data: list[SalaryHistoryItem]
