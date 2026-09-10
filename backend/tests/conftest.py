from __future__ import annotations

import pytest
from sqlalchemy.orm import Session, sessionmaker

import app.models  # noqa: F401 - ensures all models are registered on Base before create_all
from app.database import Base, create_engine_with_foreign_keys_enabled


@pytest.fixture()
def db_session():
    in_memory_engine = create_engine_with_foreign_keys_enabled("sqlite:///:memory:", use_static_pool=True)
    Base.metadata.create_all(in_memory_engine)
    session = Session(in_memory_engine)
    try:
        yield session
    finally:
        session.close()
        in_memory_engine.dispose()


@pytest.fixture()
def in_memory_session_factory():
    """A sessionmaker (not a bound session) so session-lifecycle helpers like session_scope() can be tested."""
    in_memory_engine = create_engine_with_foreign_keys_enabled("sqlite:///:memory:", use_static_pool=True)
    Base.metadata.create_all(in_memory_engine)
    try:
        yield sessionmaker(bind=in_memory_engine, autoflush=False, autocommit=False)
    finally:
        in_memory_engine.dispose()
