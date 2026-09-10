from __future__ import annotations

import datetime as dt
import itertools
from decimal import Decimal

from app.models.country import Country
from app.models.department import Department
from app.models.employee import Employee
from app.schemas.common import EmployeeFilterParams
from app.services import kpi_service

_employee_code_sequence = itertools.count(1)


def _build_country(code: str = "US", name: str = "United States", currency_code: str = "USD") -> Country:
    return Country(
        code=code,
        name=name,
        currency_code=currency_code,
        fx_rate_to_usd=Decimal("1.00"),
        fx_rate_as_of=dt.date(2026, 1, 1),
    )


def _build_department(name: str = "Engineering") -> Department:
    return Department(name=name)


def _build_employee(*, department_id: int, country_id: int, salary_usd: Decimal) -> Employee:
    sequence_number = next(_employee_code_sequence)
    return Employee(
        employee_code=f"EMP{sequence_number:05d}",
        first_name="Jane",
        last_name="Doe",
        email=f"employee.{sequence_number}@example.com",
        department_id=department_id,
        country_id=country_id,
        job_title="Software Engineer",
        job_level="IC2",
        salary_local=salary_usd,
        salary_usd=salary_usd,
        hire_date=dt.date(2024, 1, 15),
        employment_status="Active",
    )


def test_department_breakdown_matches_hand_computed_values(db_session):
    engineering = _build_department(name="Engineering")
    sales = _build_department(name="Sales")
    country = _build_country()
    db_session.add_all([engineering, sales, country])
    db_session.commit()

    db_session.add(_build_employee(department_id=engineering.id, country_id=country.id, salary_usd=Decimal("100000.00")))
    db_session.add(_build_employee(department_id=engineering.id, country_id=country.id, salary_usd=Decimal("120000.00")))
    db_session.add(_build_employee(department_id=sales.id, country_id=country.id, salary_usd=Decimal("80000.00")))
    db_session.commit()

    breakdown = kpi_service.get_department_breakdown(db_session, EmployeeFilterParams())

    by_name = {row.department_name: row for row in breakdown}
    assert by_name["Engineering"].headcount == 2
    assert by_name["Engineering"].total_payroll_usd == Decimal("220000.00")
    assert by_name["Engineering"].average_salary_usd == Decimal("110000.00")
    assert by_name["Sales"].headcount == 1
    assert by_name["Sales"].total_payroll_usd == Decimal("80000.00")


def test_country_breakdown_includes_currency_code(db_session):
    department = _build_department()
    india = _build_country(code="IN", name="India", currency_code="INR")
    db_session.add_all([department, india])
    db_session.commit()

    db_session.add(_build_employee(department_id=department.id, country_id=india.id, salary_usd=Decimal("40000.00")))
    db_session.commit()

    breakdown = kpi_service.get_country_breakdown(db_session, EmployeeFilterParams())

    assert len(breakdown) == 1
    assert breakdown[0].country_name == "India"
    assert breakdown[0].currency_code == "INR"


def test_breakdown_omits_groups_with_no_matching_employees(db_session):
    engineering = _build_department(name="Engineering")
    sales = _build_department(name="Sales")
    country = _build_country()
    db_session.add_all([engineering, sales, country])
    db_session.commit()

    db_session.add(_build_employee(department_id=engineering.id, country_id=country.id, salary_usd=Decimal("100000.00")))
    db_session.commit()

    breakdown = kpi_service.get_department_breakdown(db_session, EmployeeFilterParams())

    department_names = {row.department_name for row in breakdown}
    assert department_names == {"Engineering"}


def test_breakdown_sorted_by_group_name(db_session):
    sales = _build_department(name="Sales")
    engineering = _build_department(name="Engineering")
    country = _build_country()
    db_session.add_all([sales, engineering, country])
    db_session.commit()

    db_session.add(_build_employee(department_id=sales.id, country_id=country.id, salary_usd=Decimal("80000.00")))
    db_session.add(_build_employee(department_id=engineering.id, country_id=country.id, salary_usd=Decimal("100000.00")))
    db_session.commit()

    breakdown = kpi_service.get_department_breakdown(db_session, EmployeeFilterParams())

    assert [row.department_name for row in breakdown] == ["Engineering", "Sales"]
