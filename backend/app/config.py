from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    """Runtime config. Defaults suit local dev; override via env vars for Docker/cloud deployment."""

    database_url: str = os.getenv("DATABASE_URL", "sqlite:///./acme_salary.db")
    allowed_origins: tuple[str, ...] = tuple(
        origin.strip()
        for origin in os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",")
        if origin.strip()
    )


settings = Settings()
