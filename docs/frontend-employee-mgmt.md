# Frontend Employee Management

## Purpose

Builds the `/employees` page that `docs/frontend-dashboard.md` deferred: a paginated, filterable, sortable employee directory plus the CRUD actions the brief's "manage salaries data" language requires (create, edit, deactivate) and a read-only view of an employee's salary-change history. This is the second and last consumer of the API layer `docs/frontend-foundation.md` built — after this, every backend endpoint has a real UI in front of it.

Every decision here is made from the same seat as the dashboard: a single HR Manager, no other persona, working a 10,000-row directory where "quick enough" was empirically confirmed (see `Performance` below) rather than assumed.

## Stack

New shadcn components (Base UI, per the existing `components.json`): `table`, `dialog`, `alert-dialog`, `input`, `label`, `badge`. No new npm dependencies — `lucide-react` (row-action icons) is already installed as a shadcn peer, and the debounced search input is a ~10-line hand-rolled hook rather than a library.

## Performance (why "10k rows" doesn't need special handling)

Before designing pagination/search, I measured the actual query cost against a throwaway 10,000-row SQLite database (not the dev DB), calling the service layer directly:

| Query | Best | Avg |
|---|---|---|
| Employee list, page 1, default sort | 5.2ms | 5.9ms |
| Employee list, sort by salary_usd or joined department/country name | 5.1–5.3ms | 5.3–5.5ms |
| Employee list, filtered by department+status | 2.0ms | 2.4ms |
| Employee list, free-text search (`ilike`, unindexed) | 19.8ms | 20.4ms |
| Employee list, deep page (page 300) | 21.0ms | 21.8ms |
| KPI/breakdown aggregates over all 10k rows | 16.6–21.2ms | 21.6–25.6ms |

Worst case is ~25ms server-side, imperceptible next to network/render time. This means the UI needs **no client-side workarounds** for scale — no virtualized table (a page is ≤100 rows, never all 10,000 at once), no client-side search/sort/filter (the server already does it fast, and doing it twice would be wasted complexity), no infinite scroll. The one real UX lever for "feels quick" is avoiding unnecessary requests, which is what the search debounce below is for — not because search is slow, but because firing a request per keystroke would visibly flicker the table and thrash the page-reset logic.

## Key Decisions

### A new `EmployeeFilterBar`, not the dashboard's `FilterBar`

`GET /employees`'s `EmployeeListParams` has no `hire_date_from`/`hire_date_to` (unlike the KPI/breakdown endpoints) and adds `search`, which the dashboard filters don't have. Reusing `FilterBar` verbatim would either send params this endpoint silently ignores — the exact bug class already fixed once in `breakdowns.js` — or leave `search` unavailable. `EmployeeFilterBar` is a new component with the same visual language (label + shadcn `Select`) for department/country/status, plus a debounced search `Input`.

### Debounced search — the first free-text filter in the app

`frontend-dashboard.md` explicitly deferred debouncing "until a future filter is a free-text field." This is that field. `src/lib/useDebouncedValue.js` is a ~10-line hook (`useState` + `useEffect` + `setTimeout`) rather than a new dependency — the need is narrow enough that a library would be more code, not less. The `Input` itself updates immediately (so typing feels responsive); only the *debounced* value feeds the query key, so keystrokes don't each trigger a network request or a table flicker. 300ms delay.

### Filter, search, or page-size changes reset to page 1; sort changes don't

The dashboard has no pagination, so this case didn't exist yet. Narrowing a filter while sitting on page 12 of the old result set would silently land on an out-of-range or misleading page. Changing `department_id`/`country_id`/`employment_status`/`search`/`page_size` resets `page` to 1; changing `sort_by`/`sort_dir` does not, since re-sorting while staying on the current page is the expected behavior. `page_size` is grouped with the filters, not with sort: moving from page 12 of 25-row pages to 100-row pages would land on rows 1101–1200, almost certainly past the end of the result set.

**The backend does not clamp the high end.** `EmployeeListParams.clamped_page` is `max(page, 1)` — a floor only. Requesting a `page` past the last one returns `items: []` with a normal 200, not an error and not a silently-corrected page number. Two consequences: the page-reset rule above is load-bearing (nothing downstream will save us if we get it wrong), and `EmployeesPage` still has to handle the case directly — if a request in flight was for a page that's now out of range (e.g. a slow response lands after someone already narrowed a filter), it renders "No employees on this page" with a **Go to first page** action, rather than an empty table with no explanation.

### Sorting and pagination are entirely server-driven

Clicking a column header updates `sort_by`/`sort_dir` in the same params object that already drives every other filter; the `useEmployees` hook (already generic — it takes a params object it doesn't need to know the shape of) refetches exactly like a filter change. No client-side re-sort of the fetched page. This matches the Performance numbers above: the server computing order over an index is materially cheaper and simpler than re-sorting a page of already-truncated rows in JS, and it means "sorted by salary_usd descending" is correct across the *whole* 10,000-row set, not just within whatever page happened to be loaded.

**Only columns in `employee_service.py`'s `_SORT_COLUMNS` are clickable**, and the UI must send the exact strings that dict uses as keys — anything else (including a plausible-looking but wrong key) silently falls back to sorting by `last_name` via `.get(sort_by, DEFAULT)`, with no error and no signal that the fallback happened. Confirmed against the current dict:

| Column | `sort_by` value |
|---|---|
| Name | `last_name` |
| Employee code | `employee_code` |
| Department | `department` (not `department_name`) |
| Country | `country` (not `country_name`) |
| Job title | `job_title` |
| Job level | `job_level` |
| Salary (USD) | `salary_usd` |
| Hire date | `hire_date` |
| Status | *(none — see below)* |

**`employment_status` is deliberately not sortable.** It isn't in `_SORT_COLUMNS` at all, so a clickable Status header would render a sort arrow that does nothing — worse than no affordance, since it looks broken rather than absent. The column stays a plain header with no click handler and no arrow.

**Deep pagination on a low-cardinality sort needs a backend fix first.** `list_employees`'s `order_by(order_clause)` has no secondary tiebreaker. Sorting by `job_level`/`department`/`country` — each with only a handful of distinct values across 10,000 rows — combined with `OFFSET`/`LIMIT` means SQLite is free to order tied rows differently between two otherwise-identical queries; a row can repeat on two pages or be skipped entirely. Fix: `order_by(order_clause, Employee.id.asc())`. One line, and it's what makes "page through everyone sorted by department" actually enumerate everyone exactly once.

### Hand-rolled Prev/Next pagination, plus a page-size selector

Shadcn's registry *does* include a `Pagination` component (checked directly against `ui.shadcn.com/docs/components` — an earlier draft of this doc claimed otherwise, which was wrong). It doesn't fit here for a more specific reason than "no primitive exists": `PaginationLink`/`PaginationPrevious`/`PaginationNext` render `<a href>` anchors by default, built for URL-driven pagination (a Next.js `<Link>` swap-in is the documented customization path). Our page number lives in React state, not the URL — there's no route to link to. Adopting the component would mean overriding every anchor into a button anyway, which is more code than the two buttons it replaces. Same "does this dependency earn itself" judgment as the dashboard's native `<input type="date">` decision, just resolved for a real reason instead of an invented one.

`EmployeePagination` is `< Prev` / `Page X of Y (N total)` / `Next >`, with Prev disabled on page 1 and Next disabled on the last page. A page-size `<Select>` (25 / 50 / 100, matching the backend's own clamp) is included — it's a single trivial control, and the Performance numbers show page size doesn't meaningfully change server cost, so there's no reason to hide it behind "advanced" anything. Changing it resets `page` to 1 (see above).

### Status shown as a colored `Badge`, not plain text

An HR manager scanning 25–100 rows for who's inactive benefits from a color they can pattern-match rather than reading text repeated in every row: `Active` (green-ish), `On Leave` (amber-ish), `Terminated` (gray). Purely visual — the underlying value is still the plain `employment_status` string.

### One shared `EmployeeFormDialog` for create and edit

`EmployeeCreateRequest` and `EmployeeUpdateRequest` are the same field set (create additionally defaults `employment_status`). `EmployeeFormDialog` takes a `mode` (`'create'` | `'edit'`) and, in edit mode, an `employeeId`: create means an empty form (`useCreateEmployee`), edit means pre-filled (`useUpdateEmployee`). One component, one set of field markup, instead of two dialogs that would drift out of sync.

**Edit mode cannot prefill from the list row.** `EmployeeSummary` — the shape `EmployeeTable`'s rows already have — omits `salary_local`, `currency_code`, `department_id`, and `country_id` entirely. `PUT /employees/{id}` (`EmployeeUpdateRequest`) is a **full replace** with no defaults: every field, including `employment_status`, must be sent. Prefilling from the row would put `salary_usd` into the `salary_local` field, silently overwrite the employee's real local pay, and write a bogus `SalaryHistory` row (history is logged purely on a `salary_local` inequality — `employee_service.py:243-250` — so it can't tell a genuine change from a unit-mismatch). Edit mode therefore fetches `GET /employees/{id}` (`useEmployee(id, {enabled: open})`) and prefills from that.

This also rules out the obvious-looking `useState(() => employee.salaryLocal)` initializer pattern: a `useState` initializer runs once, on mount, while the query is still loading and its data is `undefined` — the form would render empty and never re-sync once the fetch resolves. Instead the dialog gates rendering the form body on the query's `isSuccess`, so the fields (and their `useState` initializers) never mount until real data exists. Nothing resets a field via `useEffect`; the field simply isn't there until there's something correct to put in it.

Plain controlled `useState` per field — no `react-hook-form`: the form is a flat object with no cross-field or async validation beyond the one currency rule below, so native HTML validation (`required`, `type="email"`, `type="number" min="0"` on salary) covers the boundary cases that matter for a single HR user filling one form at a time. The backend stays the real source of truth (422 on a bad department/country id, 409 on a duplicate email — see below); the dialog surfaces the mutation's error in an inline banner rather than re-deriving its own validation rules. That banner has to handle `detail` being either a string (the 409/422 cases this doc's backend fix raises) or FastAPI's own array-of-objects shape (body-validation 422s) — a naive `{error.detail}` renders `[object Object]` on the latter, so a small `formatApiErrorDetail()` helper normalizes both to a string before display.

### Changing an employee's country re-denominates their salary

The backend computes `salary_usd = salary_local × Country.fx_rate_to_usd` at write time, using whatever country is on the request — not the employee's country before the edit. If the form lets someone switch the country `<Select>` without touching the salary number, the *same* number gets reinterpreted in a different currency: change India to the US on a ₹1,000,000 salary and the backend saves it as $1,000,000, a ~83x error with no validation to catch it (both are positive numbers, both are plausible salaries in isolation).

Fix: the salary input always shows its currency inline (`Salary (INR)`, driven by the selected country's `currencyCode`, not a fixed label), and **changing the country clears the salary field** with an inline hint — "Country changed — re-enter salary in USD." This forces a deliberate re-entry instead of a silent reinterpretation. In create mode this is a no-op if the field is already empty.

### Deactivate needs a confirmation step

`PATCH /employees/{id}/deactivate` is technically reversible (Edit can set status back), but it *reads* to an HR user as "letting someone go" — a consequential action that shouldn't fire on a misclick. Confirmed via shadcn `alert-dialog`, not a bare button. The action is hidden/disabled once an employee is already `Terminated`.

### "View" opens detail + salary history together, not two separate dialogs

Considered a separate "salary history" action, but an HR user checking someone's raise history almost always also wants their current role/department/pay in the same glance. `EmployeeDetailDialog` fetches `GET /employees/{id}` (for department/country/currency/job info the list row doesn't carry — `EmployeeSummary` omits `currency_code`, `department_id`, etc.) and `GET /employees/{id}/salary-history` together, gated by `enabled: open` so neither fires until the dialog is actually opened. History rows show `old → new` in the employee's *local* currency with `hike_percent`, not USD — HR reviewing a raise thinks in the currency they set it in, matching `EmployeeDetailResponse.currency_code`.

### `apiFetch` stays GET-only; a new `apiMutate` handles writes

`src/api/client.js`'s `apiFetch` only ever built a query string and called `fetch(url)` — there was no consumer of POST/PUT/PATCH until now. Rather than reshape `apiFetch`'s signature (and touch every existing call site in `kpis.js`/`breakdowns.js`/`lookups.js`/`employees.js` for a capability they don't need), the non-2xx-handling logic is pulled into a shared `handleResponse` helper, and a sibling `apiMutate(path, {method, body})` sends a JSON body with the same `ApiError` behavior. Smaller diff, and it keeps "builds a query string" and "sends a body" as two things a reader can look at separately instead of one function branching on which one you meant.

The query-string builder also gets a small fix while it's open: it currently drops `undefined`/`null` params but not `''` — clearing the search box sends a literal `search=` on the wire, which is a distinct cache key and network request for a result identical to "no search filter at all." Normalize `''` to `undefined` before building params.

### Backend fix: duplicate email/employee_code currently raise an unhandled 500 or get mislabeled

`employee_service.create_employee`/`update_employee` never catch the unique-constraint violations on `email` or `employee_code` (both `unique=True`). Today either one raises an unhandled `IntegrityError` — FastAPI turns that into a bare 500 with no usable `detail`. A duplicate email is the single most likely validation failure an HR user will actually hit (typo'd or reused email), so it needs a clean 409.

The naive fix — blanket `catch IntegrityError → 409 "Email already in use"` — would mislabel a different failure: `employee_code` is also `unique=True`, generated from `max(id)+1`, and while a collision there is unlikely it isn't impossible, and the message would lie about which field caused it. Instead:

- An explicit pre-check for a duplicate email (a `SELECT` before the insert/update, excluding the employee's own row on update so keeping your own email isn't rejected) raises a `ConflictError` (a small `ValueError` subclass, so the router's existing `except ValueError → 422` still catches it as a fallback if the new handler is ever bypassed) with a precise message.
- A narrow `except IntegrityError` backstop around the actual write still exists, for the `employee_code` case (and any other unique constraint added later) — but raises a *generic* conflict message rather than claiming it was the email.
- The router adds `except ConflictError → HTTPException(409, str(error))`, ordered above the existing `ValueError → 422` handler.

This keeps the existing "service raises domain errors, router translates to HTTP" layering intact rather than raising `HTTPException` directly from the service.

## Data Flow

`EmployeesPage` owns one `params` object (`page`, `page_size`, `department_id`, `country_id`, `employment_status`, `search`, `sort_by`, `sort_dir`) via `useState`, passed whole to `useEmployees` — same "one filter shape, `useState` at the page level" pattern as `DashboardPage`. `EmployeeFilterBar` and `EmployeeTable`'s sortable headers both call `onParamsChange` with a patch; `EmployeesPage` merges it and resets `page` to 1 when anything other than `sort_by`/`sort_dir` changed (that includes `page_size` — see above).

`EmployeesPage` also owns dialog state directly, as a single `{mode, employeeId}` pair (`mode` one of `null`/`'create'`/`'edit'`/`'view'`/`'deactivate'`) — **not** `EmployeeTable`, which only renders row-action buttons that call callbacks up to the page. At most one dialog is mounted at a time, keyed by `key={employeeId ?? 'new'}`. This is deliberate, not incidental: without a shared key, closing an edit dialog for employee A and opening one for employee B would reuse the same component instance, and a `useState`-per-field form (or a mutation's `error` state) would still be holding A's values or A's stale error banner when B's dialog appears. The keyed remount discards both for free — no `useEffect` reset, no explicit `.reset()` call needed on the mutation.

Every mutation invalidates the `['employees']` key-prefix (not just `['employees', 'list']` — TanStack Query's default prefix matching would miss `['employees', 'detail', id]` and the salary-history key otherwise) **and** `['kpis']`/`['breakdowns']`, via one shared `invalidateEmployeeData(queryClient)` helper. The KPI/breakdown invalidation matters because editing, creating, or deactivating an employee changes headcount and average-salary aggregates — with `queryClient`'s `staleTime: 60_000`, the dashboard would otherwise show stale numbers for up to a minute after a change made on this page. No optimistic updates, no manual cache patching; the dialog just closes and the affected views catch up, matching the dashboard's existing "no retry button, no shimmer" preference for simplicity over perceived-speed polish.

## Known limitation: salary-history currency labeling

`get_salary_history`'s `_to_detail_row` labels every history row with the employee's **current** country's `currency_code` — but `SalaryHistory` itself stores only a bare local-currency amount, no currency of its own. If an employee's country is ever changed (a legitimate Edit), every history row recorded before that change is retroactively mislabeled: an amount that was genuinely in INR at the time now displays with whatever currency code the employee's country happens to be today. The correct fix is a `currency_code` column on `SalaryHistory`, captured at write time — that's a schema change (migration, backfill decision for existing rows) and is out of scope for this UI pass. Documenting it here rather than letting the UI imply a guarantee ("history shown in the employee's currency") that the data doesn't actually back up in this edge case.

## Deliberately Excluded

- **Bulk import/export, bulk edit** — out of scope per the original build plan's CRUD boundary (single-record only).
- **Reactivate button** — deactivate is one-directional in the UI; un-terminating someone is an Edit (change status back), not a dedicated action, matching the brief's soft-delete-only scope.
- **Virtualized table / infinite scroll** — unnecessary per the Performance numbers above: a page is ≤100 rows, never the full 10,000.
- **Client-side sort/search/filter** — the server already does all three fast (see Performance); duplicating that logic client-side would be pure added complexity.
- **Optimistic mutation UI** — dialog closes, list refetches; no rollback-on-error machinery to build or test.
- **Column show/hide customization, saved views** — no evidence this single-persona tool needs it; revisit if asked for.

## Subtasks

- [x] Backend: `app/errors.py` with `ConflictError(ValueError)`
- [x] Backend: `list_employees` — add `Employee.id.asc()` secondary sort + regression test
- [x] Backend: explicit duplicate-email pre-check (self-excluding on update) + generic `IntegrityError` backstop in `create_employee`/`update_employee` → `409` via `ConflictError` + tests
- [x] `npx shadcn add table dialog alert-dialog input label badge`
- [x] `src/api/client.js`: extract `handleResponse`, add `apiMutate`, normalize `''` params to `undefined`
- [x] `src/lib/apiError.js`: `formatApiErrorDetail` (string passthrough + FastAPI array shape + fallback)
- [x] `src/api/employees.js`: `fetchEmployee`, `createEmployee`, `updateEmployee`, `deactivateEmployee`, `fetchSalaryHistory` + mappers
- [x] `src/lib/useDebouncedValue.js`
- [x] `src/lib/queryKeys.js`: `employees.detail(id)`, `employees.salaryHistory(id)`, root keys for `employees`/`kpis`/`breakdowns`
- [x] `src/lib/invalidateEmployeeData.js`
- [x] `src/hooks/useEmployee.js`, `useSalaryHistory.js` (query, `enabled`-gated), `useCreateEmployee.js`, `useUpdateEmployee.js`, `useDeactivateEmployee.js` (mutations, call `invalidateEmployeeData` on success)
- [x] `src/components/employees/EmployeeFilterBar.jsx`
- [x] `src/components/employees/EmployeeTable.jsx` (sortable headers restricted to the verified allow-list, status `Badge`, row-action callbacks only — no dialog state)
- [x] `src/components/employees/EmployeePagination.jsx`
- [x] `src/components/employees/EmployeeFormDialog.jsx` (fetches detail in edit mode, gated on `isSuccess`; clears salary on country change)
- [x] `src/components/employees/EmployeeDetailDialog.jsx`
- [x] `src/components/employees/DeactivateEmployeeDialog.jsx`
- [x] `src/pages/EmployeesPage.jsx`: params state, hoisted `{mode, employeeId}` dialog state (keyed remount), out-of-range-page handling
- [x] Tests (see Test Cases)

## Test Cases

| Test | Verifies |
|---|---|
| `test_employees_api.py` (extends existing) | Creating with an in-use email returns `409` with a clear `detail`; updating to another employee's email returns `409`; updating an employee while keeping its own email succeeds (self-exclusion) |
| `test_employee_service.py` (extends existing) | Paginating a sort on a low-cardinality column returns every row exactly once across pages (tiebreaker regression) |
| `client.test.js` (extends existing) | `apiMutate` sends the given method + a JSON-encoded body; non-2xx still throws `ApiError` with status + detail; an empty-string param is dropped like `undefined` |
| `apiError.test.js` | A string `detail` passes through unchanged; FastAPI's `[{loc, msg, type}]` array becomes readable text; a missing/malformed `detail` falls back to a generic message |
| `employees.test.js` (extends existing) | `createEmployee`/`updateEmployee` call `apiMutate` with the right method/path/body; `deactivateEmployee` sends `PATCH`; `fetchSalaryHistory` maps `hike_percent`/salary fields from wire strings to numbers |
| `useDebouncedValue.test.js` | Value only updates after the delay elapses; a value change before the delay resets the timer (fake timers) |
| `EmployeeFilterBar.test.jsx` | Department/country/status selects call `onParamsChange` like the dashboard's `FilterBar`; typing in search only calls it once, after the debounce settles |
| `EmployeeTable.test.jsx` | Renders rows from a stubbed `useEmployees` result; clicking a sortable header calls `onParamsChange` with the toggled `sort_by`/`sort_dir` using the correct allow-list value (e.g. `"department"`, not `"department_name"`); the Status header has no click handler and renders no sort arrow; each `employment_status` renders its own `Badge` variant |
| `EmployeePagination.test.jsx` | Prev disabled on page 1, Next disabled on the last page; changing page size calls `onParamsChange` with `page_size` and resets `page` to 1 |
| `EmployeeFormDialog.test.jsx` | Edit mode renders no form fields until the detail query resolves (`isSuccess`), then prefills from the detail response, not the list row; changing the country clears the salary field and updates the currency label; submitting sends the complete `EmployeeUpdateRequest` field set; a `409`/`422` from the mutation renders `formatApiErrorDetail(error)` in an inline banner instead of closing the dialog |
| `EmployeeDetailDialog.test.jsx` | Renders employee detail fields and salary-history rows from stubbed hooks; hooks are not called (`enabled: false`) until the dialog is open |
| `EmployeesPage.test.jsx` | Integration: picking a department filter resets `page` to 1; sorting does not; opening the edit dialog for employee B right after closing one for employee A shows no leaked field values or error banner; a successful create invalidates employees, KPIs, and breakdowns; landing on an out-of-range page (empty `items`, nonzero `total_items`) shows the "go to first page" state |

Deliberately not tested: shadcn `table`/`dialog`/`alert-dialog`/`badge` internals (vendored); the deactivate confirmation dialog's own copy (trivial, covered indirectly by the row-action test); exhaustive filter-combination matrix (same reasoning as the dashboard doc — one filter proven per component tests the pattern, not new risk).

## Verification

1. `npm run test:run` — all green (`npm run test` is watch mode, not the CI-style run).
2. `pytest` (backend) — the new 409, self-exclusion, and tiebreaker tests all pass.
3. `npm run build`.
4. End-to-end against the 10k-seeded dev DB (not the throwaway perf DB): seed, run the backend, `npm run dev`, and click through: paginate to a deep page on a low-cardinality sort (no repeats/gaps), sort by salary descending, search a partial name (one request, debounced), create an employee, edit it (including a country change — confirm the salary clears), view its salary history after the edit (confirms the history entry appeared), deactivate it, and confirm a duplicate-email create shows a clean inline error instead of a crash.
