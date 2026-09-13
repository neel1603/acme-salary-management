from __future__ import annotations

import datetime as dt
import math
from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal

from sqlalchemy import Select, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, contains_eager

from app.errors import ConflictError
from app.models.country import Country
from app.models.department import Department
from app.models.employee import Employee
from app.models.salary_history import SalaryHistory
from app.schemas.employee import EmployeeCreateRequest, EmployeeListParams, EmployeeUpdateRequest

_CENTS = Decimal("0.01")
DEFAULT_SORT_BY = "last_name"

_SORT_COLUMNS = {
    "first_name": Employee.first_name,
    "last_name": Employee.last_name,
    "employee_code": Employee.employee_code,
    "department": Department.name,
    "country": Country.name,
    "job_title": Employee.job_title,
    "job_level": Employee.job_level,
    "salary_usd": Employee.salary_usd,
    "hire_date": Employee.hire_date,
}


@dataclass(frozen=True)
class EmployeeSummaryRow:
    id: int
    employee_code: str
    first_name: str
    last_name: str
    email: str
    department_name: str
    country_name: str
    job_title: str
    job_level: str
    salary_usd: Decimal
    hire_date: dt.date
    employment_status: str


@dataclass(frozen=True)
class EmployeeDetailRow:
    id: int
    employee_code: str
    first_name: str
    last_name: str
    email: str
    department_id: int
    department_name: str
    country_id: int
    country_name: str
    job_title: str
    job_level: str
    salary_local: Decimal
    salary_usd: Decimal
    currency_code: str
    hire_date: dt.date
    employment_status: str
    manager_id: int | None
    created_at: dt.datetime
    updated_at: dt.datetime


@dataclass(frozen=True)
class EmployeeListResult:
    items: list[EmployeeSummaryRow]
    page: int
    page_size: int
    total_items: int
    total_pages: int


@dataclass(frozen=True)
class SalaryHistoryRow:
    id: int
    old_salary_local: Decimal
    new_salary_local: Decimal
    hike_percent: Decimal
    changed_at: dt.datetime


def _to_usd(salary_local: Decimal, fx_rate_to_usd: Decimal) -> Decimal:
    return (salary_local * fx_rate_to_usd).quantize(_CENTS, rounding=ROUND_HALF_UP)


def _hike_percent(old_salary_local: Decimal, new_salary_local: Decimal) -> Decimal:
    return ((new_salary_local - old_salary_local) / old_salary_local * 100).quantize(_CENTS, rounding=ROUND_HALF_UP)


def _to_summary_row(employee: Employee) -> EmployeeSummaryRow:
    return EmployeeSummaryRow(
        id=employee.id,
        employee_code=employee.employee_code,
        first_name=employee.first_name,
        last_name=employee.last_name,
        email=employee.email,
        department_name=employee.department.name,
        country_name=employee.country.name,
        job_title=employee.job_title,
        job_level=employee.job_level,
        salary_usd=employee.salary_usd,
        hire_date=employee.hire_date,
        employment_status=employee.employment_status,
    )


def _to_detail_row(employee: Employee) -> EmployeeDetailRow:
    return EmployeeDetailRow(
        id=employee.id,
        employee_code=employee.employee_code,
        first_name=employee.first_name,
        last_name=employee.last_name,
        email=employee.email,
        department_id=employee.department_id,
        department_name=employee.department.name,
        country_id=employee.country_id,
        country_name=employee.country.name,
        job_title=employee.job_title,
        job_level=employee.job_level,
        salary_local=employee.salary_local,
        salary_usd=employee.salary_usd,
        currency_code=employee.country.currency_code,
        hire_date=employee.hire_date,
        employment_status=employee.employment_status,
        manager_id=employee.manager_id,
        created_at=employee.created_at,
        updated_at=employee.updated_at,
    )


def _matching_employees(params: EmployeeListParams) -> Select:
    query = select(Employee).join(Department, Employee.department_id == Department.id).join(
        Country, Employee.country_id == Country.id
    )
    if params.department_id is not None:
        query = query.where(Employee.department_id == params.department_id)
    if params.country_id is not None:
        query = query.where(Employee.country_id == params.country_id)
    if params.status_filter is not None:
        query = query.where(Employee.employment_status == params.status_filter)
    if params.search:
        pattern = f"%{params.search}%"
        query = query.where(
            or_(
                Employee.first_name.ilike(pattern),
                Employee.last_name.ilike(pattern),
                Employee.email.ilike(pattern),
                Employee.employee_code.ilike(pattern),
            )
        )
    return query


def list_employees(db: Session, params: EmployeeListParams) -> EmployeeListResult:
    base_query = _matching_employees(params)

    total_items = db.scalar(select(func.count()).select_from(base_query.with_only_columns(Employee.id).subquery())) or 0

    sort_column = _SORT_COLUMNS.get(params.sort_by, _SORT_COLUMNS[DEFAULT_SORT_BY])
    order_clause = sort_column.desc() if params.sort_dir.lower() == "desc" else sort_column.asc()

    page = params.clamped_page
    page_size = params.clamped_page_size

    employees = (
        db.scalars(
            base_query.options(contains_eager(Employee.department), contains_eager(Employee.country))
            # Employee.id.asc() is a tiebreaker: without it, paginating a sort on a low-cardinality
            # column (job_level, department, country) lets SQLite order tied rows differently between
            # requests, so a row can repeat across two pages or be skipped entirely.
            .order_by(order_clause, Employee.id.asc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        .unique()
        .all()
    )

    total_pages = math.ceil(total_items / page_size) if total_items else 0

    return EmployeeListResult(
        items=[_to_summary_row(employee) for employee in employees],
        page=page,
        page_size=page_size,
        total_items=total_items,
        total_pages=total_pages,
    )


def get_employee(db: Session, employee_id: int) -> EmployeeDetailRow | None:
    employee = db.get(Employee, employee_id)
    if employee is None:
        return None
    return _to_detail_row(employee)


def _email_in_use(db: Session, email: str, *, exclude_employee_id: int | None = None) -> bool:
    query = select(Employee.id).where(Employee.email == email)
    if exclude_employee_id is not None:
        query = query.where(Employee.id != exclude_employee_id)
    return db.scalar(query) is not None


def create_employee(db: Session, request: EmployeeCreateRequest) -> EmployeeDetailRow:
    if db.get(Department, request.department_id) is None:
        raise ValueError(f"department {request.department_id} not found")

    country = db.get(Country, request.country_id)
    if country is None:
        raise ValueError(f"country {request.country_id} not found")

    if _email_in_use(db, request.email):
        raise ConflictError(f"email {request.email} is already in use by another employee")

    next_id = (db.scalar(select(func.max(Employee.id))) or 0) + 1
    employee = Employee(
        employee_code=f"EMP{next_id:05d}",
        first_name=request.first_name,
        last_name=request.last_name,
        email=request.email,
        department_id=request.department_id,
        country_id=request.country_id,
        job_title=request.job_title,
        job_level=request.job_level,
        salary_local=request.salary_local,
        salary_usd=_to_usd(request.salary_local, country.fx_rate_to_usd),
        hire_date=request.hire_date,
        employment_status=request.employment_status,
    )
    db.add(employee)
    try:
        db.flush()
    except IntegrityError as error:
        # Backstop for races or unique columns the pre-check above doesn't cover (e.g. employee_code,
        # generated from max(id)+1 and thus vulnerable to a concurrent insert). Deliberately generic --
        # the pre-check above is what gives a precise "email already in use" message.
        db.rollback()
        raise ConflictError("could not create employee: a unique field conflicts with an existing employee") from error
    db.refresh(employee)
    return _to_detail_row(employee)


def update_employee(db: Session, employee_id: int, request: EmployeeUpdateRequest) -> EmployeeDetailRow | None:
    employee = db.get(Employee, employee_id)
    if employee is None:
        return None

    if db.get(Department, request.department_id) is None:
        raise ValueError(f"department {request.department_id} not found")

    country = db.get(Country, request.country_id)
    if country is None:
        raise ValueError(f"country {request.country_id} not found")

    if _email_in_use(db, request.email, exclude_employee_id=employee_id):
        raise ConflictError(f"email {request.email} is already in use by another employee")

    if request.salary_local != employee.salary_local:
        db.add(
            SalaryHistory(
                employee_id=employee.id,
                old_salary_local=employee.salary_local,
                new_salary_local=request.salary_local,
            )
        )

    employee.first_name = request.first_name
    employee.last_name = request.last_name
    employee.email = request.email
    employee.department_id = request.department_id
    employee.country_id = request.country_id
    employee.job_title = request.job_title
    employee.job_level = request.job_level
    employee.salary_local = request.salary_local
    employee.salary_usd = _to_usd(request.salary_local, country.fx_rate_to_usd)
    employee.hire_date = request.hire_date
    employee.employment_status = request.employment_status

    try:
        db.flush()
    except IntegrityError as error:
        db.rollback()
        raise ConflictError("could not update employee: a unique field conflicts with an existing employee") from error
    db.refresh(employee)
    return _to_detail_row(employee)


def deactivate_employee(db: Session, employee_id: int) -> EmployeeDetailRow | None:
    employee = db.get(Employee, employee_id)
    if employee is None:
        return None

    employee.employment_status = "Terminated"
    db.flush()
    db.refresh(employee)
    return _to_detail_row(employee)


def get_salary_history(db: Session, employee_id: int) -> list[SalaryHistoryRow]:
    history_rows = db.scalars(
        select(SalaryHistory)
        .where(SalaryHistory.employee_id == employee_id)
        .order_by(SalaryHistory.changed_at.desc(), SalaryHistory.id.desc())
    ).all()

    return [
        SalaryHistoryRow(
            id=row.id,
            old_salary_local=row.old_salary_local,
            new_salary_local=row.new_salary_local,
            hike_percent=_hike_percent(row.old_salary_local, row.new_salary_local),
            changed_at=row.changed_at,
        )
        for row in history_rows
    ]
