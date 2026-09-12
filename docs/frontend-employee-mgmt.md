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

### Filter or search changes reset to page 1; sort changes don't

The dashboard has no pagination, so this case didn't exist yet. Narrowing a filter while sitting on page 12 of the old result set would silently land on an out-of-range or misleading page. Changing `department_id`/`country_id`/`employment_status`/`search` resets `page` to 1; changing `sort_by`/`sort_dir` or `page_size` does not, since re-sorting or widening the page size while staying on the current page is the expected behavior (and the backend clamps `page` anyway if it ends up out of range).

### Sorting and pagination are entirely server-driven

Clicking a column header updates `sort_by`/`sort_dir` in the same params object that already drives every other filter; the `useEmployees` hook (already generic — it takes a params object it doesn't need to know the shape of) refetches exactly like a filter change. No client-side re-sort of the fetched page. This matches the Performance numbers above: the server computing order over an index is materially cheaper and simpler than re-sorting a page of already-truncated rows in JS, and it means "sorted by salary_usd descending" is correct across the *whole* 10,000-row set, not just within whatever page happened to be loaded.

### Hand-rolled Prev/Next pagination, plus a page-size selector

Shadcn's Base UI kit doesn't have a stock pagination primitive worth pulling in for two buttons and a page count — same "does this dependency earn itself" judgment as the dashboard's native `<input type="date">` decision. `EmployeePagination` is `< Prev` / `Page X of Y (N total)` / `Next >`, with Prev disabled on page 1 and Next disabled on the last page. A page-size `<Select>` (25 / 50 / 100, matching the backend's own clamp) is included — it's a single trivial control, and the Performance numbers show page size doesn't meaningfully change server cost, so there's no reason to hide it behind "advanced" anything.

### Status shown as a colored `Badge`, not plain text

An HR manager scanning 25–100 rows for who's inactive benefits from a color they can pattern-match rather than reading text repeated in every row: `Active` (green-ish), `On Leave` (amber-ish), `Terminated` (gray). Purely visual — the underlying value is still the plain `employment_status` string.

### One shared `EmployeeFormDialog` for create and edit

`EmployeeCreateRequest` and `EmployeeUpdateRequest` are the same field set (create additionally defaults `employment_status`). `EmployeeFormDialog` takes an optional `employee` prop: absent means create (empty form, `useCreateEmployee`), present means edit (pre-filled, `useUpdateEmployee`). One component, one set of field markup, instead of two dialogs that would drift out of sync. Plain controlled `useState` per field — no `react-hook-form`: the form is a flat object with no cross-field or async validation, so native HTML validation (`required`, `type="email"`, `type="number" min="0"` on salary) covers the boundary cases that matter for a single HR user filling one form at a time. The backend stays the real source of truth (422 on a bad department/country id, 409 on a duplicate email — see below); the dialog surfaces whatever `detail` string comes back in an inline error banner rather than re-deriving its own validation rules.

### Deactivate needs a confirmation step

`PATCH /employees/{id}/deactivate` is technically reversible (Edit can set status back), but it *reads* to an HR user as "letting someone go" — a consequential action that shouldn't fire on a misclick. Confirmed via shadcn `alert-dialog`, not a bare button. The action is hidden/disabled once an employee is already `Terminated`.

### "View" opens detail + salary history together, not two separate dialogs

Considered a separate "salary history" action, but an HR user checking someone's raise history almost always also wants their current role/department/pay in the same glance. `EmployeeDetailDialog` fetches `GET /employees/{id}` (for department/country/currency/job info the list row doesn't carry — `EmployeeSummary` omits `currency_code`, `department_id`, etc.) and `GET /employees/{id}/salary-history` together, gated by `enabled: open` so neither fires until the dialog is actually opened. History rows show `old → new` in the employee's *local* currency with `hike_percent`, not USD — HR reviewing a raise thinks in the currency they set it in, matching `EmployeeDetailResponse.currency_code`.

### `apiFetch` stays GET-only; a new `apiMutate` handles writes

`src/api/client.js`'s `apiFetch` only ever built a query string and called `fetch(url)` — there was no consumer of POST/PUT/PATCH until now. Rather than reshape `apiFetch`'s signature (and touch every existing call site in `kpis.js`/`breakdowns.js`/`lookups.js`/`employees.js` for a capability they don't need), the non-2xx-handling logic is pulled into a shared `handleResponse` helper, and a sibling `apiMutate(path, {method, body})` sends a JSON body with the same `ApiError` behavior. Smaller diff, and it keeps "builds a query string" and "sends a body" as two things a reader can look at separately instead of one function branching on which one you meant.

### Backend fix: duplicate email currently raises an unhandled 500

Found while designing the create-dialog's error handling: `employee_service.create_employee`/`update_employee` never catch the unique-`email` constraint. A duplicate email today raises an unhandled `IntegrityError` — FastAPI turns that into a bare 500 with no usable `detail`, which is the single most likely validation failure an HR user will actually hit (typo'd or reused email) and the one case the dialog's error banner couldn't show anything useful for. Small backend fix, included here rather than filed as a separate doc: catch `IntegrityError`, roll back, raise `HTTPException(409, detail="Email already in use")`.

## Data Flow

`EmployeesPage` owns one `params` object (`page`, `page_size`, `department_id`, `country_id`, `employment_status`, `search`, `sort_by`, `sort_dir`) via `useState`, passed whole to `useEmployees` — same "one filter shape, `useState` at the page level" pattern as `DashboardPage`. `EmployeeFilterBar` and `EmployeeTable`'s sortable headers both call `onParamsChange` with a patch; `EmployeesPage` merges it and resets `page` to 1 when a filter/search field (not sort/page_size) changed. `EmployeePagination` calls it directly for `page`/`page_size`.

Row actions (`View`, `Edit`, `Deactivate`) are owned by `EmployeeTable`, which renders the three dialogs (lazily, one active row's worth at a time) and the mutation hooks. Every mutation invalidates the `['employees', 'list']` query-key prefix on success, so the currently-visible page refetches with fresh data — no optimistic updates, no manual cache patching; the dialog just closes and the list catches up, matching the dashboard's existing "no retry button, no shimmer" preference for simplicity over perceived-speed polish.

## Deliberately Excluded

- **Bulk import/export, bulk edit** — out of scope per the original build plan's CRUD boundary (single-record only).
- **Reactivate button** — deactivate is one-directional in the UI; un-terminating someone is an Edit (change status back), not a dedicated action, matching the brief's soft-delete-only scope.
- **Virtualized table / infinite scroll** — unnecessary per the Performance numbers above: a page is ≤100 rows, never the full 10,000.
- **Client-side sort/search/filter** — the server already does all three fast (see Performance); duplicating that logic client-side would be pure added complexity.
- **Optimistic mutation UI** — dialog closes, list refetches; no rollback-on-error machinery to build or test.
- **Column show/hide customization, saved views** — no evidence this single-persona tool needs it; revisit if asked for.

## Subtasks

- [ ] `npx shadcn add table dialog alert-dialog input label badge`
- [ ] Backend: catch `IntegrityError` on duplicate email in `create_employee`/`update_employee` → `409` + test
- [ ] `src/api/client.js`: extract `handleResponse`, add `apiMutate`
- [ ] `src/api/employees.js`: `fetchEmployee`, `createEmployee`, `updateEmployee`, `deactivateEmployee`, `fetchSalaryHistory` + mappers
- [ ] `src/lib/useDebouncedValue.js`
- [ ] `src/lib/queryKeys.js`: `employees.detail(id)`, `employees.salaryHistory(id)`
- [ ] `src/hooks/useEmployee.js`, `useSalaryHistory.js` (query, `enabled`-gated), `useCreateEmployee.js`, `useUpdateEmployee.js`, `useDeactivateEmployee.js` (mutations)
- [ ] `src/components/employees/EmployeeFilterBar.jsx`
- [ ] `src/components/employees/EmployeeTable.jsx` (sortable headers, status `Badge`, row actions)
- [ ] `src/components/employees/EmployeePagination.jsx`
- [ ] `src/components/employees/EmployeeFormDialog.jsx`
- [ ] `src/components/employees/EmployeeDetailDialog.jsx`
- [ ] Wire it all into `src/pages/EmployeesPage.jsx`
- [ ] Tests (see Test Cases)

## Test Cases

| Test | Verifies |
|---|---|
| `test_employees_api.py` (extends existing) | Creating/updating with an email already in use returns `409` with a clear `detail`, not an unhandled `500` |
| `client.test.js` (extends existing) | `apiMutate` sends the given method + a JSON-encoded body; non-2xx still throws `ApiError` with status + detail |
| `employees.test.js` (extends existing) | `createEmployee`/`updateEmployee` call `apiMutate` with the right method/path/body; `deactivateEmployee` sends `PATCH`; `fetchSalaryHistory` maps `hike_percent`/salary fields from wire strings to numbers |
| `useDebouncedValue.test.js` | Value only updates after the delay elapses; a value change before the delay resets the timer (fake timers) |
| `EmployeeFilterBar.test.jsx` | Department/country/status selects call `onParamsChange` like the dashboard's `FilterBar`; typing in search only calls it once, after the debounce settles |
| `EmployeeTable.test.jsx` | Renders rows from a stubbed `useEmployees` result; clicking a sortable header calls `onParamsChange` with the toggled `sort_by`/`sort_dir`; each `employment_status` renders its own `Badge` variant |
| `EmployeePagination.test.jsx` | Prev disabled on page 1, Next disabled on the last page; changing page size calls `onParamsChange` with `page_size` and resets `page` to 1 |
| `EmployeeFormDialog.test.jsx` | With no `employee` prop, submitting calls the create mutation with form values; with one, calls update with pre-filled values; a `409`/`422` from the mutation renders its `detail` in an inline banner instead of closing the dialog |
| `EmployeeDetailDialog.test.jsx` | Renders employee detail fields and salary-history rows from stubbed hooks; hooks are not called (`enabled: false`) until the dialog is open |
| `EmployeesPage.test.jsx` | Integration: picking a department filter resets `page` to 1; sorting does not; a full create→refetch flow with all hooks mocked |

Deliberately not tested: shadcn `table`/`dialog`/`alert-dialog`/`badge` internals (vendored); the deactivate confirmation dialog's own copy (trivial, covered indirectly by the row-action test); exhaustive filter-combination matrix (same reasoning as the dashboard doc — one filter proven per component tests the pattern, not new risk).

## Verification

1. `npm run test` — all green.
2. `pytest` (backend) — the new 409 test passes.
3. `npm run build`.
4. End-to-end against the 10k-seeded dev DB (not the throwaway perf DB): seed, run the backend, `npm run dev`, and click through: paginate to a deep page, sort by salary descending, search a partial name, create an employee, edit it, view its salary history after the edit (confirms the history entry appeared), deactivate it, and confirm a duplicate-email create shows a clean inline error instead of a crash.
