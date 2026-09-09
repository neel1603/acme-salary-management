from __future__ import annotations

import datetime as dt
from decimal import Decimal

from sqlalchemy import Date, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Country(Base):
    """Lookup table for the countries ACME operates in, carrying currency/FX metadata."""

    __tablename__ = "countries"

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(2), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False)
    currency_code: Mapped[str] = mapped_column(String(3), nullable=False)
    fx_rate_to_usd: Mapped[Decimal] = mapped_column(Numeric(12, 6), nullable=False)
    fx_rate_as_of: Mapped[dt.date] = mapped_column(Date, nullable=False)
