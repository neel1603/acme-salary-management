# Frontend Foundation

## Purpose

Establishes the frontend project and an API layer in front of the backend, so the dashboard and employee-management UI (their own docs, next) can consume real data through hooks with well-documented shapes, instead of ad-hoc `fetch` calls scattered through components.

## Stack

Vite + React 19 + **plain JavaScript** (no TypeScript — `.jsx` for anything returning markup, `.js` otherwise, no `tsconfig`/type-checking step), Tailwind v4 + shadcn/ui, `react-router` v8 for the two-page routing shell, TanStack Query v5 for data fetching/caching, Vitest + React Testing Library for tests.

Delivered as this doc plus two feature commits: **scaffold** (project, routing shell, test harness), then **API layer** (a `fetch` wrapper, per-endpoint functions, query hooks).

App shell is a **top nav bar** (title + Dashboard / Employees links), not a sidebar — minimal chrome for a two-page, single-persona tool, leaving full width for KPI cards, charts, and the employee table.

Without TypeScript, there's no compiler to catch a wire-shape mismatch between what the backend actually sends and what a component expects. The mapper tests in the API-layer commit (see Test Cases) are what stands in for that — they carry more weight here than they would in a typed stack.

## Key Decisions

### Money is parsed to `number` once, at the API-client boundary

Pydantic v2 serializes `Decimal` to a JSON string (confirmed by the backend test asserting `body["salary_usd"] == "80000.00"`), so every money field (`total_payroll_usd`, `average_salary_usd`, `median_salary_usd`, `salary_usd`, `salary_local`, `hike_percent`) arrives as a `string`. The frontend does no arithmetic on money — it only displays and charts it — so keeping money as `string` throughout would just mean a parse call at every consumption site (including inside chart adapters and sort comparators) with no matching precision benefit.

Each `src/api/*.js` function fetches, then maps the wire shape to a domain shape with money as `number`, before TanStack Query caches it — so every component and chart downstream is parse-free. `number` is safe here: the largest figure in play is total payroll, and 10,000 employees at even $500k each is 5×10⁹ (5×10¹¹ in cents), four orders of magnitude below `Number.MAX_SAFE_INTEGER` (≈9.0×10¹⁵). No accumulation happens client-side — the backend already sums with `Decimal`. `src/lib/money.js` holds `parseMoney(value)`, `formatUsd(n)`, and `formatUsdCompact(n)` (for the headline payroll tile and chart axis ticks), with this reasoning as a comment so it reads as a judgment call, not an oversight.

There's no TypeScript interface to formalize the wire-shape/domain-shape split, so it's a convention rather than an enforced boundary: each `api/*.js` module's mapper function is the only code that ever sees a wire response, and its destructuring *is* the documentation of that wire shape, sitting right next to the conversion to `number` — the two can't drift apart silently the way a shared types file and its call sites might.

### Shared filter shape mirrors the backend's `employment_status`/`All` convention

`GET /kpis/summary` and both breakdown endpoints share `department_id`, `country_id`, `employment_status` (defaults `Active`; literal `All` disables the filter), `hire_date_from`, `hire_date_to` — each breakdown endpoint omits the param matching its own grouping dimension. `GET /employees` adds `page`, `page_size`, `search`, `sort_by`, `sort_dir`. No special-casing is needed for the `All` escape hatch on the frontend: `apiFetch`'s query-string builder drops `undefined`/`null` params and passes everything else through as-is, so an explicit `"All"` reaches the backend unchanged and an omitted filter is simply never sent.

Response shapes are not uniform, and since nothing enforces this at compile time it's worth stating plainly: breakdowns and salary history wrap arrays in `{data: [...]}`, `/employees` returns `{items, page, page_size, total_items, total_pages}`, and lookups return bare arrays. Dates stay strings (`hire_date` as `YYYY-MM-DD`; `created_at`/`updated_at`/`changed_at` as ISO datetimes) — nothing in the frontend does date arithmetic that would need them parsed.

### No dev proxy

`backend/app/config.py` already defaults `ALLOWED_ORIGINS` to `http://localhost:5173`, so the browser talks to `http://localhost:8000/api/v1` directly via `VITE_API_BASE_URL`. A Vite dev proxy would work locally but the deployed build needs a real base URL regardless, so the env var is the thing that has to exist either way — a proxy would just be a second path to maintain.

### `.gitignore` grows alongside the artifact it guards

The root `.gitignore` was Python-only (`__pycache__/`, `.venv/`, `.pytest_cache/`) before this work. Rather than writing every eventual Node pattern in one speculative pass, each pattern is added at the step that actually introduces the thing it ignores: `node_modules/` right before the first `npm install`, `dist/`/`dist-ssr/` alongside the first `npm run build`, and `.env`/`.env.*`/`!.env.example` alongside `.env.example` itself.

### Verified tooling (checked against the registry/docs, not assumed from training data)

- **`react-router` v8 — not `react-router-dom`.** The package was renamed; `<BrowserRouter>` wraps the app in `main.jsx`.
- **Node must be on an LTS line, not just "≥ 22.12".** Vitest 5's `engines` field is `^22.12.0 || ^24.0.0 || >=26.0.0` — it explicitly excludes odd-numbered, non-LTS releases like Node 23 and 25, not just older ones. On Node 23.1.0 (already EOL as of this writing), `npm install vitest` doesn't error — it silently falls back to `vitest@3.2.7`, the last major with no LTS-line gate, which in turn doesn't declare support for Vite 8 (`vite: "^5.0.0 || ^6.0.0 || ^7.0.0-0"`, versus 4.x/5.x's `"^6.4.0 || ^7.0.0 || ^8.0.0"`). That combination installs cleanly and looks fine until the test runner's internal Vite diverges from the project's Vite 8 plugins. Caught by checking `npm install`'s actual resolved version against the registry's `latest` tag rather than assuming the install succeeded because it didn't error. Fixed by upgrading to Node 24.21.0 (LTS "Krypton"), which resolves `vitest@5.0.0` correctly.
- **Tailwind v4 is CSS-first**: `@import "tailwindcss";` plus the `@tailwindcss/vite` plugin — no `tailwind.config.js`, no PostCSS config.
- **Vitest's `globals` defaults to `false`**, so React Testing Library's automatic `cleanup()` does not run automatically. `src/test/setup.js` needs an explicit `afterEach(cleanup)`, or the DOM leaks between tests and failures surface far from their cause.
- **`recharts` needs `react-is`** as an explicit peer install (used by the next doc, not this one, but noted here since it's part of the same dependency install).
- **shadcn/ui supports plain JS.** `components.json`'s `tsx` field, set to `false`, makes the CLI generate `.jsx` components instead of `.tsx`. The JS analog of the `@/*`-alias config that TypeScript projects put in `tsconfig.json` is `jsconfig.json` (same `baseUrl`/`paths` shape). `shadcn init` should not be passed `--defaults` — that flag is documented as a Next.js preset. The exact `init` prompt sequence for a JS project (and whether it auto-detects `tsx: false` from the missing `tsconfig.json`) isn't documented — answer JavaScript/no-TypeScript if asked.
- **`shadcn init` now asks which primitive library to build components on** — `base` (Base UI), `radix` (Radix UI), or `aria` (React Aria). Base UI became the default in July 2026, replacing Radix. Chose **Base UI**: nothing else in this stack (Recharts, TanStack Query, react-router) depends on Radix, so there's no reason to override the new default.

## Deliberately Excluded

- **KPI cards, charts, filter bar, employee table, CRUD dialogs** — deferred to `docs/frontend-dashboard.md` and a later employee-management UI doc. This step ends at "the data layer works and is proven against the live API."
- **Mutation hooks** (create/update/deactivate employee) — deferred to the employee-management UI commit, where there's a form to wire them to; writing them now would mean designing them without a consumer.
- **A mock server (MSW)** — a `vi.fn()` fetch stub is enough while nothing but tests consumes the API layer; MSW earns its setup cost once real components are involved.
- **JSDoc type annotations** — would partially recreate what TypeScript gives for free; the wire→domain mapper tests are the chosen safety net instead, per the plain-JS decision above.

## Subtasks

- [x] Vite + React + JS scaffold, Tailwind v4 + shadcn/ui, `react-router` routing shell (`/`, `/employees`, not-found), Vitest + RTL harness + shell test
- [ ] `src/api/client.js` — `apiFetch` with query-string building and an `ApiError` subclass
- [ ] `src/api/kpis.js`, `breakdowns.js`, `employees.js`, `lookups.js` — per-endpoint functions + wire→domain mappers
- [ ] `src/lib/money.js` — `parseMoney`, `formatUsd`, `formatUsdCompact`
- [ ] `src/lib/queryKeys.js` — hierarchical query-key factory
- [ ] `src/hooks/*` — `useKpiSummary`, `useDepartmentBreakdown`, `useCountryBreakdown`, `useEmployees`, `useLookups`
- [ ] Tests for the above (see Test Cases)

## Test Cases

| Test | Verifies |
|---|---|
| `App.test.jsx` | Route table renders the Dashboard heading at `/`, Employees heading at `/employees`, not-found copy at an unknown path |
| `money.test.js` | `parseMoney("80000.00") === 80000`; `formatUsd`/`formatUsdCompact` on a large payroll number; behavior on empty/malformed input |
| `client.test.js` | Query-string construction drops unset params and keeps `employment_status=All` when set; a non-2xx response throws `ApiError` with status + server `detail` intact |
| `kpis.test.js`, `employees.test.js` | A stubbed wire response (money as string) comes back with money as `number` in the mapped domain object |

Deliberately not tested: the other per-endpoint functions (same pattern as the two above — testing all four tests the pattern, not new risk); TanStack Query hooks in isolation (that tests the library, not this code — they're exercised for real once the dashboard consumes them); shadcn `ui/*` components (vendored).

## Verification

1. `npm run test` in `frontend/` — all green. With no type checker in this stack, this is the primary safety net for the wire→domain mappers.
2. `npm run build` — proves the production bundle actually builds.
3. End-to-end against real data:
   ```
   cd backend
   python -m app.seed.seed_data --count 10000 --reset
   python -m uvicorn app.main:app --reload
   ```
   With `npm run dev` running, confirm in the browser devtools network tab that a hook's request hits `/api/v1/...`, returns 200, and that money fields arrive as quoted strings.
