# Database Schema

## Purpose

Defines the relational model backing every feature in this system: the analytics dashboard (KPIs, breakdowns), the employee directory, employee CRUD, and salary-change history. Four tables, described below, with the key design decisions that shape everything built on top of them.

## Tables

### `Country`

Lookup table for the countries ACME operates in. Carries currency/FX metadata so `Employee` doesn't have to.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | Integer | PK, autoincrement | |
| `code` | String(2) | unique, not null | ISO 3166-1 alpha-2, e.g. `US`, `IN`, `GB` |
| `name` | String | not null | e.g. "United States" |
| `currency_code` | String(3) | not null | ISO 4217, e.g. `USD`, `INR` |
| `fx_rate_to_usd` | Numeric(12, 6) | not null | Fixed mock snapshot — multiply a local-currency amount by this to get USD |
| `fx_rate_as_of` | Date | not null | Documents when the mock rate was "snapshotted" |

Seeded rows (8): US/USD, IN/INR, GB/GBP, DE/EUR, CA/CAD, AU/AUD, SG/SGD, BR/BRL.

### `Department`

Lookup table for departments.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | Integer | PK, autoincrement | |
| `name` | String | unique, not null | e.g. "Engineering" |

Seeded rows (8): Engineering, Sales, Marketing, Finance, HR, Operations, Customer Support, Product/Data.

### `Employee`

The core table — one row per employee, current state only.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | Integer | PK, autoincrement | |
| `employee_code` | String | unique, not null, indexed | Business key, e.g. `EMP00001` — sequential for spot-checking |
| `first_name` | String | not null | |
| `last_name` | String | not null | |
| `email` | String | unique, not null | |
| `department_id` | Integer | FK → `Department.id`, not null, indexed | |
| `country_id` | Integer | FK → `Country.id`, not null, indexed | |
| `job_title` | String | not null | e.g. "Software Engineer II" |
| `job_level` | String | not null | IC1–IC4, Senior, Staff, Manager, Director, VP — drives salary banding at seed time |
| `salary_local` | Numeric(14, 2) | not null | Source of truth — what's on the payslip, in the employee's local currency |
| `salary_usd` | Numeric(14, 2) | not null | **Denormalized/precomputed** — see decision below |
| `hire_date` | Date | not null, indexed | |
| `employment_status` | String | not null, indexed | `Active` \| `Terminated` \| `On Leave` |
| `manager_id` | Integer | FK → `Employee.id`, nullable | Self-referential; schema-only for now, no UI (see Non-Goals in `requirements.md`) |
| `created_at` | DateTime | not null, default now | |
| `updated_at` | DateTime | not null, default now, on update now | |

**Composite indexes**: `(employment_status, department_id)` and `(employment_status, country_id)` — nearly every dashboard query filters by `Active` status *and* groups by one of these two dimensions, so the composite covers the common access pattern directly.

### `SalaryHistory`

One row per salary change, so past salaries and hike % are recoverable even though `Employee` itself only holds current state.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | Integer | PK, autoincrement | |
| `employee_id` | Integer | FK → `Employee.id`, not null, indexed | |
| `old_salary_local` | Numeric(14, 2) | not null | Value before the change |
| `new_salary_local` | Numeric(14, 2) | not null | Value after the change |
| `changed_at` | DateTime | not null, default now | |

Kept deliberately lightweight: no `reason`/`approved_by`/currency-change handling — just enough to answer "what did this employee used to earn, and what was the hike %?" Hike % is **derived, not stored**: `(new_salary_local - old_salary_local) / old_salary_local × 100`, computed when a history entry is read, so there's no risk of a stored percentage drifting out of sync with the raw values.

**Write path**: a row is inserted automatically, as part of the same transaction, whenever the employee-update service changes `salary_local` — never written directly by the client. Newly seeded employees start with zero history rows; history only accumulates from real edits made after seeding, which is also how the feature gets demonstrated (edit an employee's salary through the app, then view their history).

## Key Decisions

### Multi-currency: precompute `salary_usd`, don't join-and-multiply at query time

`salary_usd` is computed once, at write time (seed, create, or update), as `salary_local × Country.fx_rate_to_usd`, and stored directly on the `Employee` row.

**Why**: every dashboard aggregate (`SUM`, `AVG`, `GROUP BY`) then operates on a single plain numeric column with zero joins — the query stays simple and fast regardless of how many countries/currencies are involved. It also mirrors how real payroll systems work: a report reflects the FX rate at the time it was generated, not whatever rate happens to be current when someone re-runs the report later.

**Trade-off accepted**: if a `Country.fx_rate_to_usd` changes, existing employees' `salary_usd` values do *not* retroactively update unless explicitly recomputed. This is intentional (rate changes shouldn't silently rewrite historical-looking numbers) but is worth stating explicitly rather than leaving implicit.

**Explicit scope cut**: FX rates are a fixed, hand-curated mock table, not a live feed. This keeps seeding, tests, and the demo fully deterministic and removes an external network dependency from the build. The schema already supports swapping in a real FX provider later; only the population mechanism would change.

### Median computed in Python, not SQL

SQLite has no built-in median/percentile aggregate function. Given the scale here (10,000 rows total, far fewer per filtered group), the KPI/breakdown services fetch the relevant `salary_usd` values and compute the median with Python's `statistics.median()`. Simple, correct, and fast at this data size.

**Scaling limit** (documented, not solved here): at much larger scale, pulling all matching rows into Python stops being cheap. A production system at that scale would move to a database with native percentile support (e.g., Postgres `percentile_cont`) or maintain materialized rollups. Noted in `performance-considerations.md`.

### Lookup tables instead of free-text columns

`department_id`/`country_id` as foreign keys (instead of `department: str`/`country: str` directly on `Employee`) costs two small joins but guarantees consistent values (no typos/casing drift across 10,000 rows) and gives `Country` a natural place to carry currency/FX metadata that a bare string couldn't hold.

### Salary history as an append-only side table, not row versioning

Rather than versioning the entire `Employee` row (which would mean every field, not just salary, needs a "valid from/to" concept), only salary changes are tracked, in a dedicated table, written automatically by the update path. This answers the actual question asked ("past salaries / hike %") without building general-purpose temporal tables for fields nobody asked to track historically.

## Deliberately Excluded

- **Full historical/point-in-time tracking of every field** — only salary changes are versioned (via `SalaryHistory`); job title/department/country changes overwrite in place with no history.
- **Demographic fields** (gender, age, etc.) — no pay-equity analysis was requested, and collecting demographic data deserves its own privacy review, which is out of scope here.
- **Org-chart traversal helpers** (e.g., materialized path, depth) — `manager_id` exists for future extensibility but nothing in the MVP queries the hierarchy.

## Subtasks

Built and tested one table at a time (`Country` → `Department` → `Employee` → `SalaryHistory`) — each table's model and its own tests are finished before moving to the next.

- [x] Backend project scaffold: `backend/` folder, Python 3.12 venv, `requirements.txt`, `app/` package layout
- [x] `app/database.py` — SQLAlchemy engine, session factory, declarative `Base`, FK enforcement
- [x] `tests/conftest.py` — shared in-memory SQLite session fixture (all tables created, FK enforcement on)
- [x] `app/models/country.py` — `Country` model + tests (table creation, `code` uniqueness)
- [ ] `app/models/department.py` — `Department` model + tests (table creation, `name` uniqueness)
- [ ] `app/models/employee.py` — `Employee` model with FKs, indexes, composite indexes + tests (table creation, FK validation, `employee_code`/`email` uniqueness, default timestamps)
- [ ] `app/models/salary_history.py` — `SalaryHistory` model + tests (table creation, FK validation)

## Test Cases

### `Country` (`tests/test_country_model.py`)

| Test | Verifies |
|---|---|
| `test_country_table_creates_successfully` | `Country` table is created with the expected columns |
| `test_country_code_is_unique` | Two countries can't share a `code` |

### `Department` (`tests/test_department_model.py`)

| Test | Verifies |
|---|---|
| `test_department_table_creates_successfully` | `Department` table is created with the expected columns |
| `test_department_name_is_unique` | Two departments can't share a `name` |

### `Employee` (`tests/test_employee_model.py`)

| Test | Verifies |
|---|---|
| `test_employee_table_creates_successfully` | `Employee` table is created with the expected columns |
| `test_employee_requires_valid_department_and_country` | Inserting an `Employee` with a non-existent `department_id`/`country_id` raises an integrity error |
| `test_employee_code_is_unique` | Two employees can't share an `employee_code` |
| `test_employee_email_is_unique` | Two employees can't share an `email` |
| `test_employee_defaults` | `created_at`/`updated_at` populate automatically on insert |

### `SalaryHistory` (`tests/test_salary_history_model.py`)

| Test | Verifies |
|---|---|
| `test_salary_history_table_creates_successfully` | `SalaryHistory` table is created with the expected columns |
| `test_salary_history_requires_valid_employee` | Inserting a `SalaryHistory` row with a non-existent `employee_id` raises an integrity error |
