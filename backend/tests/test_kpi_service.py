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


def _build_employee(
    *,
    department_id: int,
    country_id: int,
    salary_usd: Decimal,
    employment_status: str = "Active",
) -> Employee:
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
        employment_status=employment_status,
    )


def test_summary_matches_hand_computed_values(db_session):
    department = _build_department()
    country = _build_country()
    db_session.add_all([department, country])
    db_session.commit()

    for salary in (Decimal("50000.00"), Decimal("60000.00"), Decimal("70000.00")):
        db_session.add(_build_employee(department_id=department.id, country_id=country.id, salary_usd=salary))
    db_session.commit()

    result = kpi_service.get_kpi_summary(db_session, EmployeeFilterParams())

    assert result.headcount == 3
    assert result.total_payroll_usd == Decimal("180000.00")
    assert result.average_salary_usd == Decimal("60000.00")


def test_summary_median_with_odd_count(db_session):
    department = _build_department()
    country = _build_country()
    db_session.add_all([department, country])
    db_session.commit()

    for salary in (Decimal("50000.00"), Decimal("60000.00"), Decimal("70000.00")):
        db_session.add(_build_employee(department_id=department.id, country_id=country.id, salary_usd=salary))
    db_session.commit()

    result = kpi_service.get_kpi_summary(db_session, EmployeeFilterParams())

    assert result.median_salary_usd == Decimal("60000.00")


def test_summary_median_with_even_count(db_session):
    department = _build_department()
    country = _build_country()
    db_session.add_all([department, country])
    db_session.commit()

    for salary in (Decimal("50000.00"), Decimal("60000.00"), Decimal("70000.00"), Decimal("80000.00")):
        db_session.add(_build_employee(department_id=department.id, country_id=country.id, salary_usd=salary))
    db_session.commit()

    result = kpi_service.get_kpi_summary(db_session, EmployeeFilterParams())

    assert result.median_salary_usd == Decimal("65000.00")


def test_summary_sums_across_mixed_currencies_correctly(db_session):
    department = _build_department()
    us = _build_country(code="US", name="United States", currency_code="USD")
    india = _build_country(code="IN", name="India", currency_code="INR")
    db_session.add_all([department, us, india])
    db_session.commit()

    db_session.add(_build_employee(department_id=department.id, country_id=us.id, salary_usd=Decimal("100000.00")))
    db_session.add(_build_employee(department_id=department.id, country_id=india.id, salary_usd=Decimal("40000.00")))
    db_session.commit()

    result = kpi_service.get_kpi_summary(db_session, EmployeeFilterParams())

    assert result.headcount == 2
    assert result.total_payroll_usd == Decimal("140000.00")
    assert result.average_salary_usd == Decimal("70000.00")


def test_summary_returns_zeroed_result_when_no_employees_match(db_session):
    result = kpi_service.get_kpi_summary(db_session, EmployeeFilterParams(department_id=999))

    assert result.headcount == 0
    assert result.total_payroll_usd == Decimal("0.00")
    assert result.average_salary_usd == Decimal("0.00")
    assert result.median_salary_usd == Decimal("0.00")


def test_summary_employment_status_all_bypasses_default_filter(db_session):
    department = _build_department()
    country = _build_country()
    db_session.add_all([department, country])
    db_session.commit()

    db_session.add(
        _build_employee(
            department_id=department.id, country_id=country.id, salary_usd=Decimal("50000.00"), employment_status="Active"
        )
    )
    db_session.add(
        _build_employee(
            department_id=department.id,
            country_id=country.id,
            salary_usd=Decimal("60000.00"),
            employment_status="Terminated",
        )
    )
    db_session.commit()

    default_result = kpi_service.get_kpi_summary(db_session, EmployeeFilterParams())
    all_result = kpi_service.get_kpi_summary(db_session, EmployeeFilterParams(employment_status="All"))

    assert default_result.headcount == 1
    assert all_result.headcount == 2
