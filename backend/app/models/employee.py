from __future__ import annotations

import datetime as dt
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import Date, DateTime, ForeignKey, Index, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.country import Country
    from app.models.department import Department


class Employee(Base):
    """Core table — one row per employee, current state only."""

    __tablename__ = "employees"
    __table_args__ = (
        Index("ix_employees_status_department", "employment_status", "department_id"),
        Index("ix_employees_status_country", "employment_status", "country_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    employee_code: Mapped[str] = mapped_column(String, unique=True, nullable=False, index=True)
    first_name: Mapped[str] = mapped_column(String, nullable=False)
    last_name: Mapped[str] = mapped_column(String, nullable=False)
    email: Mapped[str] = mapped_column(String, unique=True, nullable=False)

    department_id: Mapped[int] = mapped_column(ForeignKey("departments.id"), nullable=False, index=True)
    country_id: Mapped[int] = mapped_column(ForeignKey("countries.id"), nullable=False, index=True)

    job_title: Mapped[str] = mapped_column(String, nullable=False)
    job_level: Mapped[str] = mapped_column(String, nullable=False)

    salary_local: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    salary_usd: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)

    hire_date: Mapped[dt.date] = mapped_column(Date, nullable=False, index=True)
    employment_status: Mapped[str] = mapped_column(String, nullable=False, index=True)

    manager_id: Mapped[int | None] = mapped_column(ForeignKey("employees.id"), nullable=True)

    created_at: Mapped[dt.datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())
    updated_at: Mapped[dt.datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now(), onupdate=func.now()
    )

    department: Mapped[Department] = relationship()
    country: Mapped[Country] = relationship()
