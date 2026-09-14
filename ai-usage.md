# AI Usage

## Tooling

The primary tool was **Claude Code**, used in an interactive, conversational workflow for planning, implementation, testing, code review, deployment troubleshooting, and the writing of this documentation itself. Google Gemini was used separately, as a second opinion on Claude's planning — reviewing the requirements/scope and feature plans it produced, rather than relying on a single model's plan unchecked.

## 1. Cross-model review of planning

Once Claude produced a plan — the initial requirements/scope, and later individual feature plans — that plan was reviewed independently by Google Gemini before being finalized. Feedback from that review drove further iteration on the plan itself, and only the resulting, twice-reviewed version was actually built against. The point of bringing in a second model at the planning stage specifically was to catch blind spots or unquestioned assumptions a single model (and a single conversation with it) might not surface on its own — the same reasoning as getting a second opinion from a colleague on a design before writing code.

## 2. Spec-first, per-feature context

Before writing code for a feature, a `.md` spec was written for it first (the files under `docs/`). Every spec followed the same template — Purpose, Stack/Endpoints, Key Decisions, Data Flow, Deliberately Excluded, Subtasks, Test Cases, Verification — so each new feature handed the model the same structured context (what's being built, why, and how it'll be verified) instead of re-explaining the project from scratch every time. The template itself was refined once, early on, and then reused for every feature after.

## 3. Incremental build, gated by tests

Features were built one piece at a time rather than generated in bulk. The database layer, for example, was built and tested table by table (`Country` → `Department` → `Employee` → `SalaryHistory`) — each model's tests passing before the next model started. The commit history reflects this: one layer or feature per commit, not a single large drop.

## 4. Tests and build as a guardrail on every change

Every code change went through the same loop before being considered finished: run the relevant test suite (`pytest` for backend changes, `npm run test:run` for frontend changes) and, for frontend work, a production `npm run build`. Any failure — a broken test, a build error — was fed straight back to the model as the next prompt, so the fix was driven by the actual error output rather than a guess at what might be wrong. This ran on every change, not only at feature boundaries, which kept regressions from a given edit from silently surviving into the next one.

## 5. Test generation with deliberate scope, not maximized count

Tests were generated against explicit coverage expectations per feature — uniqueness constraints, FK validation, default values, empty-result handling, boundary conditions on pagination/filtering. Just as important, several docs record what was *deliberately not tested* and why: vendored UI component internals, a rendering pattern already proven by a sibling component's test, library behavior that would test the library rather than this code. The goal was meaningful coverage, not test count for its own sake.

## 6. Trade-off reasoning captured as an artifact, not left implicit

Every feature doc has a "Key Decisions" section recording *why* a choice was made, not just what was built — e.g. why salary is stored in both local currency and a precomputed USD value, why median is computed in Python rather than SQL, why salary history is an append-only side table instead of full row-versioning. These were worked out in conversation with the model and written down immediately, so the reasoning survives past the moment it was decided.

## 7. Verifying AI output against real sources, not training data

Package choices and API usage were checked against the actual registry/documentation rather than taken on faith from the model's training data — flagged explicitly in `docs/frontend-foundation.md`. This matters most for fast-moving ecosystems (npm packages, library APIs) where a model's training cutoff can be stale.

## 8. A dedicated review pass after the build was functionally complete

Once the app was working end to end, a separate review pass was run with the model acting as a critic of the existing code and docs rather than a generator of new code. That pass caught a real UX bug — a loading-flash on filter/pagination changes, fixed by adding `placeholderData: keepPreviousData` to the affected query hooks — plus documentation issues: a broken cross-reference between docs, and a README that didn't link every tracked markdown file in the repo. Using AI for critique of its own prior output, not only for first-pass generation, caught issues a single generation pass wouldn't have surfaced.

## 9. AI-assisted deployment troubleshooting

Diagnosing why writes made through the deployed app weren't persisting (Vercel's backend runs on a stateless, per-instance filesystem) and the resulting migration to a hosted Postgres database (Neon) — including branching the database engine setup by SQL dialect so the existing SQLite-based test suite kept working unchanged — was done through AI-assisted debugging against real deploy logs and connection errors, not just applied to application code.

## Net effect

The result of offloading implementation boilerplate, test scaffolding, and first-draft documentation to AI was that effort could go toward the things a template can't produce: which trade-offs to make, what to deliberately leave out and why, and where the first version of the product was actually wrong. The `docs/` directory is itself the evidence of where that effort landed.
