from __future__ import annotations

import datetime as dt
from decimal import Decimal

from app.models.country import Country
from app.models.department import Department
from app.models.employee import Employee


def _seed_employees(in_memory_session_factory) -> dict[str, int]:
    session = in_memory_session_factory()
    try:
        engineering = Department(name="Engineering")
        sales = Department(name="Sales")
        us = Country(
            code="US", name="United States", currency_code="USD", fx_rate_to_usd=Decimal("1.00"), fx_rate_as_of=dt.date(2026, 1, 1)
        )
        session.add_all([engineering, sales, us])
        session.flush()

        session.add_all(
            [
                Employee(
                    employee_code="EMP00001",
                    first_name="Jane",
                    last_name="Doe",
                    email="jane.doe@example.com",
                    department_id=engineering.id,
                    country_id=us.id,
                    job_title="Software Engineer",
                    job_level="IC2",
                    salary_local=Decimal("100000.00"),
                    salary_usd=Decimal("100000.00"),
                    hire_date=dt.date(2024, 1, 15),
                    employment_status="Active",
                ),
                Employee(
                    employee_code="EMP00002",
                    first_name="John",
                    last_name="Smith",
                    email="john.smith@example.com",
                    department_id=sales.id,
                    country_id=us.id,
                    job_title="Account Executive",
                    job_level="IC2",
                    salary_local=Decimal("80000.00"),
                    salary_usd=Decimal("80000.00"),
                    hire_date=dt.date(2023, 6, 1),
                    employment_status="Active",
                ),
                Employee(
                    employee_code="EMP00003",
                    first_name="Alex",
                    last_name="Lee",
                    email="alex.lee@example.com",
                    department_id=engineering.id,
                    country_id=us.id,
                    job_title="Engineering Manager",
                    job_level="Manager",
                    salary_local=Decimal("150000.00"),
                    salary_usd=Decimal("150000.00"),
                    hire_date=dt.date(2022, 3, 1),
                    employment_status="Terminated",
                ),
            ]
        )
        session.commit()
        return {"engineering_id": engineering.id, "sales_id": sales.id, "us_id": us.id}
    finally:
        session.close()


def test_kpi_summary_returns_expected_shape(client, in_memory_session_factory):
    _seed_employees(in_memory_session_factory)

    response = client.get("/api/v1/kpis/summary")

    assert response.status_code == 200
    assert set(response.json().keys()) == {
        "headcount",
        "total_payroll_usd",
        "average_salary_usd",
        "median_salary_usd",
    }


def test_kpi_summary_filters_by_department_and_country(client, in_memory_session_factory):
    ids = _seed_employees(in_memory_session_factory)

    response = client.get(
        "/api/v1/kpis/summary", params={"department_id": ids["engineering_id"], "employment_status": "All"}
    )

    assert response.status_code == 200
    assert response.json()["headcount"] == 2


def test_kpi_summary_defaults_to_active_employees(client, in_memory_session_factory):
    _seed_employees(in_memory_session_factory)

    response = client.get("/api/v1/kpis/summary")

    assert response.status_code == 200
    assert response.json()["headcount"] == 2


def test_kpi_summary_invalid_lookup_id_returns_empty_result(client, in_memory_session_factory):
    _seed_employees(in_memory_session_factory)

    response = client.get("/api/v1/kpis/summary", params={"department_id": 999})

    assert response.status_code == 200
    assert response.json()["headcount"] == 0
