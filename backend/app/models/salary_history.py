from __future__ import annotations

import datetime as dt
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Numeric, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.employee import Employee


class SalaryHistory(Base):
    """One row per salary change, so past salaries and hike % are recoverable."""

    __tablename__ = "salary_history"

    id: Mapped[int] = mapped_column(primary_key=True)
    employee_id: Mapped[int] = mapped_column(ForeignKey("employees.id"), nullable=False, index=True)
    old_salary_local: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    new_salary_local: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    changed_at: Mapped[dt.datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())

    employee: Mapped["Employee"] = relationship()
