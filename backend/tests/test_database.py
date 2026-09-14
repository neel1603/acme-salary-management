from __future__ import annotations

import pytest

from app.database import session_scope
from app.models.department import Department


def test_session_scope_commits_on_success(in_memory_session_factory):
    with session_scope(in_memory_session_factory) as session:
        session.add(Department(name="Engineering"))

    with session_scope(in_memory_session_factory) as verification_session:
        assert verification_session.query(Department).filter_by(name="Engineering").count() == 1


def test_session_scope_rolls_back_on_error(in_memory_session_factory):
    with pytest.raises(RuntimeError), session_scope(in_memory_session_factory) as session:
        session.add(Department(name="Sales"))
        raise RuntimeError("simulated failure mid-transaction")

    with session_scope(in_memory_session_factory) as verification_session:
        assert verification_session.query(Department).count() == 0
