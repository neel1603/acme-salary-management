# Frontend Dashboard

## Purpose

Builds the Dashboard page (`/`) that `docs/frontend-foundation.md`'s routing shell and API layer were built for: four KPI cards, two breakdown charts (department, country), and a filter bar that drives all three off one shared filter shape. This is the first real consumer of `useKpiSummary`, `useDepartmentBreakdown`, `useCountryBreakdown`, and `useLookups` — until now they were only proven against stubbed fetches in tests.

## Stack

New dependencies: `recharts` (charts) + `react-is` (its required peer, already flagged in `frontend-foundation.md`'s tooling notes but not installed until there's a consumer). New shadcn components: `card` (KPI card chrome) and `select` (filter dropdowns), both generated on top of Base UI per the existing `components.json`. New dev dependency: `@testing-library/user-event` — `FilterBar` and `DashboardPage`'s tests are the first ones that need to simulate a click/select instead of just asserting on rendered output.

## Key Decisions

### One filter state, three consumers, per-endpoint trimming

`FilterBar` holds a single filter object — `department_id`, `country_id`, `employment_status`, `hire_date_from`, `hire_date_to` — that `DashboardPage` passes to all three hooks unchanged. But `useDepartmentBreakdown`/`useCountryBreakdown` must not forward the dimension they're grouping by, matching the backend contract `frontend-foundation.md` already documents: "each breakdown endpoint omits the param matching its own grouping dimension."

Building this UI surfaces a real gap in the already-committed `src/api/breakdowns.js`: it currently forwards whatever filters object it's given verbatim. Since FastAPI silently ignores query params an endpoint doesn't declare, filtering to a single department wouldn't error — it would just silently have no effect on the department-breakdown chart while still narrowing the country-breakdown chart and the KPI cards, which is a confusing mismatch to discover by clicking around. Fixed here by having each `fetch*Breakdown` function whitelist exactly the params its endpoint accepts, the same way each mapper's destructuring already documents the *response* shape — now the request-building side documents the *request* shape too.

### Charts show average salary; headcount and payroll ride along in the tooltip

Considered one chart per metric per dimension (department headcount, department avg salary, country headcount, country avg salary — four charts). That's more chart than a first pass earns, and the brief rewards judgment over feature maximalism. Average salary per department/country is the one figure a spreadsheet pivot doesn't hand you at a glance, and it's the closest match to what the dashboard is actually for: "how does pay compare across X." Headcount and total payroll for that department/country are still one hover away via a custom Recharts tooltip, in case a manager wants to sanity-check whether a high average is one outlier salary skewing a small team.

### Department/country filters default to unset, not an explicit "All"

Employment status keeps the backend's own default (`Active`, with an `All` escape hatch) since that's a real business default worth surfacing in the UI. Department and country have no equivalent business default — "All Departments" is just the absence of a filter, not a decision — so their `<Select>` uses `undefined` for that option rather than a literal `"All"` value, matching how `apiFetch`'s query-string builder already drops `undefined`/`null` params.

### Native `<input type="date">` for the hire-date range, not a calendar widget

Base UI's date-picker pattern (`Popover` + `Calendar`) is the "correct" shadcn answer here, but two more vendored components for a range filter that's peripheral to what the brief asks for (payroll/headcount/salary breakdowns, not hiring-trend analysis) is more UI than the feature earns. `<input type="date">` natively produces the `YYYY-MM-DD` string the backend already expects, with zero extra dependencies.

## Data Flow

`DashboardPage` owns `filters` state (`useState`, shape matches the backend's `EmployeeFilterParams`). `FilterBar` is controlled: it receives `filters` and `onFiltersChange`, and renders the department/country/status `<Select>`s plus the two date inputs. Any change calls `onFiltersChange` with the new filter object — no local state inside `FilterBar` itself. Because `filters` is part of every hook's query key, TanStack Query refetches automatically; no "Apply" button, no debounce (selects and date pickers aren't a text field someone types into rapidly).

`KpiCardGrid` calls `useKpiSummary(filters)` once and renders four `KpiCard`s off the one response. `DepartmentBreakdownChart` and `CountryBreakdownChart` each call their own hook and render a Recharts `BarChart`. All three show a plain loading state (`—` in the KPI cards, an empty chart frame with "Loading…") while `isLoading`, and a plain error message on `isError` — no retry button, no skeleton shimmer; `queryClient`'s existing `retry: 1` default already covers transient failures.

## Deliberately Excluded

- **Employee table** — deferred to the employee-management UI doc; this page is only the four KPI cards, two charts, and the filter bar.
- **Drill-down from a chart bar into a filtered employee table** — no employee table exists yet to drill into; revisit once it does.
- **Chart export / print / PDF** — not in the brief.
- **Debounced or "Apply"-gated filter changes** — selects and dates don't need it; revisit only if a future filter is a free-text field.

## Subtasks

- [x] `npm install recharts` + `npm install react-is` (explicit peer) + `npx shadcn add card select`
- [x] Fix `src/api/breakdowns.js` so each breakdown function drops its own grouping-dimension filter
- [x] `src/components/dashboard/KpiCard.jsx`, `KpiCardGrid.jsx`
- [x] `src/components/dashboard/FilterBar.jsx`
- [x] `src/components/dashboard/DepartmentBreakdownChart.jsx`, `CountryBreakdownChart.jsx`
- [x] Wire it all into `src/pages/DashboardPage.jsx`
- [x] Tests (see Test Cases)

## Test Cases

| Test | Verifies |
|---|---|
| `breakdowns.test.js` (extends the existing file) | `fetchDepartmentBreakdown`/`fetchCountryBreakdown` never send their own grouping dimension as a query param, even when it's present in the filters object passed in |
| `FilterBar.test.jsx` | Changing a department/country/status `<Select>` or a date input calls `onFiltersChange` with the expected filter object; the "all" options omit that key entirely |
| `KpiCardGrid.test.jsx` | Renders the four labeled KPI values from a stubbed `useKpiSummary` result; shows a loading placeholder while `isLoading` |
| `DepartmentBreakdownChart.test.jsx` | Loading and error branches render their own copy instead of the chart; once data arrives, the chart container renders and neither the loading nor error copy does |
| `DashboardPage.test.jsx` | Integration: with all four hooks mocked, confirms the page renders the filter bar, KPI cards, and both charts together; picking a department updates the KPI and country hooks' filter argument |

Deliberately not tested: `CountryBreakdownChart` (same rendering pattern as `DepartmentBreakdownChart`, proven once — testing both tests the pattern, not new risk); Recharts' own SVG output — confirmed while writing `DepartmentBreakdownChart.test.jsx` that jsdom gives `ResponsiveContainer` zero width, so Recharts never renders inner axis/bar markup to assert against; the test asserts our own branching logic instead.

## Verification

1. `npm run test` — all green.
2. `npm run build`.
3. End-to-end: seed + run the backend, `npm run dev`, click through each filter and confirm the KPI cards and both charts update together; confirm a department filter narrows the country chart and KPI cards but has no visible effect on the department chart (expected, per Key Decisions above).
