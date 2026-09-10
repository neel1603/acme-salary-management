from __future__ import annotations

from app.seed.reference_data import COUNTRIES, DEPARTMENTS, JOB_LEVEL_BANDS


def test_countries_have_unique_codes():
    codes = [country.code for country in COUNTRIES]
    assert len(codes) == len(set(codes))


def test_departments_have_unique_names():
    names = [department.name for department in DEPARTMENTS]
    assert len(names) == len(set(names))


def test_job_level_bands_are_ordered():
    for band in JOB_LEVEL_BANDS:
        assert band.min_usd <= band.mid_usd <= band.max_usd
