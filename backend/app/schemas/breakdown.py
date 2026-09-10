from __future__ import annotations

from decimal import Decimal

from pydantic import BaseModel, ConfigDict


class DepartmentBreakdownItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    department_id: int
    department_name: str
    headcount: int
    total_payroll_usd: Decimal
    average_salary_usd: Decimal
    median_salary_usd: Decimal


class DepartmentBreakdownResponse(BaseModel):
    data: list[DepartmentBreakdownItem]


class CountryBreakdownItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    country_id: int
    country_name: str
    currency_code: str
    headcount: int
    total_payroll_usd: Decimal
    average_salary_usd: Decimal
    median_salary_usd: Decimal


class CountryBreakdownResponse(BaseModel):
    data: list[CountryBreakdownItem]
