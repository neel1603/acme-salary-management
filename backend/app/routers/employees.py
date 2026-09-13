from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.errors import ConflictError
from app.schemas.common import DEFAULT_EMPLOYMENT_STATUS
from app.schemas.employee import (
    EmployeeCreateRequest,
    EmployeeDetailResponse,
    EmployeeListParams,
    EmployeeListResponse,
    EmployeeSummary,
    EmployeeUpdateRequest,
)
from app.schemas.salary_history import SalaryHistoryItem, SalaryHistoryResponse
from app.services import employee_service

router = APIRouter(tags=["employees"])


def employee_list_params(
    page: int = Query(default=1),
    page_size: int = Query(default=25),
    department_id: int | None = Query(default=None),
    country_id: int | None = Query(default=None),
    employment_status: str = Query(default=DEFAULT_EMPLOYMENT_STATUS),
    search: str | None = Query(default=None),
    sort_by: str = Query(default="last_name"),
    sort_dir: str = Query(default="asc"),
) -> EmployeeListParams:
    return EmployeeListParams(
        page=page,
        page_size=page_size,
        department_id=department_id,
        country_id=country_id,
        employment_status=employment_status,
        search=search,
        sort_by=sort_by,
        sort_dir=sort_dir,
    )


@router.get("/employees", response_model=EmployeeListResponse)
def list_employees(
    params: EmployeeListParams = Depends(employee_list_params),
    db: Session = Depends(get_db),
) -> EmployeeListResponse:
    result = employee_service.list_employees(db, params)
    return EmployeeListResponse(
        items=[EmployeeSummary.model_validate(row) for row in result.items],
        page=result.page,
        page_size=result.page_size,
        total_items=result.total_items,
        total_pages=result.total_pages,
    )


@router.get("/employees/{employee_id}", response_model=EmployeeDetailResponse)
def get_employee(employee_id: int, db: Session = Depends(get_db)) -> EmployeeDetailResponse:
    row = employee_service.get_employee(db, employee_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Employee not found")
    return EmployeeDetailResponse.model_validate(row)


@router.post("/employees", response_model=EmployeeDetailResponse, status_code=201)
def create_employee(request: EmployeeCreateRequest, db: Session = Depends(get_db)) -> EmployeeDetailResponse:
    try:
        row = employee_service.create_employee(db, request)
    except ConflictError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    return EmployeeDetailResponse.model_validate(row)


@router.put("/employees/{employee_id}", response_model=EmployeeDetailResponse)
def update_employee(
    employee_id: int, request: EmployeeUpdateRequest, db: Session = Depends(get_db)
) -> EmployeeDetailResponse:
    try:
        row = employee_service.update_employee(db, employee_id, request)
    except ConflictError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    if row is None:
        raise HTTPException(status_code=404, detail="Employee not found")
    return EmployeeDetailResponse.model_validate(row)


@router.patch("/employees/{employee_id}/deactivate", response_model=EmployeeDetailResponse)
def deactivate_employee(employee_id: int, db: Session = Depends(get_db)) -> EmployeeDetailResponse:
    row = employee_service.deactivate_employee(db, employee_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Employee not found")
    return EmployeeDetailResponse.model_validate(row)


@router.get("/employees/{employee_id}/salary-history", response_model=SalaryHistoryResponse)
def get_salary_history(employee_id: int, db: Session = Depends(get_db)) -> SalaryHistoryResponse:
    if employee_service.get_employee(db, employee_id) is None:
        raise HTTPException(status_code=404, detail="Employee not found")
    history = employee_service.get_salary_history(db, employee_id)
    return SalaryHistoryResponse(data=[SalaryHistoryItem.model_validate(row) for row in history])
