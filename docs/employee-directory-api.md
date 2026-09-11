# Employee Directory API

## Purpose

Backs the employee-management side of the app: a paginated, filterable, sortable, searchable table of all 10,000 employees, plus the minimal CRUD confirmed with HR — create, edit, and deactivate (soft-delete). Also exposes the per-employee salary history that `SalaryHistory` (`database-schema.md`) was built to hold, since the update path is what actually writes to it.

## Endpoints

### `GET /api/v1/employees`

| Query param | Type | Default | Notes |
|---|---|---|---|
| `page` | int | 1 | clamped to `>= 1` |
| `page_size` | int | 25 | clamped to `1..100` |
| `department_id` | int | none | |
| `country_id` | int | none | |
| `employment_status` | string | `Active` | `Active` \| `Terminated` \| `On Leave` \| `All` — same convention as `kpi-dashboard-api.md` |
| `search` | string | none | case-insensitive substring match on `first_name`, `last_name`, `email`, `employee_code` |
| `sort_by` | string | `last_name` | one of an explicit allow-list (see Key Decisions) |
| `sort_dir` | string | `asc` | `asc` \| `desc` |

Response `EmployeeListResponse`: `{items: [EmployeeSummary], page, page_size, total_items, total_pages}`.

`EmployeeSummary`: `id`, `employee_code`, `first_name`, `last_name`, `email`, `department_name`, `country_name`, `job_title`, `job_level`, `salary_usd`, `hire_date`, `employment_status`.

### `GET /api/v1/employees/{id}`

Response `EmployeeDetailResponse`: everything in `EmployeeSummary` plus `department_id`, `country_id`, `salary_local`, `currency_code`, `manager_id`, `created_at`, `updated_at`. 404 if the id doesn't exist.

### `POST /api/v1/employees`

Request `EmployeeCreateRequest`: `first_name`, `last_name`, `email`, `department_id`, `country_id`, `job_title`, `job_level`, `salary_local`, `hire_date`, `employment_status` (default `Active`). No `employee_code`, no `salary_usd` — both are server-computed (see Key Decisions). Response: `EmployeeDetailResponse`, 201.

### `PUT /api/v1/employees/{id}`

Request `EmployeeUpdateRequest`: same editable fields as create (still no `employee_code`/`salary_usd`). If `salary_local` differs from the current value, a `SalaryHistory` row is written in the same transaction as the update. Response: `EmployeeDetailResponse`.

### `PATCH /api/v1/employees/{id}/deactivate`

No request body. Sets `employment_status = "Terminated"`. Response: `EmployeeDetailResponse`.

### `GET /api/v1/employees/{id}/salary-history`

Response `SalaryHistoryResponse`: `{data: [SalaryHistoryItem]}`, newest first. `SalaryHistoryItem`: `id`, `old_salary_local`, `new_salary_local`, `hike_percent`, `changed_at`. `hike_percent` is derived (`(new - old) / old × 100`, 2dp), never stored — per the decision already made in `database-schema.md`.

## Key Decisions

### `employee_code` and `salary_usd` are always server-computed, never client-supplied

`employee_code` is assigned as the next sequential value (`EMP{next_id:05d}`, based on the current max `id`) at create time — it's a system business key, not user input, and staying sequential keeps it consistent with the seeded rows. `salary_usd` is always `salary_local × Country.fx_rate_to_usd` for the employee's `country_id`, recomputed on every create/update — the client never sends it, so it can never drift from the precompute rule in `database-schema.md`.

**Documented limitation**: computing the next `employee_code` from the current max `id` isn't safe under concurrent writes. Acceptable here — single HR Manager persona, no concurrent-access requirement (per `requirements.md`'s scope) — but noted as a real limit of this approach.

### Salary history is written automatically by the update path, never by the client

`employee_service.update_employee()` compares the incoming `salary_local` to the employee's current value; if it changed, it inserts a `SalaryHistory` row (`old_salary_local` = value before the update, `new_salary_local` = the new value) in the same transaction as the `Employee` update. There's no endpoint that writes `SalaryHistory` directly — this is what makes "past salaries are recoverable" actually true rather than aspirational.

### Deactivate is the only status-changing shortcut; reactivation goes through the general update

`PATCH /deactivate` only ever sets `Terminated` — there's no hard `DELETE`. Moving an employee back to `Active` (or to `On Leave`) isn't a separate endpoint; it's just `PUT` with a different `employment_status`, since the general update path already accepts any valid value. Adding a mirror-image "reactivate" endpoint would duplicate logic the update endpoint already has.

### List endpoint returns denormalized `department_name`/`country_name`

`EmployeeSummary` carries the joined names directly, computed via one query (`Employee` joined to `Department`/`Country`) rather than the frontend making follow-up lookup calls per row just to render a table column.

### `sort_by` validated against an explicit allow-list, not passed through to a raw column lookup

`app/services/employee_service.py` maps `sort_by` through a fixed `dict[str, ColumnElement]` (e.g. `"department" -> Department.name`, `"salary_usd" -> Employee.salary_usd`). An unrecognized `sort_by` falls back to the default sort rather than erroring — consistent with the project's "unknown filter → empty/default result, not a 500" stance, and closes off constructing a query from an arbitrary client-supplied identifier.

### Pagination inputs are clamped, not validated with a 422

`page < 1` becomes `1`; `page_size` outside `1..100` is clamped into that range; a `page` past the last page returns an empty `items` list with correct `total_items`/`total_pages` rather than a 404. An out-of-range page is a "no results here" case, not a client error.

### `search` is a simple case-insensitive substring match, not full-text search

At 10,000 rows, a `LIKE`/`ILIKE`-style substring match across `first_name`, `last_name`, `email`, `employee_code` is fast enough and needs no extra infrastructure (FTS tables, external search index). Documented scaling limit, same spirit as the median-in-Python note.

## Deliberately Excluded

- **Hard delete** — every removal is a soft status change via `deactivate`; no `DELETE /employees/{id}`.
- **Bulk edit / CSV import-export** — CRUD stays single-record, per the API-design boundary already set in the build plan.
- **Approval workflow for salary changes** — an update takes effect immediately; no pending/approved state machine.
- **Editing historical `SalaryHistory` rows** — the history table is append-only; nothing can modify or delete a past entry.
- **Changing `manager_id` through this API** — the field exists on `Employee` for future extensibility (see `database-schema.md`) but nothing in the MVP UI edits it, so it's not part of the create/update request bodies.

## Subtasks

- [x] `app/schemas/employee.py` — `EmployeeSummary`, `EmployeeDetailResponse`, `EmployeeCreateRequest`, `EmployeeUpdateRequest`, `EmployeeListResponse`, `EmployeeListParams`
- [x] `app/schemas/salary_history.py` — `SalaryHistoryItem`, `SalaryHistoryResponse`
- [x] `app/services/employee_service.py` — `list_employees()`, `get_employee()`, `create_employee()`, `update_employee()` (+ salary-history write), `deactivate_employee()`, `get_salary_history()` + tests
- [x] `app/routers/employees.py` — all six endpoints + tests

## Test Cases

### `app/services/employee_service.py` (`tests/test_employee_service.py`)

| Test | Verifies |
|---|---|
| `test_list_employees_paginates_correctly` | `page`/`page_size` slice the expected rows; `total_items`/`total_pages` are correct |
| `test_list_employees_filters_by_department_country_and_status` | Filters narrow results as expected; default `employment_status` excludes Terminated/On Leave |
| `test_list_employees_search_matches_name_email_and_code` | `search` matches across all four documented fields, case-insensitively |
| `test_list_employees_sorts_by_allowed_fields` | Sorting by a couple of representative fields (e.g. `salary_usd`, `department`) produces the expected order in both directions |
| `test_list_employees_unknown_sort_by_falls_back_to_default` | An invalid `sort_by` doesn't raise; result is sorted by the default field |
| `test_list_employees_page_past_last_page_returns_empty_items` | Requesting a page beyond `total_pages` returns `items=[]`, not an error |
| `test_create_employee_computes_employee_code_and_salary_usd` | `employee_code` is the next sequential value; `salary_usd` equals `salary_local × fx_rate_to_usd` for the given country |
| `test_update_employee_writes_salary_history_when_salary_changes` | Changing `salary_local` creates a `SalaryHistory` row with the correct old/new values |
| `test_update_employee_does_not_write_salary_history_when_salary_unchanged` | Updating other fields without touching `salary_local` writes no history row |
| `test_deactivate_employee_sets_terminated_status` | `deactivate_employee()` sets `employment_status = "Terminated"` and leaves other fields untouched |
| `test_get_salary_history_returns_newest_first_with_hike_percent` | History rows are ordered by `changed_at` descending; `hike_percent` matches the hand-computed value |

### `GET/POST/PUT/PATCH /employees` (`tests/test_employees_api.py`)

| Test | Verifies |
|---|---|
| `test_list_employees_returns_expected_shape` | Response matches `EmployeeListResponse` |
| `test_get_employee_returns_404_for_unknown_id` | Fetching a non-existent employee returns 404 |
| `test_create_employee_returns_201_with_generated_fields` | `POST` ignores any client-supplied `employee_code`/`salary_usd` and returns server-computed values |
| `test_update_employee_returns_updated_fields` | `PUT` reflects the new values in the response |
| `test_deactivate_employee_returns_terminated_status` | `PATCH /deactivate` response shows `employment_status = "Terminated"` |
| `test_salary_history_endpoint_returns_rows_after_an_update` | An employee with zero history returns `{"data": []}`; after one `PUT` that changes salary, returns one row |
