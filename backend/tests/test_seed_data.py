from __future__ import annotations

from decimal import Decimal

from app.database import Base, create_engine_with_foreign_keys_enabled
from app.models.country import Country
from app.models.department import Department
from app.models.employee import Employee
from app.seed.reference_data import COUNTRIES, DEPARTMENTS
from app.seed.seed_data import seed_database
from sqlalchemy.orm import Session


def _seeded_employee_snapshot(employee_count: int) -> list[tuple[str, Decimal]]:
    """Seed a fresh in-memory database and return (employee_code, salary_usd) for every row."""
    engine = create_engine_with_foreign_keys_enabled("sqlite:///:memory:", use_static_pool=True)
    Base.metadata.create_all(engine)
    session = Session(engine)
    try:
        seed_database(session, employee_count=employee_count)
        rows = session.query(Employee).order_by(Employee.id).all()
        return [(row.employee_code, row.salary_usd) for row in rows]
    finally:
        session.close()
        engine.dispose()


def test_seed_creates_expected_row_counts(db_session):
    seed_database(db_session, employee_count=200)

    assert db_session.query(Country).count() == len(COUNTRIES)
    assert db_session.query(Department).count() == len(DEPARTMENTS)
    assert db_session.query(Employee).count() == 200


def test_seed_is_deterministic_with_same_seed():
    first_run = _seeded_employee_snapshot(200)
    second_run = _seeded_employee_snapshot(200)

    assert first_run == second_run


def test_seed_employee_codes_are_sequential_and_unique(db_session):
    seed_database(db_session, employee_count=50)

    codes = [row.employee_code for row in db_session.query(Employee).order_by(Employee.id)]

    assert codes == [f"EMP{sequence_number:05d}" for sequence_number in range(1, 51)]


def test_seed_salary_usd_matches_local_times_fx_rate(db_session):
    seed_database(db_session, employee_count=100)

    for employee in db_session.query(Employee).all():
        country = db_session.get(Country, employee.country_id)
        expected_salary_usd = (employee.salary_local * country.fx_rate_to_usd).quantize(Decimal("0.01"))

        assert employee.salary_usd == expected_salary_usd


def test_seed_employment_status_is_mostly_active(db_session):
    seed_database(db_session, employee_count=2000)

    statuses = [row.employment_status for row in db_session.query(Employee).all()]
    active_share = statuses.count("Active") / len(statuses)

    assert 0.85 <= active_share <= 0.97
