from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable

from google import genai
from google.genai import types
from sqlalchemy.orm import Session

from app.models.country import Country
from app.models.department import Department
from app.schemas.breakdown import CountryBreakdownItem, DepartmentBreakdownItem
from app.schemas.common import EmployeeFilterParams
from app.schemas.employee import EmployeeListParams, EmployeeSummary
from app.schemas.kpi import KpiSummaryResponse
from app.services import employee_service, kpi_service

# Pinned against Google's free-tier flash-class lineup as of implementation time; re-check
# against Google AI Studio's current free-tier models if this ever needs to change.
GEMINI_MODEL = "gemini-3.6-flash"

MAX_TOOL_ITERATIONS = 5
MAX_SEARCH_PAGE_SIZE = 20
FALLBACK_ANSWER = "I couldn't find a confident answer to that within the data I have access to."

_STATUS_ENUM = ["Active", "Terminated", "On Leave", "All"]

_KPI_SUMMARY_PROPERTIES: dict[str, Any] = {
    "department_id": {
        "type": "integer",
        "description": "Filter to one department, by id from the department lookup above. Omit for all departments.",
    },
    "country_id": {
        "type": "integer",
        "description": "Filter to one country, by id from the country lookup above. Omit for all countries.",
    },
    "employment_status": {
        "type": "string",
        "enum": _STATUS_ENUM,
        "description": "Defaults to Active. Use All to also include Terminated and On Leave employees.",
    },
    "hire_date_from": {
        "type": "string",
        "format": "date",
        "description": "ISO date (YYYY-MM-DD), inclusive lower bound on hire date.",
    },
    "hire_date_to": {
        "type": "string",
        "format": "date",
        "description": "ISO date (YYYY-MM-DD), inclusive upper bound on hire date.",
    },
}

TOOL_DECLARATIONS = [
    types.FunctionDeclaration(
        name="get_kpi_summary",
        description=(
            "Headcount, total payroll, average and median salary (all in USD) across employees "
            "matching the given filters."
        ),
        parameters_json_schema={
            "type": "object",
            "properties": _KPI_SUMMARY_PROPERTIES,
            "additionalProperties": False,
        },
    ),
    types.FunctionDeclaration(
        name="get_department_breakdown",
        description="Same KPIs as get_kpi_summary, broken down one row per department.",
        parameters_json_schema={
            "type": "object",
            "properties": {k: v for k, v in _KPI_SUMMARY_PROPERTIES.items() if k != "department_id"},
            "additionalProperties": False,
        },
    ),
    types.FunctionDeclaration(
        name="get_country_breakdown",
        description="Same KPIs as get_kpi_summary, broken down one row per country.",
        parameters_json_schema={
            "type": "object",
            "properties": {k: v for k, v in _KPI_SUMMARY_PROPERTIES.items() if k != "country_id"},
            "additionalProperties": False,
        },
    ),
    types.FunctionDeclaration(
        name="search_employees",
        description="Look up individual employees by name/email/code and/or department/country/status.",
        parameters_json_schema={
            "type": "object",
            "properties": {
                "search": {
                    "type": "string",
                    "description": "Case-insensitive substring match on first/last name, email, or employee code.",
                },
                "department_id": _KPI_SUMMARY_PROPERTIES["department_id"],
                "country_id": _KPI_SUMMARY_PROPERTIES["country_id"],
                "employment_status": _KPI_SUMMARY_PROPERTIES["employment_status"],
                "page_size": {
                    "type": "integer",
                    "description": f"Max results to return, capped at {MAX_SEARCH_PAGE_SIZE} regardless of what's requested.",
                },
            },
            "additionalProperties": False,
        },
    ),
]


@dataclass(frozen=True)
class ToolCallRecord:
    tool: str
    arguments: dict[str, Any]


@dataclass(frozen=True)
class NegotiationResult:
    answer: str
    grounding: list[ToolCallRecord]


def _extract(args: dict[str, Any], keys: tuple[str, ...]) -> dict[str, Any]:
    return {key: args[key] for key in keys if args.get(key) is not None}


def _kpi_summary_tool(db: Session, args: dict[str, Any]) -> dict[str, Any]:
    filters = EmployeeFilterParams(
        **_extract(args, ("department_id", "country_id", "employment_status", "hire_date_from", "hire_date_to"))
    )
    stats = kpi_service.get_kpi_summary(db, filters)
    return KpiSummaryResponse.model_validate(stats).model_dump(mode="json")


def _department_breakdown_tool(db: Session, args: dict[str, Any]) -> dict[str, Any]:
    filters = EmployeeFilterParams(**_extract(args, ("country_id", "employment_status", "hire_date_from", "hire_date_to")))
    rows = kpi_service.get_department_breakdown(db, filters)
    return {"data": [DepartmentBreakdownItem.model_validate(row).model_dump(mode="json") for row in rows]}


def _country_breakdown_tool(db: Session, args: dict[str, Any]) -> dict[str, Any]:
    filters = EmployeeFilterParams(
        **_extract(args, ("department_id", "employment_status", "hire_date_from", "hire_date_to"))
    )
    rows = kpi_service.get_country_breakdown(db, filters)
    return {"data": [CountryBreakdownItem.model_validate(row).model_dump(mode="json") for row in rows]}


def _search_employees_tool(db: Session, args: dict[str, Any]) -> dict[str, Any]:
    params = EmployeeListParams(
        **_extract(args, ("department_id", "country_id", "employment_status", "search")),
        page_size=min(int(args.get("page_size", MAX_SEARCH_PAGE_SIZE)), MAX_SEARCH_PAGE_SIZE),
    )
    result = employee_service.list_employees(db, params)
    return {
        "items": [EmployeeSummary.model_validate(row).model_dump(mode="json") for row in result.items],
        "total_items": result.total_items,
    }


_TOOL_DISPATCH: dict[str, Callable[[Session, dict[str, Any]], dict[str, Any]]] = {
    "get_kpi_summary": _kpi_summary_tool,
    "get_department_breakdown": _department_breakdown_tool,
    "get_country_breakdown": _country_breakdown_tool,
    "search_employees": _search_employees_tool,
}


def dispatch_tool_call(db: Session, name: str | None, arguments: dict[str, Any]) -> dict[str, Any]:
    """Runs one model-requested tool call against the fixed dispatch table.

    A name outside this table (or a type mismatch in `arguments` that fails Pydantic
    validation inside the tool function) raises rather than retrying the model with a
    corrective tool error — kept simple since well-behaved structured tool-calling rarely
    hits this, and the router maps any such failure to a generic 502.
    """
    if name not in _TOOL_DISPATCH:
        raise ValueError(f"Unknown tool: {name!r}")
    return _TOOL_DISPATCH[name](db, arguments)


def _build_system_prompt(db: Session) -> str:
    departments = db.query(Department).order_by(Department.name).all()
    countries = db.query(Country).order_by(Country.name).all()
    department_lines = "\n".join(f"- {d.name} (id={d.id})" for d in departments)
    country_lines = "\n".join(f"- {c.name} (id={c.id})" for c in countries)
    return (
        "You are a read-only HR data assistant for ACME Corp. Answer the HR manager's question "
        "using only the tools provided - never invent numbers. If the question needs data no tool "
        "can provide (e.g. performance reviews, headcount history, demographics), say plainly that "
        "you don't have that data rather than guessing.\n\n"
        f"Departments (name -> id):\n{department_lines}\n\n"
        f"Countries (name -> id):\n{country_lines}"
    )


def run_negotiation(client: genai.Client, db: Session, question: str) -> NegotiationResult:
    """Runs the full tool-call negotiation for one question, fully synchronously.

    Returns a complete answer plus the grounding trail; never partially streams anything
    itself — that's the router's job once this has already produced a final result.
    """
    history: list[types.Content] = [types.Content(role="user", parts=[types.Part.from_text(text=question)])]
    grounding: list[ToolCallRecord] = []
    config = types.GenerateContentConfig(
        system_instruction=_build_system_prompt(db),
        tools=[types.Tool(function_declarations=TOOL_DECLARATIONS)],
    )

    for _ in range(MAX_TOOL_ITERATIONS):
        response = client.models.generate_content(model=GEMINI_MODEL, contents=history, config=config)
        calls = response.function_calls
        if not calls:
            return NegotiationResult(answer=response.text or FALLBACK_ANSWER, grounding=grounding)

        history.append(response.candidates[0].content)
        response_parts = []
        for call in calls:
            arguments = call.args or {}
            result = dispatch_tool_call(db, call.name, arguments)
            grounding.append(ToolCallRecord(tool=call.name, arguments=arguments))
            response_parts.append(types.Part.from_function_response(name=call.name, response=result))
        history.append(types.Content(role="user", parts=response_parts))

    return NegotiationResult(answer=FALLBACK_ANSWER, grounding=grounding)
