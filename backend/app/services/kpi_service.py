from __future__ import annotations

import statistics
from collections import defaultdict
from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal

from sqlalchemy import Select, select
from sqlalchemy.orm import Session

from app.models.country import Country
from app.models.department import Department
from app.models.employee import Employee
from app.schemas.common import EmployeeFilterParams

_CENTS = Decimal("0.01")


@dataclass(frozen=True)
class AggregateStats:
    headcount: int
    total_payroll_usd: Decimal
    average_salary_usd: Decimal
    median_salary_usd: Decimal


@dataclass(frozen=True)
class DepartmentBreakdownRow:
    department_id: int
    department_name: str
    headcount: int
    total_payroll_usd: Decimal
    average_salary_usd: Decimal
    median_salary_usd: Decimal


@dataclass(frozen=True)
class CountryBreakdownRow:
    country_id: int
    country_name: str
    currency_code: str
    headcount: int
    total_payroll_usd: Decimal
    average_salary_usd: Decimal
    median_salary_usd: Decimal


def _aggregate(salary_values: list[Decimal]) -> AggregateStats:
    """Headcount/total/average/median over salary_usd values. Empty input -> all zeros."""
    if not salary_values:
        return AggregateStats(0, Decimal("0.00"), Decimal("0.00"), Decimal("0.00"))

    total = sum(salary_values, start=Decimal("0"))
    average = (total / len(salary_values)).quantize(_CENTS, rounding=ROUND_HALF_UP)
    median = statistics.median(salary_values).quantize(_CENTS, rounding=ROUND_HALF_UP)
    return AggregateStats(len(salary_values), total, average, median)


def _matching_employees(filters: EmployeeFilterParams) -> Select:
    query = select(Employee)
    if filters.department_id is not None:
        query = query.where(Employee.department_id == filters.department_id)
    if filters.country_id is not None:
        query = query.where(Employee.country_id == filters.country_id)
    if filters.status_filter is not None:
        query = query.where(Employee.employment_status == filters.status_filter)
    if filters.hire_date_from is not None:
        query = query.where(Employee.hire_date >= filters.hire_date_from)
    if filters.hire_date_to is not None:
        query = query.where(Employee.hire_date <= filters.hire_date_to)
    return query


def get_kpi_summary(db: Session, filters: EmployeeFilterParams) -> AggregateStats:
    salary_values = db.scalars(_matching_employees(filters).with_only_columns(Employee.salary_usd)).all()
    return _aggregate(list(salary_values))


def get_department_breakdown(db: Session, filters: EmployeeFilterParams) -> list[DepartmentBreakdownRow]:
    rows = db.execute(
        _matching_employees(filters)
        .join(Department, Employee.department_id == Department.id)
        .with_only_columns(Department.id, Department.name, Employee.salary_usd)
    ).all()

    salaries_by_department: dict[tuple[int, str], list[Decimal]] = defaultdict(list)
    for department_id, department_name, salary_usd in rows:
        salaries_by_department[(department_id, department_name)].append(salary_usd)

    breakdown = []
    for (department_id, department_name), salaries in salaries_by_department.items():
        stats = _aggregate(salaries)
        breakdown.append(
            DepartmentBreakdownRow(
                department_id=department_id,
                department_name=department_name,
                headcount=stats.headcount,
                total_payroll_usd=stats.total_payroll_usd,
                average_salary_usd=stats.average_salary_usd,
                median_salary_usd=stats.median_salary_usd,
            )
        )
    return sorted(breakdown, key=lambda row: row.department_name)


def get_country_breakdown(db: Session, filters: EmployeeFilterParams) -> list[CountryBreakdownRow]:
    rows = db.execute(
        _matching_employees(filters)
        .join(Country, Employee.country_id == Country.id)
        .with_only_columns(Country.id, Country.name, Country.currency_code, Employee.salary_usd)
    ).all()

    salaries_by_country: dict[tuple[int, str, str], list[Decimal]] = defaultdict(list)
    for country_id, country_name, currency_code, salary_usd in rows:
        salaries_by_country[(country_id, country_name, currency_code)].append(salary_usd)

    breakdown = []
    for (country_id, country_name, currency_code), salaries in salaries_by_country.items():
        stats = _aggregate(salaries)
        breakdown.append(
            CountryBreakdownRow(
                country_id=country_id,
                country_name=country_name,
                currency_code=currency_code,
                headcount=stats.headcount,
                total_payroll_usd=stats.total_payroll_usd,
                average_salary_usd=stats.average_salary_usd,
                median_salary_usd=stats.median_salary_usd,
            )
        )
    return sorted(breakdown, key=lambda row: row.country_name)
