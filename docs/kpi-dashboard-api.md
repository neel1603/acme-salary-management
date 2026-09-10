# KPI Dashboard API

## Purpose

Backs the HR Manager's analytics dashboard: headline KPIs (headcount, payroll, average/median salary) and the same figures broken down by department and by country, all filterable. This is the "answering questions" surface confirmed by HR as the priority over a natural-language query interface.

## Endpoints

### `GET /api/v1/kpis/summary`

Aggregate KPIs across all employees matching the filters.

| Query param | Type | Default | Notes |
|---|---|---|---|
| `department_id` | int | none | |
| `country_id` | int | none | |
| `employment_status` | string | `Active` | `Active` \| `Terminated` \| `On Leave` \| `All` (see Key Decisions) |
| `hire_date_from` | date | none | inclusive |
| `hire_date_to` | date | none | inclusive |

Response `KpiSummaryResponse`:

| Field | Type | Notes |
|---|---|---|
| `headcount` | int | |
| `total_payroll_usd` | Decimal | |
| `average_salary_usd` | Decimal | rounded to 2dp |
| `median_salary_usd` | Decimal | rounded to 2dp |

### `GET /api/v1/breakdown/department`

Same filters as above, minus `department_id` (the dimension being broken down). Response `DepartmentBreakdownResponse`: `{"data": [DepartmentBreakdownItem, ...]}`, one item per department that has at least one matching employee, sorted by `department_name`.

`DepartmentBreakdownItem`: `department_id`, `department_name`, `headcount`, `total_payroll_usd`, `average_salary_usd`, `median_salary_usd`.

### `GET /api/v1/breakdown/country`

Same filters, minus `country_id`. Response `CountryBreakdownResponse`: `{"data": [CountryBreakdownItem, ...]}`, sorted by `country_name`.

`CountryBreakdownItem`: `country_id`, `country_name`, `currency_code`, `headcount`, `total_payroll_usd`, `average_salary_usd`, `median_salary_usd`. `currency_code` lets the frontend caption the group even though every money figure is already in USD.

## Key Decisions

### Shared filter object across all three endpoints

`app/schemas/common.py` defines `EmployeeFilterParams`, a single Pydantic model that carries all five filters plus the `employment_status`/`All` normalization logic (`status_filter`). Each router still declares its own thin `Depends()` function, since `/kpis/summary` exposes all five query params while each breakdown endpoint omits the one matching its own grouping dimension — but all three build the same `EmployeeFilterParams`, so `app/services/kpi_service.py` has a single filter shape to consume, and the normalization logic lives in exactly one place rather than three.

### `employment_status` defaults to `Active`, with an explicit `All` escape hatch

The dashboard's natural default view is "the org as it stands today," so an unset `employment_status` filters to `Active`. Passing `employment_status=All` explicitly disables the filter (so HR can, e.g., see total historical headcount including terminations) — an unset param and an explicit "give me everything" are different intents, so both need to be expressible.

### Service layer returns plain data, not Pydantic response models

`app/services/kpi_service.py` functions (`get_kpi_summary`, `get_department_breakdown`, `get_country_breakdown`) return plain dataclasses, not the `*Response` schemas. Keeps the service layer testable and reusable without importing FastAPI/Pydantic response shapes into it — routers do the `service_result -> response_schema` mapping.

### One query per breakdown endpoint, grouped in Python

Because median has no SQL equivalent in SQLite (per `database-schema.md`), computing per-group headcount/total/average via SQL `GROUP BY` and per-group median via a second Python pass would mean two round trips per breakdown. Instead, a single query fetches `(group_id, group_name, salary_usd)` for every matching employee (joined to `Department`/`Country`), and a shared `_aggregate(salary_values) -> AggregateStats` helper (used by both the summary and each breakdown group) computes headcount/total/average/median from an in-memory list. At 10,000 rows total this is cheap; the same scaling caveat already documented for median applies here too.

### Groups with zero matching employees are omitted, not returned as zero rows

`GET /breakdown/department` and `/breakdown/country` only return departments/countries that have at least one employee matching the filters — not all 8 with zeros interspersed. The full set of departments/countries for building filter dropdowns is already available via the lookup endpoints (`GET /countries`, `GET /departments`); the breakdown endpoints answer "how is payroll distributed," where an entry with nothing in it isn't a distribution fact worth a row.

### Empty result set is `headcount=0` with zeroed money fields, never an error

An unmatched filter combination (e.g. a `department_id` that has no employees, or a valid but currently-empty combination) returns `{"headcount": 0, "total_payroll_usd": 0, "average_salary_usd": 0, "median_salary_usd": 0}` rather than a 404 or 500. Consistent with the lookup endpoints already returning `[]` rather than erroring on no matches.

## Deliberately Excluded

- **Time-series / trend charts** (e.g. headcount or payroll over time) — `Employee` holds current state only (see `database-schema.md`); there's no historical snapshot to chart against beyond `SalaryHistory`, which tracks individual salary changes, not org-wide state over time.
- **Cross-tab breakdown** (department × country in one response) — the brief calls for breakdowns by department and by country; a combined matrix wasn't asked for and would need its own response shape.
- **Server-side caching of aggregates** — at 10,000 rows, computing on every request is fast enough that a cache would add complexity without a measured need.

## Subtasks

- [x] `app/schemas/common.py` — shared `EmployeeFilterParams` query-param dependency
- [x] `app/services/kpi_service.py` — `_aggregate()` helper, `get_kpi_summary()`, `get_department_breakdown()`, `get_country_breakdown()` + tests
- [x] `app/schemas/kpi.py` — `KpiSummaryResponse`
- [x] `app/schemas/breakdown.py` — `DepartmentBreakdownItem`/`DepartmentBreakdownResponse`, `CountryBreakdownItem`/`CountryBreakdownResponse`
- [x] `app/routers/kpis.py` — `GET /kpis/summary` + tests
- [x] `app/routers/breakdowns.py` — `GET /breakdown/department`, `GET /breakdown/country` + tests

## Test Cases

### `app/services/kpi_service.py` (`tests/test_kpi_service.py`)

| Test | Verifies |
|---|---|
| `test_summary_matches_hand_computed_values` | Headcount/total/average/median for a small hand-crafted set match manually computed expected values |
| `test_summary_median_with_even_count` | Median of an even-sized group equals the average of the two middle values |
| `test_summary_median_with_odd_count` | Median of an odd-sized group equals the single middle value |
| `test_summary_sums_across_mixed_currencies_correctly` | Total/average are computed on `salary_usd`, not `salary_local`, for employees in different countries |
| `test_summary_returns_zeroed_result_when_no_employees_match` | An unmatched filter combination returns `headcount=0` and zeroed money fields, no exception |
| `test_summary_employment_status_all_bypasses_default_filter` | `employment_status="All"` includes Terminated/On Leave rows that the default `Active` filter would exclude |

### `app/services/kpi_service.py` breakdowns (`tests/test_breakdown_service.py`)

| Test | Verifies |
|---|---|
| `test_department_breakdown_matches_hand_computed_values` | Per-department headcount/total/average/median match manually computed expected values |
| `test_country_breakdown_includes_currency_code` | Each country group's `currency_code` matches its `Country` row |
| `test_breakdown_omits_groups_with_no_matching_employees` | A department/country with zero matching employees does not appear in the result |
| `test_breakdown_sorted_by_group_name` | Result groups are ordered alphabetically by name |

### `GET /kpis/summary` (`tests/test_kpis_api.py`)

| Test | Verifies |
|---|---|
| `test_kpi_summary_returns_expected_shape` | Response matches `KpiSummaryResponse` fields |
| `test_kpi_summary_filters_by_department_and_country` | Filters narrow the result to the expected subset |
| `test_kpi_summary_defaults_to_active_employees` | Omitting `employment_status` excludes Terminated/On Leave |
| `test_kpi_summary_invalid_lookup_id_returns_empty_result` | A non-existent `department_id`/`country_id` returns `headcount=0`, not an error |

### `GET /breakdown/department`, `GET /breakdown/country` (`tests/test_breakdowns_api.py`)

| Test | Verifies |
|---|---|
| `test_department_breakdown_returns_expected_shape` | Response matches `DepartmentBreakdownResponse` |
| `test_country_breakdown_returns_expected_shape` | Response matches `CountryBreakdownResponse`, including `currency_code` |
| `test_breakdown_respects_shared_filters` | `employment_status`/`hire_date_from`/`hire_date_to` narrow both breakdown endpoints |
