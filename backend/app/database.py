from __future__ import annotations

from contextlib import contextmanager
from typing import Iterator

from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.config import settings


class Base(DeclarativeBase):
    pass


def create_engine_with_foreign_keys_enabled(database_url: str, *, use_static_pool: bool = False) -> Engine:
    """SQLite does not enforce foreign key constraints unless told to, per connection."""
    engine_kwargs: dict = {"connect_args": {"check_same_thread": False}}
    if use_static_pool:
        engine_kwargs["poolclass"] = StaticPool
    engine = create_engine(database_url, **engine_kwargs)

    @event.listens_for(engine, "connect")
    def _enable_sqlite_foreign_key_enforcement(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    return engine


engine = create_engine_with_foreign_keys_enabled(settings.database_url)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


@contextmanager
def session_scope(session_factory: sessionmaker = SessionLocal) -> Iterator[Session]:
    """Open a session, commit on success, roll back on error, always close."""
    session = session_factory()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def get_db() -> Iterator[Session]:
    """FastAPI dependency: a request-scoped session, via session_scope()."""
    with session_scope() as session:
        yield session


def ensure_seeded() -> None:
    """Create the schema and seed it if empty.

    Cheap no-op once already seeded. Self-heals a fresh filesystem (e.g. a new Vercel
    instance's wiped /tmp) without a separate manual seed step. Imports deferred to avoid
    a circular import (app.seed.seed_data and app.models.employee both import from here).
    """
    from app.models.employee import Employee
    from app.seed.seed_data import seed_database

    Base.metadata.create_all(engine)
    with session_scope() as session:
        if session.query(Employee).first() is None:
            seed_database(session)
