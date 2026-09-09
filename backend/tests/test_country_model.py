from __future__ import annotations

import datetime as dt

import pytest
from sqlalchemy import inspect
from sqlalchemy.exc import IntegrityError

from app.models.country import Country


def _build_country(code: str = "US", name: str = "United States") -> Country:
    return Country(
        code=code,
        name=name,
        currency_code="USD",
        fx_rate_to_usd=1.0,
        fx_rate_as_of=dt.date(2026, 1, 1),
    )


def test_country_table_creates_successfully(db_session):
    inspector = inspect(db_session.get_bind())
    column_names = {column["name"] for column in inspector.get_columns("countries")}

    assert column_names == {"id", "code", "name", "currency_code", "fx_rate_to_usd", "fx_rate_as_of"}


def test_country_code_is_unique(db_session):
    db_session.add(_build_country(code="US", name="United States"))
    db_session.commit()

    db_session.add(_build_country(code="US", name="Duplicate United States"))
    with pytest.raises(IntegrityError):
        db_session.commit()
