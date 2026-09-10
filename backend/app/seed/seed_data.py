from __future__ import annotations

import argparse
import datetime as dt
import random
from decimal import Decimal
from itertools import batched
from typing import Iterator, Sequence

from faker import Faker
from sqlalchemy import insert
from sqlalchemy.orm import Session

from app.database import Base, engine, session_scope
from app.models.country import Country
from app.models.department import Department
from app.models.employee import Employee
from app.seed.reference_data import (
    COUNTRIES,
    DEPARTMENTS,
    FX_RATE_AS_OF,
    JOB_LEVEL_BANDS,
    CountryReference,
    DepartmentReference,
    JobLevelBand,
)

DEFAULT_EMPLOYEE_COUNT = 10_000
SEED = 42
TWO_PLACES = Decimal("0.01")

EMPLOYEE_INSERT_BATCH_SIZE = 1_000

HIRE_DATE_LOWER_BOUND = dt.date(2018, 1, 1)
HIRE_DATE_UPPER_BOUND = dt.date(2026, 9, 1)

EMPLOYMENT_STATUSES = ("Active", "Terminated", "On Leave")
EMPLOYMENT_STATUS_WEIGHTS = (93, 5, 2)

EMAIL_DOMAIN = "acmecorp.example"

ResolvedCountry = tuple[Country, CountryReference]
ResolvedDepartment = tuple[Department, DepartmentReference]


def _seed_reference_tables(session: Session) -> tuple[list[ResolvedCountry], list[ResolvedDepartment]]:
    """Insert countries/departments, pairing each ORM row with its reference metadata (weight/scale)."""
    resolved_countries: list[ResolvedCountry] = []
    for reference in COUNTRIES:
        country = Country(
            code=reference.code,
            name=reference.name,
            currency_code=reference.currency_code,
            fx_rate_to_usd=reference.fx_rate_to_usd,
            fx_rate_as_of=FX_RATE_AS_OF,
        )
        session.add(country)
        resolved_countries.append((country, reference))

    resolved_departments: list[ResolvedDepartment] = []
    for reference in DEPARTMENTS:
        department = Department(name=reference.name)
        session.add(department)
        resolved_departments.append((department, reference))

    session.flush()  # assigns ids, needed as FK values on the employee rows below
    return resolved_countries, resolved_departments


def _draw_salary_usd(rng: random.Random, band: JobLevelBand, scale: Decimal) -> Decimal:
    """Randomly draw within the level's USD band, then apply the department x country scale."""
    raw_usd = rng.triangular(band.min_usd, band.mid_usd, band.max_usd)
    return (Decimal(str(raw_usd)) * scale).quantize(TWO_PLACES)


def _random_hire_date(rng: random.Random) -> dt.date:
    days_span = (HIRE_DATE_UPPER_BOUND - HIRE_DATE_LOWER_BOUND).days
    return HIRE_DATE_LOWER_BOUND + dt.timedelta(days=rng.randint(0, days_span))


def _generate_employee_rows(
    *,
    count: int,
    resolved_countries: Sequence[ResolvedCountry],
    resolved_departments: Sequence[ResolvedDepartment],
    rng: random.Random,
    fake: Faker,
) -> Iterator[dict]:
    """Yield one employee dict at a time, so all `count` rows are never held in memory together."""
    country_weights = [reference.headcount_weight for _, reference in resolved_countries]
    department_weights = [reference.headcount_weight for _, reference in resolved_departments]
    level_weights = [band.headcount_weight for band in JOB_LEVEL_BANDS]

    for sequence_number in range(1, count + 1):
        country, country_reference = rng.choices(resolved_countries, weights=country_weights, k=1)[0]
        department, department_reference = rng.choices(resolved_departments, weights=department_weights, k=1)[0]
        band = rng.choices(JOB_LEVEL_BANDS, weights=level_weights, k=1)[0]

        target_usd = _draw_salary_usd(rng, band, department_reference.salary_scale * country_reference.salary_scale)
        salary_local = (target_usd / country_reference.fx_rate_to_usd).quantize(TWO_PLACES)
        salary_usd = (salary_local * country_reference.fx_rate_to_usd).quantize(TWO_PLACES)

        first_name = fake.first_name()
        last_name = fake.last_name()

        yield {
            "employee_code": f"EMP{sequence_number:05d}",
            "first_name": first_name,
            "last_name": last_name,
            "email": f"{first_name.lower()}.{last_name.lower()}.{sequence_number}@{EMAIL_DOMAIN}",
            "department_id": department.id,
            "country_id": country.id,
            "job_title": f"{department_reference.name} {band.level}",
            "job_level": band.level,
            "salary_local": salary_local,
            "salary_usd": salary_usd,
            "hire_date": _random_hire_date(rng),
            "employment_status": rng.choices(EMPLOYMENT_STATUSES, weights=EMPLOYMENT_STATUS_WEIGHTS, k=1)[0],
            "manager_id": None,
        }


def seed_database(session: Session, *, employee_count: int = DEFAULT_EMPLOYEE_COUNT, seed: int = SEED) -> None:
    """Populate an empty schema with reference data + `employee_count` employees, deterministically."""
    Faker.seed(seed)
    fake = Faker()
    rng = random.Random(seed)

    resolved_countries, resolved_departments = _seed_reference_tables(session)
    employee_row_generator = _generate_employee_rows(
        count=employee_count,
        resolved_countries=resolved_countries,
        resolved_departments=resolved_departments,
        rng=rng,
        fake=fake,
    )
    for batch in batched(employee_row_generator, EMPLOYEE_INSERT_BATCH_SIZE):
        session.execute(insert(Employee), list(batch))


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed the ACME salary database with mock reference + employee data.")
    parser.add_argument("--count", type=int, default=DEFAULT_EMPLOYEE_COUNT, help="Number of employees to seed")
    parser.add_argument("--reset", action="store_true", help="Drop and recreate all tables before seeding")
    args = parser.parse_args()

    if args.reset:
        Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)

    with session_scope() as session:
        seed_database(session, employee_count=args.count)

    print(f"Seeded {args.count} employees across {len(COUNTRIES)} countries and {len(DEPARTMENTS)} departments.")


if __name__ == "__main__":
    main()
