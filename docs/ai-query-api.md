# AI Query API

## Purpose

Backs an optional, HR-facing natural-language question box (e.g. "what's the average salary in Engineering?", "how many people are active in Sales in India?") that answers from the real dataset instead of requiring HR to build a filter combination themselves. HR's own scope clarification named a natural-language interface as an *optional stretch*, not required, sitting alongside — not replacing — the KPI dashboard (`kpi-dashboard-api.md`) as the primary "answering questions" surface. This doc covers the backend contract only; a frontend doc follows separately once this is built, same as `frontend-dashboard.md` followed `kpi-dashboard-api.md`.

The model never queries the database directly. It is given a small, fixed set of tools that each wrap one already-built, already-tested service function (`kpi_service.get_kpi_summary`, `kpi_service.get_department_breakdown`, `kpi_service.get_country_breakdown`, `employee_service.list_employees`); its only job is picking which one answers the question and with what filter values, then narrating the result. There is no write tool, no freeform query generation, and no conversation memory. The answer streams to the frontend for a "typing" feel, but that streaming is a presentation-layer detail over an already-fully-computed answer — see Key Decisions.

## Endpoints

### `GET /api/v1/ai-query/status`

No parameters. Response `AiQueryStatusResponse`: `{"available": bool}`. Pure config check (`settings.gemini_api_key is not None`) — no LLM call, cheap enough for the frontend to call unconditionally on page load to decide whether to show the query box at all.

### `POST /api/v1/ai-query`

Request `AiQueryRequest`: `{"question": str}` — 1 to 500 characters after trimming; blank or over-length rejected with `422` before any model call is attempted.

Two distinct failure points, two different shapes of response:

**Before streaming starts** (tool-negotiation phase — fully synchronous): failures here still return normal JSON error responses with real status codes, because nothing has been sent to the client yet.

| Status | Body | When |
|---|---|---|
| `422` | `{"detail": "..."}` | Blank or >500 char question |
| `503` | `{"detail": "AI query is not configured"}` | `GEMINI_API_KEY` unset |
| `502` | `{"detail": "AI query is temporarily unavailable"}` | Upstream Gemini call fails/times out during negotiation |

**Once negotiation succeeds** (an answer string and grounding list exist): response becomes `text/event-stream`, framed as standard SSE (`event: <type>\ndata: <json>\n\n`):

| Event | Payload | When |
|---|---|---|
| `grounding` | `{"grounding": [GroundingItem, ...]}` | Sent once, first — before any answer text |
| `chunk` | `{"text": "..."}` | One per word-group of the already-complete answer, in order |
| `error` | `{"detail": "..."}` | Only if something fails *after* streaming has already started (defensive; see Key Decisions) |

`GroundingItem`: `{"tool": str, "arguments": dict}` — one entry per tool call the model actually made, in call order; empty list if the model answered directly (e.g. a decline) with no tool call.

## Key Decisions

### Tool-use over a fixed set of already-tested service functions, not a new query engine

The model never generates SQL, ORM queries, or code — `app/services/ai_query_service.py` defines a small tool schema where each tool maps 1:1 onto a function `kpi-dashboard-api.md`/`employee-directory-api.md` already built and tested: `get_kpi_summary`/`get_department_breakdown`/`get_country_breakdown` (each taking the same `EmployeeFilterParams` the KPI endpoints already build) and `search_employees` (wrapping `employee_service.list_employees`, with `page_size` clamped to 20 server-side regardless of what the model requests, so one tool call can't pull the whole directory into the prompt). A `dict[str, Callable]` dispatch table maps tool name to service call — there is no second implementation of any aggregation logic anywhere in this feature.

### Read-only tool surface — no write tool is ever exposed to the model

`employee_service.create_employee`/`update_employee`/`deactivate_employee` exist and are fully tested, but none are registered as tools here. The feature answers questions; it cannot be talked into changing a salary or deactivating someone no matter how the question is phrased, because the capability to do so was never given to it — enforced by what's in the tool schema, not by a runtime permission check on top of a bigger one.

### Department/country name resolution via an embedded lookup, not a resolver tool

HR will ask about "Engineering," not `department_id=3`. Rather than adding a `resolve_department_id(name)` tool and paying an extra round trip on every question, `ai_query_service.py` fetches the full department/country lists (same data as `GET /departments`/`GET /countries`) and embeds them as a compact name→id table directly in the system prompt on every request. Both tables are small and effectively static — no CRUD exists for either — so the fixed, small token cost of inlining them beats a resolver round trip paid on every single question.

### Bounded tool-call negotiation loop, fully synchronous, with a hard iteration cap

The negotiation loop is: send the question → model requests a tool call or returns final text → if a tool call, execute it server-side and feed the result back → repeat. `MAX_TOOL_ITERATIONS = 5` caps this; if no final answer has come back by then, the loop stops and treats a fixed "couldn't find a confident answer" string as the answer (still streamed normally, with whatever grounding was accumulated). This whole phase runs to completion — synchronously, no partial output sent — before the HTTP response commits to anything, which is what keeps the `422`/`503`/`502` error paths simple (see next decision).

### "Simulated" streaming of an already-complete answer, not true token-level provider streaming

True streaming would mean re-issuing a second, streaming-mode call into the same conversation once the model is done calling tools — and Gemini's function-calling-plus-streaming interaction has real edge cases (partial tool-call JSON arriving mid-stream) that aren't worth taking on for what is fundamentally a UX nicety on a stretch feature. Instead, the negotiation loop runs to completion exactly as it would without streaming, producing one complete answer string and a grounding list; the router then splits that string into small word-groups and emits them as `chunk` events with a short pacing delay between them (`asyncio.sleep`, tens of milliseconds). Same progressive "typing" appearance in the UI, a fraction of the risk, and it keeps essentially all of the real logic — and all of the tests — in the already-planned, fully synchronous negotiation service. The streaming layer in the router is close to boilerplate by design.

### Negotiation precedes streaming, so real HTTP status codes are still possible for real errors

HTTP headers/status can only be committed once. By running the entire tool-negotiation phase to completion *before* the router switches the response to `text/event-stream`, every failure that can be anticipated (bad input, missing key, upstream failure while negotiating) still gets a normal, specific status code (`422`/`503`/`502`) exactly as if streaming didn't exist. Only a failure that somehow happens *after* the first `grounding` event has already been sent has no HTTP-status escape left — that's the one case the `error` SSE event exists for, and it's expected to be rare (e.g. a dropped connection mid-send), not a primary error path.

### Tool-call negotiation itself is never streamed or shown to the user

Only the final `grounding` summary and the answer text ever reach the frontend — there's no live "checking department breakdown..." progress feed while the model is deciding which tools to call. Showing intermediate tool-call steps would be a reasonable enhancement for a chattier feature, but it's extra UI/wire surface this stretch feature doesn't need to earn its keep.

### `GEMINI_API_KEY` absence degrades the feature, not the app

A new `Settings.gemini_api_key: str | None` field (`os.getenv("GEMINI_API_KEY")`, default `None`) gates both endpoints. `GET /ai-query/status` reports `{"available": false}` when unset, which the frontend uses to hide the query box entirely rather than show a feature that will error; `POST /ai-query` still independently returns `503` if called anyway, so the API stays honest if hit directly rather than only being "safe" because the UI happens to hide it. Consistent with this being HR's own "optional stretch" — nothing else in the app depends on this key existing.

### System prompt instructs decline-over-guess for out-of-scope questions

The schema has no performance-review, headcount-history, or demographic data (`database-schema.md`'s own Non-Goals exclude demographic fields entirely), so "who's overdue for a review?" has no tool that can answer it. The system prompt explicitly tells the model to say it doesn't have that data rather than answer from general knowledge — grounding every answer in a tool call is pointless if the model can also fill gaps by guessing.

### Gemini free tier; exact model id pinned at implementation time

Uses Google's Gemini API free tier (an AI Studio key, no card required) rather than a paid Anthropic/OpenAI key, so anyone reviewing this — including a grader with no existing API account — can exercise the feature with a key obtained in about a minute, at no cost to either side. The specific free-tier flash-class model id gets pinned in `ai_query_service.py` at implementation time against Google's then-current free-tier lineup, rather than hardcoded here as a fact that could already be stale.

### Question length is capped before any model call

`AiQueryRequest.question` is validated to 1–500 characters at the schema layer and rejected with `422` before `ai_query_service` is invoked at all — bounds worst-case token spend per request independently of the tool-call iteration cap above.

### Sending row data to a free-tier model is fine here specifically because the data is synthetic

Free-tier LLM APIs (Gemini's included) commonly reserve the right to log and use submitted data for product improvement, unlike their paid tiers — a real constraint that would block this design outright against actual employee PII. It doesn't block it here because every name, email, and salary in this dataset is Faker-generated on a fixed seed against the `.example` reserved domain (`seed-data.md`), not a real person's data. Calling this out explicitly rather than not thinking about it at all: the same design would need re-evaluating (paid tier, or no third-party model) before pointing it at a real HR dataset.

### No conversation memory — every request is a single independent question

No session or thread id, no history sent on the next call. Each question is answered from a fresh system prompt plus whatever tool calls that one question needs, so a follow-up like "and what about Sales?" has no "compared to what" context from a prior turn. Accepted as a real limitation because multi-turn state (storage, expiry, per-user isolation) is a second feature's worth of complexity for a capability the brief marks optional and never asked for by name.

## Deliberately Excluded

- **Freeform SQL/code generation by the model** — every data access goes through the four fixed, already-tested tools; the model cannot construct a query.
- **Any write/mutation tool** — `create_employee`/`update_employee`/`deactivate_employee` are never exposed; the feature can only answer, never change data.
- **True token-level provider streaming** — superseded by chunking an already-complete answer string server-side; see Key Decisions.
- **Streaming or otherwise surfacing intermediate tool-call steps** — the negotiation phase is a black box to the frontend; only the final grounding summary and answer are ever sent.
- **Conversation memory / multi-turn chat** — one question, one answer, no history.
- **A department/country name-resolver tool** — handled by the embedded lookup table in the system prompt instead (see Key Decisions).
- **Caching/rate-limiting infrastructure** — the per-request iteration cap and input-length cap are enough for a single-HR-user tool; no Redis or similar.
- **Paid-tier fallback if the free tier rate-limits** — a throttled request fails with the `502` above; there's no automatic retry against a paid key.

## Subtasks

- [x] `app/config.py` — `gemini_api_key: str | None` field
- [x] `requirements.txt` — add Google's Gemini SDK dependency
- [x] `app/schemas/ai_query.py` — `AiQueryRequest`, `AiQueryStatusResponse`, `GroundingItem`
- [x] `app/services/ai_query_service.py` — tool schema + dispatch table, system-prompt builder (embeds department/country lookup), synchronous negotiation loop (`MAX_TOOL_ITERATIONS` cap) returning a complete answer + grounding + tests
- [x] `app/routers/ai_query.py` — `GET /ai-query/status`; `POST /ai-query` (runs negotiation, raises `422`/`503`/`502` on failure, then streams `grounding`/`chunk`/`error` SSE events) + tests

## Test Cases

All service/router tests stub the Gemini client (dependency-injected) — no test makes a real network call to Google's API, so the suite stays deterministic and runs in CI/grading with no `GEMINI_API_KEY` needed at all.

### `app/services/ai_query_service.py` (`tests/test_ai_query_service.py`)

| Test | Verifies |
|---|---|
| `test_dispatch_kpi_summary_tool_calls_service_with_parsed_filters` | Tool name + arguments dict correctly build an `EmployeeFilterParams` and call `kpi_service.get_kpi_summary` |
| `test_dispatch_search_employees_tool_caps_page_size` | A model-requested `page_size` above the cap is clamped before reaching `employee_service.list_employees` |
| `test_dispatch_unknown_tool_name_raises` | A tool name outside the fixed dispatch table is rejected rather than silently ignored |
| `test_negotiation_stops_at_max_iterations_with_fallback_answer` | A stubbed Gemini client that keeps requesting tool calls forever is cut off at `MAX_TOOL_ITERATIONS`, returning the fixed fallback answer instead of looping forever |
| `test_negotiation_returns_final_answer_and_grounding_in_call_order` | A stubbed Gemini client that requests one tool call then returns text produces a result with the answer text and `grounding` reflecting the one call made |
| `test_system_prompt_embeds_all_departments_and_countries` | Every department/country name and id from the DB appears in the generated system prompt |

### `app/routers/ai_query.py` (`tests/test_ai_query_api.py`)

| Test | Verifies |
|---|---|
| `test_status_reports_available_true_when_key_configured` | `GET /ai-query/status` returns `{"available": true}` when `GEMINI_API_KEY` is set (monkeypatched) |
| `test_status_reports_available_false_when_key_missing` | Same endpoint returns `{"available": false}` when unset |
| `test_ai_query_returns_503_when_key_missing` | `POST /ai-query` refuses with a plain `503` JSON response rather than attempting a call with no key |
| `test_ai_query_rejects_blank_or_overlong_question` | Empty string and a 501+ character string both return `422` |
| `test_ai_query_negotiation_failure_returns_502_json` | A stubbed Gemini client raising during negotiation (timeout/rate-limit) surfaces as a plain `502` JSON response, never an SSE stream, never the raw provider error text |
| `test_ai_query_streams_grounding_then_chunks_on_success` | On a successful negotiation, the SSE body contains exactly one `grounding` event first, followed by `chunk` events whose concatenated text equals the full answer |
| `test_ai_query_stream_emits_error_event_on_mid_stream_failure` | If something fails after the `grounding` event has already been sent, the stream emits an `error` event and closes cleanly rather than hanging or crashing the connection |
