from __future__ import annotations

import pytest
from sqlalchemy import inspect
from sqlalchemy.exc import IntegrityError

from app.models.salary_history import SalaryHistory


def test_salary_history_table_creates_successfully(db_session):
    inspector = inspect(db_session.get_bind())
    column_names = {column["name"] for column in inspector.get_columns("salary_history")}

    assert column_names == {"id", "employee_id", "old_salary_local", "new_salary_local", "changed_at"}


def test_salary_history_requires_valid_employee(db_session):
    salary_history_with_bad_employee_id = SalaryHistory(
        employee_id=999,
        old_salary_local=100000,
        new_salary_local=110000,
    )
    db_session.add(salary_history_with_bad_employee_id)

    with pytest.raises(IntegrityError):
        db_session.commit()
