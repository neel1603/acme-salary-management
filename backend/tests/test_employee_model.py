from __future__ import annotations

import datetime as dt

import pytest
from sqlalchemy import inspect
from sqlalchemy.exc import IntegrityError

from app.models.country import Country
from app.models.department import Department
from app.models.employee import Employee


def _build_country(code: str = "US", name: str = "United States") -> Country:
    return Country(
        code=code,
        name=name,
        currency_code="USD",
        fx_rate_to_usd=1.0,
        fx_rate_as_of=dt.date(2026, 1, 1),
    )


def _build_department(name: str = "Engineering") -> Department:
    return Department(name=name)


def _build_employee(*, employee_code: str, email: str, department_id: int, country_id: int) -> Employee:
    return Employee(
        employee_code=employee_code,
        first_name="Jane",
        last_name="Doe",
        email=email,
        department_id=department_id,
        country_id=country_id,
        job_title="Software Engineer II",
        job_level="IC2",
        salary_local=120000,
        salary_usd=120000,
        hire_date=dt.date(2024, 1, 15),
        employment_status="Active",
    )


def test_employee_table_creates_successfully(db_session):
    inspector = inspect(db_session.get_bind())
    column_names = {column["name"] for column in inspector.get_columns("employees")}

    assert column_names == {
        "id",
        "employee_code",
        "first_name",
        "last_name",
        "email",
        "department_id",
        "country_id",
        "job_title",
        "job_level",
        "salary_local",
        "salary_usd",
        "hire_date",
        "employment_status",
        "manager_id",
        "created_at",
        "updated_at",
    }


def test_employee_requires_valid_department_and_country(db_session):
    employee_with_bad_foreign_keys = _build_employee(
        employee_code="EMP00001",
        email="jane.doe@example.com",
        department_id=999,
        country_id=999,
    )
    db_session.add(employee_with_bad_foreign_keys)

    with pytest.raises(IntegrityError):
        db_session.commit()


def test_employee_code_is_unique(db_session):
    department = _build_department()
    country = _build_country()
    db_session.add_all([department, country])
    db_session.commit()

    db_session.add(
        _build_employee(
            employee_code="EMP00001",
            email="jane.doe@example.com",
            department_id=department.id,
            country_id=country.id,
        )
    )
    db_session.commit()

    db_session.add(
        _build_employee(
            employee_code="EMP00001",
            email="john.smith@example.com",
            department_id=department.id,
            country_id=country.id,
        )
    )
    with pytest.raises(IntegrityError):
        db_session.commit()


def test_employee_email_is_unique(db_session):
    department = _build_department()
    country = _build_country()
    db_session.add_all([department, country])
    db_session.commit()

    db_session.add(
        _build_employee(
            employee_code="EMP00001",
            email="jane.doe@example.com",
            department_id=department.id,
            country_id=country.id,
        )
    )
    db_session.commit()

    db_session.add(
        _build_employee(
            employee_code="EMP00002",
            email="jane.doe@example.com",
            department_id=department.id,
            country_id=country.id,
        )
    )
    with pytest.raises(IntegrityError):
        db_session.commit()


def test_employee_defaults(db_session):
    department = _build_department()
    country = _build_country()
    db_session.add_all([department, country])
    db_session.commit()

    new_employee = _build_employee(
        employee_code="EMP00001",
        email="jane.doe@example.com",
        department_id=department.id,
        country_id=country.id,
    )
    db_session.add(new_employee)
    db_session.commit()
    db_session.refresh(new_employee)

    assert new_employee.created_at is not None
    assert new_employee.updated_at is not None
