from __future__ import annotations

import datetime as dt
from decimal import Decimal

from app.models.country import Country
from app.models.department import Department


def _seed_lookup_rows(in_memory_session_factory) -> None:
    session = in_memory_session_factory()
    try:
        session.add(
            Country(
                code="US",
                name="United States",
                currency_code="USD",
                fx_rate_to_usd=Decimal("1.00"),
                fx_rate_as_of=dt.date(2026, 1, 1),
            )
        )
        session.add(Department(name="Engineering"))
        session.commit()
    finally:
        session.close()


def test_list_countries_returns_seeded_rows(client, in_memory_session_factory):
    _seed_lookup_rows(in_memory_session_factory)

    response = client.get("/api/v1/countries")

    assert response.status_code == 200
    assert response.json() == [{"id": 1, "code": "US", "name": "United States", "currency_code": "USD"}]


def test_list_departments_returns_seeded_rows(client, in_memory_session_factory):
    _seed_lookup_rows(in_memory_session_factory)

    response = client.get("/api/v1/departments")

    assert response.status_code == 200
    assert response.json() == [{"id": 1, "name": "Engineering"}]


def test_list_countries_returns_empty_list_when_none_seeded(client):
    response = client.get("/api/v1/countries")

    assert response.status_code == 200
    assert response.json() == []
