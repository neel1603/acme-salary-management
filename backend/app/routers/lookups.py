from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.country import Country
from app.models.department import Department
from app.schemas.lookups import CountryResponse, DepartmentResponse

router = APIRouter(tags=["lookups"])


@router.get("/countries", response_model=list[CountryResponse])
def list_countries(db: Session = Depends(get_db)) -> list[Country]:
    return db.query(Country).order_by(Country.name).all()


@router.get("/departments", response_model=list[DepartmentResponse])
def list_departments(db: Session = Depends(get_db)) -> list[Department]:
    return db.query(Department).order_by(Department.name).all()
