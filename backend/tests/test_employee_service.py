from __future__ import annotations

import datetime as dt
import itertools
from decimal import Decimal

import pytest

from app.errors import ConflictError
from app.models.country import Country
from app.models.department import Department
from app.models.employee import Employee
from app.schemas.employee import EmployeeCreateRequest, EmployeeListParams, EmployeeUpdateRequest
from app.services import employee_service

_employee_code_sequence = itertools.count(1)


def _build_country(
    code: str = "US",
    name: str = "United States",
    currency_code: str = "USD",
    fx_rate_to_usd: Decimal = Decimal("1.00"),
) -> Country:
    return Country(
        code=code,
        name=name,
        currency_code=currency_code,
        fx_rate_to_usd=fx_rate_to_usd,
        fx_rate_as_of=dt.date(2026, 1, 1),
    )


def _build_department(name: str = "Engineering") -> Department:
    return Department(name=name)


def _build_employee(
    *,
    department_id: int,
    country_id: int,
    first_name: str = "Jane",
    last_name: str = "Doe",
    salary_local: Decimal = Decimal("100000.00"),
    salary_usd: Decimal | None = None,
    hire_date: dt.date = dt.date(2024, 1, 15),
    employment_status: str = "Active",
) -> Employee:
    sequence_number = next(_employee_code_sequence)
    return Employee(
        employee_code=f"EMP{sequence_number:05d}",
        first_name=first_name,
        last_name=last_name,
        email=f"employee.{sequence_number}@example.com",
        department_id=department_id,
        country_id=country_id,
        job_title="Software Engineer",
        job_level="IC2",
        salary_local=salary_local,
        salary_usd=salary_usd if salary_usd is not None else salary_local,
        hire_date=hire_date,
        employment_status=employment_status,
    )


def test_list_employees_paginates_correctly(db_session):
    department = _build_department()
    country = _build_country()
    db_session.add_all([department, country])
    db_session.commit()

    for last_name in ("Adams", "Baker", "Clark", "Davis", "Evans"):
        db_session.add(_build_employee(department_id=department.id, country_id=country.id, last_name=last_name))
    db_session.commit()

    result = employee_service.list_employees(db_session, EmployeeListParams(page=2, page_size=2))

    assert result.total_items == 5
    assert result.total_pages == 3
    assert [row.last_name for row in result.items] == ["Clark", "Davis"]


def test_list_employees_filters_by_department_country_and_status(db_session):
    engineering = _build_department(name="Engineering")
    sales = _build_department(name="Sales")
    us = _build_country(code="US", name="United States")
    india = _build_country(code="IN", name="India", currency_code="INR")
    db_session.add_all([engineering, sales, us, india])
    db_session.commit()

    db_session.add(_build_employee(department_id=engineering.id, country_id=us.id, last_name="Adams"))
    db_session.add(_build_employee(department_id=sales.id, country_id=india.id, last_name="Baker"))
    db_session.add(
        _build_employee(
            department_id=engineering.id, country_id=us.id, last_name="Clark", employment_status="Terminated"
        )
    )
    db_session.commit()

    result = employee_service.list_employees(db_session, EmployeeListParams(department_id=engineering.id))

    assert [row.last_name for row in result.items] == ["Adams"]


def test_list_employees_search_matches_name_email_and_code(db_session):
    department = _build_department()
    country = _build_country()
    db_session.add_all([department, country])
    db_session.commit()

    db_session.add(_build_employee(department_id=department.id, country_id=country.id, first_name="Priya", last_name="Shah"))
    db_session.add(_build_employee(department_id=department.id, country_id=country.id, first_name="Sam", last_name="Lee"))
    db_session.commit()

    result = employee_service.list_employees(db_session, EmployeeListParams(search="priya"))

    assert [row.first_name for row in result.items] == ["Priya"]


def test_list_employees_sorts_by_allowed_fields(db_session):
    department = _build_department()
    country = _build_country()
    db_session.add_all([department, country])
    db_session.commit()

    db_session.add(_build_employee(department_id=department.id, country_id=country.id, salary_local=Decimal("90000.00")))
    db_session.add(_build_employee(department_id=department.id, country_id=country.id, salary_local=Decimal("70000.00")))
    db_session.add(_build_employee(department_id=department.id, country_id=country.id, salary_local=Decimal("110000.00")))
    db_session.commit()

    ascending = employee_service.list_employees(db_session, EmployeeListParams(sort_by="salary_usd", sort_dir="asc"))
    descending = employee_service.list_employees(db_session, EmployeeListParams(sort_by="salary_usd", sort_dir="desc"))

    assert [row.salary_usd for row in ascending.items] == [Decimal("70000.00"), Decimal("90000.00"), Decimal("110000.00")]
    assert [row.salary_usd for row in descending.items] == [Decimal("110000.00"), Decimal("90000.00"), Decimal("70000.00")]


def test_list_employees_unknown_sort_by_falls_back_to_default(db_session):
    department = _build_department()
    country = _build_country()
    db_session.add_all([department, country])
    db_session.commit()

    db_session.add(_build_employee(department_id=department.id, country_id=country.id, last_name="Zeta"))
    db_session.add(_build_employee(department_id=department.id, country_id=country.id, last_name="Alpha"))
    db_session.commit()

    result = employee_service.list_employees(db_session, EmployeeListParams(sort_by="not_a_real_field"))

    assert [row.last_name for row in result.items] == ["Alpha", "Zeta"]


def test_list_employees_page_past_last_page_returns_empty_items(db_session):
    department = _build_department()
    country = _build_country()
    db_session.add_all([department, country])
    db_session.commit()

    db_session.add(_build_employee(department_id=department.id, country_id=country.id))
    db_session.commit()

    result = employee_service.list_employees(db_session, EmployeeListParams(page=5, page_size=10))

    assert result.items == []
    assert result.total_items == 1
    assert result.total_pages == 1


def test_list_employees_paginates_low_cardinality_sort_without_repeats_or_gaps(db_session):
    department = _build_department()
    country = _build_country()
    db_session.add_all([department, country])
    db_session.commit()

    # All same job_level (a low-cardinality column with no secondary sort key of its own) -- without
    # a tiebreaker, SQLite is free to order these ties differently between the two page queries below.
    last_names = [f"Employee{i:02d}" for i in range(5)]
    for last_name in last_names:
        db_session.add(_build_employee(department_id=department.id, country_id=country.id, last_name=last_name))
    db_session.commit()

    page_one = employee_service.list_employees(
        db_session, EmployeeListParams(sort_by="job_level", page=1, page_size=2)
    )
    page_two = employee_service.list_employees(
        db_session, EmployeeListParams(sort_by="job_level", page=2, page_size=2)
    )
    page_three = employee_service.list_employees(
        db_session, EmployeeListParams(sort_by="job_level", page=3, page_size=2)
    )

    seen_last_names = [row.last_name for page in (page_one, page_two, page_three) for row in page.items]
    assert sorted(seen_last_names) == sorted(last_names)
    assert len(seen_last_names) == len(set(seen_last_names))


def test_create_employee_computes_employee_code_and_salary_usd(db_session):
    department = _build_department()
    country = _build_country(fx_rate_to_usd=Decimal("0.012000"))
    db_session.add_all([department, country])
    db_session.commit()

    db_session.add(_build_employee(department_id=department.id, country_id=country.id))
    db_session.commit()

    request = EmployeeCreateRequest(
        first_name="Nina",
        last_name="Rao",
        email="nina.rao@example.com",
        department_id=department.id,
        country_id=country.id,
        job_title="Data Analyst",
        job_level="IC1",
        salary_local=Decimal("500000.00"),
        hire_date=dt.date(2026, 2, 1),
    )

    created = employee_service.create_employee(db_session, request)

    assert created.employee_code == "EMP00002"
    assert created.salary_usd == Decimal("6000.00")


def test_create_employee_with_duplicate_email_raises_conflict_error(db_session):
    department = _build_department()
    country = _build_country()
    db_session.add_all([department, country])
    db_session.commit()

    existing = _build_employee(department_id=department.id, country_id=country.id)
    db_session.add(existing)
    db_session.commit()

    request = EmployeeCreateRequest(
        first_name="Nina",
        last_name="Rao",
        email=existing.email,
        department_id=department.id,
        country_id=country.id,
        job_title="Data Analyst",
        job_level="IC1",
        salary_local=Decimal("500000.00"),
        hire_date=dt.date(2026, 2, 1),
    )

    with pytest.raises(ConflictError):
        employee_service.create_employee(db_session, request)


def test_update_employee_writes_salary_history_when_salary_changes(db_session):
    department = _build_department()
    country = _build_country()
    db_session.add_all([department, country])
    db_session.commit()

    employee = _build_employee(department_id=department.id, country_id=country.id, salary_local=Decimal("100000.00"))
    db_session.add(employee)
    db_session.commit()

    request = EmployeeUpdateRequest(
        first_name=employee.first_name,
        last_name=employee.last_name,
        email=employee.email,
        department_id=department.id,
        country_id=country.id,
        job_title=employee.job_title,
        job_level=employee.job_level,
        salary_local=Decimal("120000.00"),
        hire_date=employee.hire_date,
        employment_status="Active",
    )

    employee_service.update_employee(db_session, employee.id, request)
    history = employee_service.get_salary_history(db_session, employee.id)

    assert len(history) == 1
    assert history[0].old_salary_local == Decimal("100000.00")
    assert history[0].new_salary_local == Decimal("120000.00")


def test_update_employee_does_not_write_salary_history_when_salary_unchanged(db_session):
    department = _build_department()
    country = _build_country()
    db_session.add_all([department, country])
    db_session.commit()

    employee = _build_employee(department_id=department.id, country_id=country.id, salary_local=Decimal("100000.00"))
    db_session.add(employee)
    db_session.commit()

    request = EmployeeUpdateRequest(
        first_name=employee.first_name,
        last_name=employee.last_name,
        email=employee.email,
        department_id=department.id,
        country_id=country.id,
        job_title="Senior Software Engineer",
        job_level=employee.job_level,
        salary_local=employee.salary_local,
        hire_date=employee.hire_date,
        employment_status="Active",
    )

    employee_service.update_employee(db_session, employee.id, request)
    history = employee_service.get_salary_history(db_session, employee.id)

    assert history == []


def test_update_employee_with_another_employees_email_raises_conflict_error(db_session):
    department = _build_department()
    country = _build_country()
    db_session.add_all([department, country])
    db_session.commit()

    first = _build_employee(department_id=department.id, country_id=country.id, first_name="Jane")
    second = _build_employee(department_id=department.id, country_id=country.id, first_name="Sam")
    db_session.add_all([first, second])
    db_session.commit()

    request = EmployeeUpdateRequest(
        first_name=second.first_name,
        last_name=second.last_name,
        email=first.email,  # collides with `first`, not `second`
        department_id=department.id,
        country_id=country.id,
        job_title=second.job_title,
        job_level=second.job_level,
        salary_local=second.salary_local,
        hire_date=second.hire_date,
        employment_status="Active",
    )

    with pytest.raises(ConflictError):
        employee_service.update_employee(db_session, second.id, request)


def test_update_employee_keeping_its_own_email_succeeds(db_session):
    department = _build_department()
    country = _build_country()
    db_session.add_all([department, country])
    db_session.commit()

    employee = _build_employee(department_id=department.id, country_id=country.id)
    db_session.add(employee)
    db_session.commit()

    request = EmployeeUpdateRequest(
        first_name=employee.first_name,
        last_name="Smith",
        email=employee.email,  # unchanged -- must not be rejected as a self-collision
        department_id=department.id,
        country_id=country.id,
        job_title=employee.job_title,
        job_level=employee.job_level,
        salary_local=employee.salary_local,
        hire_date=employee.hire_date,
        employment_status="Active",
    )

    updated = employee_service.update_employee(db_session, employee.id, request)

    assert updated.last_name == "Smith"


def test_deactivate_employee_sets_terminated_status(db_session):
    department = _build_department()
    country = _build_country()
    db_session.add_all([department, country])
    db_session.commit()

    employee = _build_employee(department_id=department.id, country_id=country.id)
    db_session.add(employee)
    db_session.commit()

    updated = employee_service.deactivate_employee(db_session, employee.id)

    assert updated.employment_status == "Terminated"
    assert updated.first_name == employee.first_name


def test_get_salary_history_returns_newest_first_with_hike_percent(db_session):
    department = _build_department()
    country = _build_country()
    db_session.add_all([department, country])
    db_session.commit()

    employee = _build_employee(department_id=department.id, country_id=country.id, salary_local=Decimal("100000.00"))
    db_session.add(employee)
    db_session.commit()

    def _update_salary(new_salary: Decimal) -> None:
        request = EmployeeUpdateRequest(
            first_name=employee.first_name,
            last_name=employee.last_name,
            email=employee.email,
            department_id=department.id,
            country_id=country.id,
            job_title=employee.job_title,
            job_level=employee.job_level,
            salary_local=new_salary,
            hire_date=employee.hire_date,
            employment_status="Active",
        )
        employee_service.update_employee(db_session, employee.id, request)
        db_session.commit()

    _update_salary(Decimal("110000.00"))
    _update_salary(Decimal("121000.00"))

    history = employee_service.get_salary_history(db_session, employee.id)

    assert [row.new_salary_local for row in history] == [Decimal("121000.00"), Decimal("110000.00")]
    assert history[0].hike_percent == Decimal("10.00")
    assert history[1].hike_percent == Decimal("10.00")
