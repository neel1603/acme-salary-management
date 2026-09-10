# Seed Data

## Purpose

Populates the four tables in `database-schema.md` with deterministic, realistic mock data: 8 countries, 8 departments, and 10,000 employees spread across them with weighted distributions and level-appropriate salaries. This is the dataset every later API/frontend feature is built and demoed against.

## Reference Data (`app/seed/reference_data.py`)

Hand-curated, not fetched from anywhere — kept deterministic and dependency-free.

### Countries (8)

`code`, `name`, `currency_code`, `fx_rate_to_usd` (USD per 1 local-currency unit, fixed mock snapshot), `headcount_weight` (relative sampling weight), `salary_scale` (adjusts the USD-equivalent salary band per country, since real pay levels vary by market even after currency conversion).

| Code | Currency | FX → USD | Headcount weight | Salary scale |
|---|---|---|---|---|
| US | USD | 1.00 | 30 | 1.00 |
| IN | INR | 0.012 | 25 | 0.35 |
| GB | GBP | 1.27 | 12 | 0.85 |
| DE | EUR | 1.09 | 10 | 0.80 |
| CA | CAD | 0.74 | 8 | 0.85 |
| AU | AUD | 0.66 | 6 | 0.90 |
| SG | SGD | 0.75 | 5 | 0.75 |
| BR | BRL | 0.20 | 4 | 0.40 |

### Departments (8)

`name`, `headcount_weight`, `salary_scale` (a per-department premium/discount applied on top of the level band — see Key Decisions).

| Department | Headcount weight | Salary scale |
|---|---|---|
| Engineering | 25 | 1.15 |
| Customer Support | 15 | 0.80 |
| Sales | 18 | 1.05 |
| Operations | 12 | 0.90 |
| Marketing | 10 | 0.95 |
| Product/Data | 10 | 1.15 |
| Finance | 6 | 1.05 |
| HR | 4 | 0.90 |

### Job levels (9) — not a table, just seed-time bands

`level`, `min_usd`/`mid_usd`/`max_usd` (base USD band before department/country scaling), `headcount_weight` (pyramid-shaped: more ICs than VPs).

| Level | Band (USD) | Headcount weight |
|---|---|---|
| IC1 | 55k–63k–72k | 20 |
| IC2 | 68k–80k–95k | 22 |
| IC3 | 85k–102k–120k | 18 |
| IC4 | 105k–125k–145k | 14 |
| Senior | 120k–140k–165k | 10 |
| Staff | 145k–170k–195k | 6 |
| Manager | 130k–155k–180k | 5 |
| Director | 170k–200k–230k | 3 |
| VP | 220k–260k–300k | 2 |

## Seeding Algorithm (`app/seed/seed_data.py`)

1. Insert the 8 countries and 8 departments as ORM rows, pairing each with its reference metadata (weight/scale) so both the DB id and the sampling metadata are available together.
2. For each of the 10,000 employees: weighted-sample a country, a department, and a job level (`random.Random.choices`, weighted by `headcount_weight`); draw a salary within the level's band (`random.Random.triangular`), scale it by `department.salary_scale × country.salary_scale` to get a target USD figure; convert to local currency (`salary_local = target_usd / fx_rate_to_usd`) and back (`salary_usd = salary_local × fx_rate_to_usd`) so the stored pair is always internally consistent with the precompute decision in `database-schema.md`; weighted-sample `employment_status` (93% Active / 5% Terminated / 2% On Leave); assign a sequential `employee_code` (`EMP00001`…) and a random `hire_date` in a fixed historical window.
3. Employee rows are produced by a generator, one dict at a time, and inserted in fixed-size batches (`itertools.batched` + `session.execute(insert(Employee), batch)`) — still far fewer round-trips than 10,000 individual `add()`+commit() calls, but without ever holding all 10,000 rows in memory at once.
4. A single fixed seed (`random.Random(42)` + `Faker.seed(42)` for names/emails) makes the whole run byte-for-byte reproducible. The seed is fixed in code, not CLI-configurable — the point of seeding it at all is reproducibility, so exposing it as a flag would just invite someone to accidentally break that.

## Key Decisions

### Department "salary band per level" via a scale factor, not a full (department × level) matrix

The brief calls for a salary band per `(department, job_level)` pair — hand-authoring all 8 × 9 = 72 bands would be pure busywork for mock data. Instead, `job_level` supplies the base USD band and each `Department` applies a single multiplicative `salary_scale` (Engineering/Product pay a premium, Customer Support less) on top of it. Captures the same real-world shape — technical roles skew higher regardless of level — without hand-authoring 72 numbers.

### `manager_id` left null for every seeded row

`Employee.manager_id` is schema-only for now (no UI consumes it — see `database-schema.md` Deliberately Excluded / `requirements.md` Non-Goals). Populating a consistent org hierarchy across 10,000 rows would need topological assignment logic in service of a field nothing reads yet — deferred until a feature actually needs it.

### Salary sampled in USD space, then converted to local — never the other way round

Drawing the raw sample directly in local currency would mean the *shape* of the distribution (and the department/level premiums) differs by currency magnitude for no reason. Sampling in USD, applying scale factors, then converting once to local currency keeps the department/level/country effects orthogonal and easy to reason about.

### `Decimal`, not `float`, once a sampled value becomes a stored amount

`random.triangular` returns a `float` — unavoidable, it's a randomized draw. That float is immediately converted via `Decimal(str(value))` (not `Decimal(value)`, which would import the float's binary imprecision) and `.quantize(Decimal("0.01"))`, before any further arithmetic. Consistent with the `Decimal`-for-money rule already established in `database-schema.md`.

### Deterministic seeding, not "realistic" randomness

A fixed `random.Random(42)` instance (passed explicitly, not the global `random` module) plus `Faker.seed(42)` means the same seed always produces the same 10,000 rows — required for the determinism test below, and for the dataset to be identical across every dev machine and every CI run.

### Employee rows generated lazily, inserted in batches — not one 10,000-item list

Row-building is a generator (`yield`s one dict at a time), not a function returning a list — nothing holds all 10,000 rows in memory simultaneously. `itertools.batched` groups that stream into fixed-size chunks (1,000 rows) for `session.execute(insert(Employee), batch)`, so peak memory is bounded by the batch size rather than the employee count, while still keeping the round-trip count far below one-`add()`-per-row.

### `Base.metadata.drop_all` + `create_all` for `--reset`, not row-by-row deletes

The CLI's `--reset` flag drops and recreates every table rather than deleting rows in FK-safe order. This is a local dev/demo seeding tool, not a production migration path, so the simpler option is the right one.

### Session lifecycle via a `session_scope()` context manager

Added to `app/database.py`: `@contextmanager def session_scope(): ...` opens a session, commits on success, rolls back and re-raises on any exception, always closes. The seed CLI (and, later, any FastAPI request-scoped dependency) gets correct commit/rollback/close behavior from a single `with session_scope() as session:` instead of repeating try/commit/except/rollback/finally/close at every call site.

## Deliberately Excluded

- **Faker's built-in uniqueness proxy** (`fake.unique.email()`) — at 10,000 rows it can raise once the pool of plausible combinations thins out. Emails are built explicitly as `first.last.<sequence_number>@acmecorp.example`, which is unique by construction and needs no retry logic. (`.example` is the IANA-reserved TLD for documentation/testing — never a resolvable real domain.)
- **A `--seed`-driven partial re-seed / upsert mode** — the CLI always seeds into an empty (or freshly reset) schema. Merging into existing data isn't a real use case for a demo dataset.

## Subtasks

- [x] `app/database.py` — add `session_scope()` context manager + test
- [x] `app/seed/reference_data.py` — country/department/job-level reference data as dataclasses + sanity tests
- [x] `app/seed/seed_data.py` — weighted deterministic seeding logic, bulk insert, `--count`/`--reset` CLI + tests
- [x] `requirements.txt` — add `Faker`

## Test Cases

### `app/database.py` (`tests/test_database.py`)

| Test | Verifies |
|---|---|
| `test_session_scope_commits_on_success` | A row added inside `with session_scope()` is committed and visible after the block exits |
| `test_session_scope_rolls_back_on_error` | An exception inside the block propagates and no partial row is committed |

### Reference data (`tests/test_reference_data.py`)

| Test | Verifies |
|---|---|
| `test_countries_have_unique_codes` | No two `CountryReference` entries share a `code` |
| `test_departments_have_unique_names` | No two `DepartmentReference` entries share a `name` |
| `test_job_level_bands_are_ordered` | Every band satisfies `min_usd <= mid_usd <= max_usd` |

### Seeding (`tests/test_seed_data.py`)

| Test | Verifies |
|---|---|
| `test_seed_creates_expected_row_counts` | Seeding with `employee_count=N` yields 8 countries, 8 departments, and exactly `N` employees |
| `test_seed_is_deterministic_with_same_seed` | Two independent runs with the same seed produce identical `(employee_code, salary_usd)` pairs |
| `test_seed_employee_codes_are_sequential_and_unique` | `employee_code` values are `EMP00001..EMP{N}` with no duplicates |
| `test_seed_salary_usd_matches_local_times_fx_rate` | For every employee, `salary_usd == round(salary_local * fx_rate_to_usd, 2)` |
| `test_seed_employment_status_is_mostly_active` | Across a large sample, the `Active` share falls in a loose expected range (not an exact/brittle count) |
