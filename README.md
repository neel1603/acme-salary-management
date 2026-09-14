# ACME Salary Management

A salary management and analytics platform for ACME Corp's HR team — replacing spreadsheet-based salary tracking for a 10,000-employee, multi-country organization.

Built as a take-home engineering assessment for Incubyte's Software Craftsperson (Python/React/AI) role, for a single HR Manager persona.

## Live demo

- **App**: https://acme-salary-management-frontend.vercel.app/
- **API**: https://acme-salary-backend.vercel.app/ (`/docs` for interactive OpenAPI docs, `/health` for a liveness check) — not something you need to visit directly; the frontend talks to it.

## Features

- **Dashboard** — headcount, total payroll, average/median salary KPIs, with department/country breakdowns and charts, filterable by department, country, status, and hire date range.
- **Employee directory** — paginated, sortable, server-filtered table of all 10,000 employees; free-text search (debounced); create, edit, and deactivate; a detail view with full salary-change history.
- **AI query assistant** — ask HR questions in plain English ("average salary in Engineering for employees hired after 2022"); a Gemini-backed agent negotiates against the same KPI/breakdown/search tools the UI itself uses, so its answers are grounded in real query results, not invented.

## Stack

- **Backend**: Python 3.12, FastAPI, SQLAlchemy 2.0, Pydantic v2
- **Database**: SQLite (local dev/tests), Neon (serverless Postgres) in production
- **Frontend**: React 19 (Vite), TanStack Query, shadcn/ui (Base UI), Recharts, Tailwind
- **AI**: Google Gemini (`google-genai`), via a function-calling tool loop over the existing service layer
- **Tests**: pytest (backend), Vitest + React Testing Library (frontend)
- **Lint**: ruff (backend), ESLint (frontend)
- **Deploy**: two independent Vercel projects (frontend, backend), Neon Postgres for persistent writes

## Architecture

```
frontend/   React SPA (Vite) — pages -> hooks (TanStack Query) -> api/ (fetch wrappers)
backend/    FastAPI app
  app/routers/    HTTP layer — request/response shapes, status codes, error translation
  app/services/   business logic — queries, aggregation, the AI tool-call dispatch
  app/models/     SQLAlchemy ORM models
  app/schemas/    Pydantic request/response schemas
  app/seed/       deterministic 10k-employee mock data generator
```

The frontend never talks to the database directly — every read and write goes through the FastAPI service layer, which is also exactly what the AI assistant's tools call into. One source of truth for "how a KPI is computed" or "what counts as a valid employee update," used by the UI, the AI, and the tests alike.

## Getting started

### Backend

```
cd backend
python -m venv .venv
.venv\Scripts\activate        # Windows; use `source .venv/bin/activate` on macOS/Linux
pip install -r requirements.txt
cp .env.example .env          # set GEMINI_API_KEY; DATABASE_URL defaults to local SQLite
uvicorn app.main:app --reload
```

The database is created and seeded with 10,000 mock employees automatically on first run (`ensure_seeded()` — cheap no-op on every run after). API is served at `http://localhost:8000`, interactive docs at `/docs`.

### Frontend

```
cd frontend
npm install
cp .env.example .env          # VITE_API_BASE_URL defaults to the local backend above
npm run dev
```

App is served at `http://localhost:5173`.

## Testing

```
cd backend && pytest
cd frontend && npm run test:run
```

CI runs both suites, plus `ruff check`, ESLint, and a production `npm run build`, on every push/PR to `main`.

## Documentation

Every feature has a design doc in `docs/`, committed one step ahead of its implementation, covering the decisions made and why — not just what was built:

- [`docs/database-schema.md`](docs/database-schema.md) — schema, indexes, and data-modeling trade-offs
- [`docs/seed-data.md`](docs/seed-data.md) — the deterministic mock-data generator
- [`docs/employee-directory-api.md`](docs/employee-directory-api.md) — employee CRUD + listing API design
- [`docs/kpi-dashboard-api.md`](docs/kpi-dashboard-api.md) — KPI/breakdown aggregation API design
- [`docs/ai-query-api.md`](docs/ai-query-api.md) — AI query assistant API design
- [`docs/frontend-foundation.md`](docs/frontend-foundation.md) — API client, routing, and layout foundation
- [`docs/frontend-dashboard.md`](docs/frontend-dashboard.md) — dashboard page design
- [`docs/frontend-employee-mgmt.md`](docs/frontend-employee-mgmt.md) — employee directory page design, plus the 10k-row performance benchmarks that justified skipping client-side virtualization/search/sort
- [`docs/frontend-ai-query.md`](docs/frontend-ai-query.md) — AI query assistant UI design

`frontend/README.md` is the unmodified default Vite template readme (framework/tooling notes, not project-specific) — left as-is rather than deleted, since it's still accurate about the underlying Vite setup.
