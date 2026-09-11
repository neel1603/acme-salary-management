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
        us = Country(
            code="US", name="United States", currency_code="USD", fx_rate_to_usd=Decimal("1.00"), fx_rate_as_of=dt.date(2026, 1, 1)
        )
        session.add_all([engineering, us])
        session.flush()

        employee = Employee(
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
        )
        session.add(employee)
        session.commit()
        return {"department_id": engineering.id, "country_id": us.id, "employee_id": employee.id}
    finally:
        session.close()


def test_list_employees_returns_expected_shape(client, in_memory_session_factory):
    _seed_employees(in_memory_session_factory)

    response = client.get("/api/v1/employees")

    assert response.status_code == 200
    assert set(response.json().keys()) == {"items", "page", "page_size", "total_items", "total_pages"}
    assert response.json()["total_items"] == 1


def test_get_employee_returns_404_for_unknown_id(client, in_memory_session_factory):
    _seed_employees(in_memory_session_factory)

    response = client.get("/api/v1/employees/999")

    assert response.status_code == 404


def test_create_employee_returns_201_with_generated_fields(client, in_memory_session_factory):
    ids = _seed_employees(in_memory_session_factory)

    response = client.post(
        "/api/v1/employees",
        json={
            "first_name": "Nina",
            "last_name": "Rao",
            "email": "nina.rao@example.com",
            "department_id": ids["department_id"],
            "country_id": ids["country_id"],
            "job_title": "Data Analyst",
            "job_level": "IC1",
            "salary_local": "80000.00",
            "hire_date": "2026-02-01",
            "employee_code": "IGNORED",
            "salary_usd": "999999.00",
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert body["employee_code"] == "EMP00002"
    assert body["salary_usd"] == "80000.00"


def test_update_employee_returns_updated_fields(client, in_memory_session_factory):
    ids = _seed_employees(in_memory_session_factory)

    response = client.put(
        f"/api/v1/employees/{ids['employee_id']}",
        json={
            "first_name": "Jane",
            "last_name": "Smith",
            "email": "jane.smith@example.com",
            "department_id": ids["department_id"],
            "country_id": ids["country_id"],
            "job_title": "Senior Software Engineer",
            "job_level": "IC3",
            "salary_local": "120000.00",
            "hire_date": "2024-01-15",
            "employment_status": "Active",
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["last_name"] == "Smith"
    assert body["salary_usd"] == "120000.00"


def test_deactivate_employee_returns_terminated_status(client, in_memory_session_factory):
    ids = _seed_employees(in_memory_session_factory)

    response = client.patch(f"/api/v1/employees/{ids['employee_id']}/deactivate")

    assert response.status_code == 200
    assert response.json()["employment_status"] == "Terminated"


def test_salary_history_endpoint_returns_rows_after_an_update(client, in_memory_session_factory):
    ids = _seed_employees(in_memory_session_factory)

    empty_response = client.get(f"/api/v1/employees/{ids['employee_id']}/salary-history")
    assert empty_response.json() == {"data": []}

    client.put(
        f"/api/v1/employees/{ids['employee_id']}",
        json={
            "first_name": "Jane",
            "last_name": "Doe",
            "email": "jane.doe@example.com",
            "department_id": ids["department_id"],
            "country_id": ids["country_id"],
            "job_title": "Software Engineer",
            "job_level": "IC2",
            "salary_local": "110000.00",
            "hire_date": "2024-01-15",
            "employment_status": "Active",
        },
    )

    history_response = client.get(f"/api/v1/employees/{ids['employee_id']}/salary-history")

    assert history_response.status_code == 200
    assert len(history_response.json()["data"]) == 1
