from __future__ import annotations

import datetime as dt
from dataclasses import dataclass
from decimal import Decimal

FX_RATE_AS_OF = dt.date(2026, 1, 1)


@dataclass(frozen=True)
class CountryReference:
    """One seedable country: currency/FX metadata plus sampling weight and salary scale."""

    code: str
    name: str
    currency_code: str
    fx_rate_to_usd: Decimal
    headcount_weight: int
    salary_scale: Decimal


@dataclass(frozen=True)
class DepartmentReference:
    """One seedable department: sampling weight and a salary premium/discount on the level band."""

    name: str
    headcount_weight: int
    salary_scale: Decimal


@dataclass(frozen=True)
class JobLevelBand:
    """Base USD salary band for a job level, before department/country scaling, plus a pyramid sampling weight."""

    level: str
    min_usd: int
    mid_usd: int
    max_usd: int
    headcount_weight: int


COUNTRIES: tuple[CountryReference, ...] = (
    CountryReference("US", "United States", "USD", Decimal("1.00"), 30, Decimal("1.00")),
    CountryReference("IN", "India", "INR", Decimal("0.012"), 25, Decimal("0.35")),
    CountryReference("GB", "United Kingdom", "GBP", Decimal("1.27"), 12, Decimal("0.85")),
    CountryReference("DE", "Germany", "EUR", Decimal("1.09"), 10, Decimal("0.80")),
    CountryReference("CA", "Canada", "CAD", Decimal("0.74"), 8, Decimal("0.85")),
    CountryReference("AU", "Australia", "AUD", Decimal("0.66"), 6, Decimal("0.90")),
    CountryReference("SG", "Singapore", "SGD", Decimal("0.75"), 5, Decimal("0.75")),
    CountryReference("BR", "Brazil", "BRL", Decimal("0.20"), 4, Decimal("0.40")),
)

DEPARTMENTS: tuple[DepartmentReference, ...] = (
    DepartmentReference("Engineering", 25, Decimal("1.15")),
    DepartmentReference("Customer Support", 15, Decimal("0.80")),
    DepartmentReference("Sales", 18, Decimal("1.05")),
    DepartmentReference("Operations", 12, Decimal("0.90")),
    DepartmentReference("Marketing", 10, Decimal("0.95")),
    DepartmentReference("Product/Data", 10, Decimal("1.15")),
    DepartmentReference("Finance", 6, Decimal("1.05")),
    DepartmentReference("HR", 4, Decimal("0.90")),
)

JOB_LEVEL_BANDS: tuple[JobLevelBand, ...] = (
    JobLevelBand("IC1", 55_000, 63_000, 72_000, 20),
    JobLevelBand("IC2", 68_000, 80_000, 95_000, 22),
    JobLevelBand("IC3", 85_000, 102_000, 120_000, 18),
    JobLevelBand("IC4", 105_000, 125_000, 145_000, 14),
    JobLevelBand("Senior", 120_000, 140_000, 165_000, 10),
    JobLevelBand("Staff", 145_000, 170_000, 195_000, 6),
    JobLevelBand("Manager", 130_000, 155_000, 180_000, 5),
    JobLevelBand("Director", 170_000, 200_000, 230_000, 3),
    JobLevelBand("VP", 220_000, 260_000, 300_000, 2),
)
