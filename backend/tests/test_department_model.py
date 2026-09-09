from __future__ import annotations

import pytest
from sqlalchemy import inspect
from sqlalchemy.exc import IntegrityError

from app.models.department import Department


def test_department_table_creates_successfully(db_session):
    inspector = inspect(db_session.get_bind())
    column_names = {column["name"] for column in inspector.get_columns("departments")}

    assert column_names == {"id", "name"}


def test_department_name_is_unique(db_session):
    db_session.add(Department(name="Engineering"))
    db_session.commit()

    db_session.add(Department(name="Engineering"))
    with pytest.raises(IntegrityError):
        db_session.commit()
