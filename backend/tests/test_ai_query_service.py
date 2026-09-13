from __future__ import annotations

import datetime as dt
import itertools
from dataclasses import dataclass, field
from decimal import Decimal

import pytest
from google.genai import types

from app.models.country import Country
from app.models.department import Department
from app.models.employee import Employee
from app.services import ai_query_service

_employee_code_sequence = itertools.count(1)


def _build_country(code: str = "US", name: str = "United States", currency_code: str = "USD") -> Country:
    return Country(
        code=code,
        name=name,
        currency_code=currency_code,
        fx_rate_to_usd=Decimal("1.00"),
        fx_rate_as_of=dt.date(2026, 1, 1),
    )


def _build_department(name: str = "Engineering") -> Department:
    return Department(name=name)


def _build_employee(*, department_id: int, country_id: int, salary_usd: Decimal) -> Employee:
    sequence_number = next(_employee_code_sequence)
    return Employee(
        employee_code=f"EMP{sequence_number:05d}",
        first_name="Jane",
        last_name="Doe",
        email=f"employee.{sequence_number}@example.com",
        department_id=department_id,
        country_id=country_id,
        job_title="Software Engineer",
        job_level="IC2",
        salary_local=salary_usd,
        salary_usd=salary_usd,
        hire_date=dt.date(2024, 1, 15),
        employment_status="Active",
    )


def _text_response(text: str) -> types.GenerateContentResponse:
    return types.GenerateContentResponse(
        candidates=[types.Candidate(content=types.Content(role="model", parts=[types.Part.from_text(text=text)]))]
    )


def _tool_call_response(name: str, args: dict) -> types.GenerateContentResponse:
    return types.GenerateContentResponse(
        candidates=[
            types.Candidate(content=types.Content(role="model", parts=[types.Part.from_function_call(name=name, args=args)]))
        ]
    )


@dataclass
class _RecordedCall:
    model: str
    contents: list
    config: types.GenerateContentConfig


@dataclass
class _FakeModels:
    responses: list
    calls: list = field(default_factory=list)

    def generate_content(self, *, model, contents, config):
        self.calls.append(_RecordedCall(model=model, contents=list(contents), config=config))
        return self.responses.pop(0)


class _FakeClient:
    def __init__(self, responses):
        self.models = _FakeModels(list(responses))


def test_dispatch_kpi_summary_tool_calls_service_with_parsed_filters(db_session):
    department = _build_department()
    country = _build_country()
    db_session.add_all([department, country])
    db_session.commit()
    for salary in (Decimal("50000.00"), Decimal("70000.00")):
        db_session.add(_build_employee(department_id=department.id, country_id=country.id, salary_usd=salary))
    db_session.commit()

    result = ai_query_service.dispatch_tool_call(db_session, "get_kpi_summary", {"department_id": department.id})

    assert result["headcount"] == 2
    assert result["total_payroll_usd"] == "120000.00"
    assert result["average_salary_usd"] == "60000.00"


def test_dispatch_search_employees_tool_caps_page_size(db_session):
    department = _build_department()
    country = _build_country()
    db_session.add_all([department, country])
    db_session.commit()
    for _ in range(25):
        db_session.add(_build_employee(department_id=department.id, country_id=country.id, salary_usd=Decimal("50000.00")))
    db_session.commit()

    result = ai_query_service.dispatch_tool_call(db_session, "search_employees", {"page_size": 100})

    assert len(result["items"]) == ai_query_service.MAX_SEARCH_PAGE_SIZE
    assert result["total_items"] == 25


def test_dispatch_unknown_tool_name_raises(db_session):
    with pytest.raises(ValueError):
        ai_query_service.dispatch_tool_call(db_session, "delete_everything", {})


def test_negotiation_stops_at_max_iterations_with_fallback_answer(db_session):
    client = _FakeClient(
        [_tool_call_response("get_kpi_summary", {}) for _ in range(ai_query_service.MAX_TOOL_ITERATIONS)]
    )

    result = ai_query_service.run_negotiation(client, db_session, "how many people work here?")

    assert result.answer == ai_query_service.FALLBACK_ANSWER
    assert len(result.grounding) == ai_query_service.MAX_TOOL_ITERATIONS
    assert all(record.tool == "get_kpi_summary" for record in result.grounding)


def test_negotiation_returns_final_answer_and_grounding_in_call_order(db_session):
    client = _FakeClient(
        [
            _tool_call_response("get_kpi_summary", {"department_id": 1}),
            _text_response("There are 3 people in Engineering."),
        ]
    )

    result = ai_query_service.run_negotiation(client, db_session, "how many people are in engineering?")

    assert result.answer == "There are 3 people in Engineering."
    assert result.grounding == [ai_query_service.ToolCallRecord(tool="get_kpi_summary", arguments={"department_id": 1})]


def test_system_prompt_embeds_all_departments_and_countries(db_session):
    engineering = _build_department(name="Engineering")
    sales = _build_department(name="Sales")
    us = _build_country(code="US", name="United States")
    db_session.add_all([engineering, sales, us])
    db_session.commit()

    client = _FakeClient([_text_response("no data needed for this answer")])

    ai_query_service.run_negotiation(client, db_session, "hello")

    system_instruction = client.models.calls[0].config.system_instruction
    assert f"Engineering (id={engineering.id})" in system_instruction
    assert f"Sales (id={sales.id})" in system_instruction
    assert "United States" in system_instruction
