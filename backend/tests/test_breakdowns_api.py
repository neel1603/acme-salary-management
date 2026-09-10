from __future__ import annotations

import datetime as dt
from decimal import Decimal

from app.models.country import Country
from app.models.department import Department
from app.models.employee import Employee


def _seed_employees(in_memory_session_factory) -> None:
    session = in_memory_session_factory()
    try:
        engineering = Department(name="Engineering")
        sales = Department(name="Sales")
        us = Country(
            code="US", name="United States", currency_code="USD", fx_rate_to_usd=Decimal("1.00"), fx_rate_as_of=dt.date(2026, 1, 1)
        )
        india = Country(
            code="IN", name="India", currency_code="INR", fx_rate_to_usd=Decimal("0.012"), fx_rate_as_of=dt.date(2026, 1, 1)
        )
        session.add_all([engineering, sales, us, india])
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
                    country_id=india.id,
                    job_title="Account Executive",
                    job_level="IC2",
                    salary_local=Decimal("6000000.00"),
                    salary_usd=Decimal("72000.00"),
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
    finally:
        session.close()


def test_department_breakdown_returns_expected_shape(client, in_memory_session_factory):
    _seed_employees(in_memory_session_factory)

    response = client.get("/api/v1/breakdown/department", params={"employment_status": "All"})

    assert response.status_code == 200
    body = response.json()
    assert set(body.keys()) == {"data"}
    assert {item["department_name"] for item in body["data"]} == {"Engineering", "Sales"}
    engineering_row = next(item for item in body["data"] if item["department_name"] == "Engineering")
    assert set(engineering_row.keys()) == {
        "department_id",
        "department_name",
        "headcount",
        "total_payroll_usd",
        "average_salary_usd",
        "median_salary_usd",
    }
    assert engineering_row["headcount"] == 2


def test_country_breakdown_returns_expected_shape(client, in_memory_session_factory):
    _seed_employees(in_memory_session_factory)

    response = client.get("/api/v1/breakdown/country", params={"employment_status": "All"})

    assert response.status_code == 200
    body = response.json()
    india_row = next(item for item in body["data"] if item["country_name"] == "India")
    assert india_row["currency_code"] == "INR"
    assert india_row["headcount"] == 1


def test_breakdown_respects_shared_filters(client, in_memory_session_factory):
    _seed_employees(in_memory_session_factory)

    response = client.get("/api/v1/breakdown/department")

    assert response.status_code == 200
    body = response.json()
    department_names = {item["department_name"] for item in body["data"]}
    assert department_names == {"Engineering", "Sales"}
    engineering_row = next(item for item in body["data"] if item["department_name"] == "Engineering")
    assert engineering_row["headcount"] == 1
