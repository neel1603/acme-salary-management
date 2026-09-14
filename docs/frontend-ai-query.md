# Frontend AI Query

## Purpose

Builds the UI for `docs/ai-query-api.md`'s backend: a question box that streams a natural-language answer plus its grounding (which tool, which arguments) back to the HR user. Per that doc's own Purpose line, this sits *alongside* the KPI dashboard as a second way to get an answer, not a replacement for it — so it's a card on `DashboardPage`, not a new route.

The endpoint returns Server-Sent Events over a `POST`, which `EventSource` can't do (GET-only). Native `fetch()` + `ReadableStream` handles that with zero new dependencies — the same "keep this on the logic, not the plumbing" call the backend doc made for its own streaming.

## Stack

No new npm dependency. Everything needed — `fetch`, `ReadableStream`, `TextDecoder`, `AbortController` — is a browser primitive already available in the stack `frontend-foundation.md` set up.

## Key Decisions

### A card on `DashboardPage`, not a new route

`docs/ai-query-api.md` frames this as sitting alongside the dashboard, not replacing it. A separate `/ai-query` page (and nav link) would bury a "quick question" tool behind a click a spreadsheet-habituated HR user has no reason to take. `AiQueryBox` renders directly on `DashboardPage`, gated on availability (below).

### `streamAiQuery` is its own function, not a third shape bolted onto `apiFetch`/`apiMutate`

Both existing client functions end in `response.json()` via `handleResponse`. This endpoint's success response isn't JSON at all — it's a byte stream — while its *failure* responses (`422`/`503`/`502`) are plain JSON, exactly like every other endpoint. `streamAiQuery(question, {onGrounding, onChunk, onError, signal})` in `src/api/aiQuery.js` checks `response.ok` first and reuses the same `detail`-extraction shape as `handleResponse` for the failure case, then switches to reading `response.body` only once it knows the negotiation succeeded — same two-phase split the backend itself documents.

### SSE frame parsing is a pure function, tested with zero network involved

`src/lib/sse.js` exports `parseSseEvents(buffer)`, taking accumulated decoded text and returning `{events, remainder}`. `streamAiQuery` owns the loop (`reader.read()` → decode → append to buffer → parse → dispatch parsed events to callbacks → keep the remainder for the next read); the parsing logic itself takes a string and returns data, no `fetch`, no `ReadableStream`, no async involved. This mirrors the backend's own `_sse_event`/test-helper split — production code and tests both get to reason about framing without also reasoning about I/O. It's also the only piece of this feature with real edge-case risk: a TCP-level read can land in the middle of a frame, and the parser has to hold the incomplete tail in `remainder` rather than dropping or misparsing it.

### `useAiQuery` is a hand-rolled hook, not a TanStack Query mutation

A streamed, incrementally-updating answer with no cache key worth keeping around (see "no conversation memory" below) doesn't fit `useQuery`/`useMutation`'s request-in/response-out model — there's nothing to cache, and the whole point is pushing partial state (`answer` growing chunk by chunk) as it arrives, not resolving once. `src/hooks/useAiQuery.js` holds `{status, answer, grounding, errorMessage}` in plain `useState` and exposes `ask(question)`, the same "hand-roll it, it's ~30 lines" call already made for `useDebouncedValue`.

`status` is one of `'idle' | 'pending' | 'done' | 'error'`. Deliberately *not* split into a separate "waiting for the backend's negotiation" vs. "receiving chunks" state — the backend doc is explicit that the whole negotiation phase is a black box to the frontend, so the UI only ever knows "asked, nothing back yet" vs. "some answer text exists," which the component derives from `status === 'pending' && answer === ''` rather than the hook tracking a phase it has no real information about.

### Every `ask()` aborts whatever came before it — no two streams race

`ask()` creates a new `AbortController`, aborting the previous one (if `status` was still `'pending'`) before starting. Without this, asking a second question while the first is still streaming would let both fetches write into the same `answer` state, interleaving two unrelated answers. The hook's cleanup effect also aborts on unmount, so navigating away from the dashboard mid-stream doesn't try to `setState` on an unmounted component.

### A mid-stream `error` event appends, it doesn't wipe

If the rare post-`grounding` failure the backend doc calls out actually happens, whatever answer text had already streamed stays on screen; the error message renders as an inline note below it rather than clearing the partial answer. A partially-delivered answer is still more useful to discard than to throw away over a failure that happened after the useful part already arrived.

### Grounding is shown raw — tool name and arguments, no id→name resolution

`GroundingItem` gives `{tool: "get_kpi_summary", arguments: {department_id: 3}}`. Resolving `department_id`/`country_id` back to a name via `useLookups` would read nicer, but it's a second data dependency and a small mapping function for a display-polish gain on a stretch feature's own stretch — cut here, see Deliberately Excluded.

### No conversation memory, client side either

Matches the backend's own "every request is a single independent question" decision. `ask()` always starts from a blank `answer`/`grounding` — there's no history array, no way to scroll back to a previous question's answer. Asking a new question simply replaces the last one on screen.

### Client-side 500-character cap is a UX nicety, not the source of truth

The `<input>` gets `maxLength={500}`, so a user can't even type past the backend's own cap — but the backend's `AiQueryRequest` validation is what actually enforces it; a `422` is still handled like any other error path rather than assumed unreachable.

## Data Flow

`AiQueryBox` calls `useAiQueryStatus()` (a one-line `useQuery` wrapper around `fetchAiQueryStatus`, same shape as `useKpiSummary`). While that query is loading or resolves `available: false`, the component renders nothing — no placeholder, no disabled ghost of the box, since a feature that isn't there shouldn't announce that it isn't there.

Once available, the box renders a `<form>` wrapping the input + Ask button, so both Enter and a button click submit the same way. Submitting calls `useAiQuery()`'s `ask(question)`; the box just reads `{status, answer, grounding, errorMessage}` back and renders: the input/button disabled while `status === 'pending'`, "Thinking…" while pending with no answer text yet, the growing `answer` text once chunks start arriving, the grounding list once `status === 'done'`, and `errorMessage` inline (alongside any partial `answer`) on `status === 'error'`.

## Deliberately Excluded

- **A dedicated `/ai-query` route or nav link** — embedded on `DashboardPage` instead, per the backend doc's own "sitting alongside" framing.
- **Grounding id→name resolution** — shown as raw `tool(arguments)`; a real but cheap-to-add-later enhancement, cut for scope here.
- **Conversation memory / follow-up questions** — mirrors the backend's own no-memory decision; every `ask()` starts fresh.
- **Markdown/rich-text rendering of the answer** — plain text only; no markdown-parsing dependency for a stretch feature's stretch feature.
- **Copy / share / export of an answer** — not asked for, no evidence of need.
- **A retry button on error** — matches the rest of the app's existing "no retry button, resubmit instead" convention (dashboard charts, KPI cards).
- **Extra typing-animation flourishes (blinking cursor, etc.)** — the incremental chunk reveal already reads as "typing"; nothing added on top.

## Subtasks

- [x] `src/lib/sse.js`: `parseSseEvents(buffer)`
- [x] `src/lib/queryKeys.js`: add `aiQuery.status()`
- [x] `src/api/client.js`: export `BASE_URL`; extract `extractErrorDetail` out of `handleResponse` so `streamAiQuery` can reuse it
- [x] `src/api/aiQuery.js`: `fetchAiQueryStatus`, `streamAiQuery`
- [x] `src/hooks/useAiQueryStatus.js`
- [x] `src/hooks/useAiQuery.js`
- [x] `src/components/dashboard/AiQueryBox.jsx`
- [x] Wire into `src/pages/DashboardPage.jsx`; extend `DashboardPage.test.jsx`'s hook mocks to cover it
- [x] Tests (see Test Cases)

## Test Cases

### `src/lib/sse.js` (`sse.test.js`)

| Test | Verifies |
|---|---|
| `parses a single well-formed frame` | One `event`/`data` block returns one parsed event and an empty remainder |
| `parses multiple frames in one buffer, in order` | Two back-to-back frames return two events in the order they appeared |
| `holds a frame split across two reads` | A buffer ending mid-frame returns zero events and a non-empty remainder; feeding `remainder + nextChunk` back in then yields the event |
| `skips malformed JSON in a data line` | A frame whose `data:` line isn't valid JSON is dropped, not thrown, and parsing continues with the next frame |
| `ignores an unrecognized event type` | A frame whose `event:` value isn't `grounding`/`chunk`/`error` is dropped rather than surfaced, for forward compatibility |

### `src/api/aiQuery.js` (`aiQuery.test.js`)

| Test | Verifies |
|---|---|
| `fetchAiQueryStatus maps the wire response` | `{available: true/false}` passes through as-is |
| `streamAiQuery calls onGrounding before any onChunk` | The `grounding` event's callback always fires first |
| `streamAiQuery calls onChunk once per chunk event, in order` | Chunk text arrives via `onChunk` in stream order, unmodified |
| `a non-2xx initial response calls onError and never reads a stream` | `503`/`422`/`502` bodies are parsed as plain JSON `detail`, `onChunk`/`onGrounding` never fire |
| `a mid-stream error event calls onError without another onChunk` | An `error` SSE event stops further chunk delivery and surfaces its `detail` |
| `aborting the given signal stops reading without throwing` | An aborted `AbortController` ends the read loop cleanly, no unhandled rejection |

### `src/hooks/useAiQuery.js` (`useAiQuery.test.js`)

| Test | Verifies |
|---|---|
| `ask() goes idle -> pending -> done with the final answer/grounding` | Normal success path's full state progression |
| `a second ask() aborts the first` | Calling `ask()` again while `status === 'pending'` cancels the previous stream and resets state before starting the new one |
| `an initial error sets status to error with an empty answer` | `503`/`422`/`502` path leaves `answer` blank, `errorMessage` set |
| `a mid-stream error sets status to error but keeps the partial answer` | Whatever had already accumulated in `answer` survives a later `error` event |
| `unmounting while pending aborts the in-flight request` | No state update attempted after unmount |

### `src/components/dashboard/AiQueryBox.jsx` (`AiQueryBox.test.jsx`)

| Test | Verifies |
|---|---|
| `renders nothing while unavailable or loading` | No input/button shown until `useAiQueryStatus` resolves `available: true` |
| `submitting calls ask with the trimmed question` | Form submit (button click or Enter) passes the input's value to `ask` |
| `input and button are disabled while pending` | No double-submit possible mid-stream |
| `shows "Thinking…" only until the first chunk arrives` | Pending-with-no-text vs. pending-with-partial-text render differently |
| `renders the grounding list once done` | Each `{tool, arguments}` entry appears once `status === 'done'` |
| `renders an inline error without clearing a partial answer` | `status === 'error'` shows `errorMessage` alongside whatever `answer` text already rendered |

### `src/pages/DashboardPage.test.jsx` (extends existing)

| Test | Verifies |
|---|---|
| `renders AiQueryBox alongside the existing dashboard sections` | Adding the new hook mocks doesn't break the page's existing filter/KPI/chart assertions |

Deliberately not tested: `useAiQueryStatus` in isolation (thin `useQuery` wrapper, same convention as `useKpiSummary`); shadcn primitives used inside `AiQueryBox` (vendored).

## Verification

1. `npm run test:run` — all green.
2. `npm run build`.
3. End-to-end against the real backend:
   - With `GEMINI_API_KEY` unset: confirm the box does not render on the dashboard at all.
   - With a real free-tier key set: ask a real question (e.g. "what's the average salary in Engineering?"), confirm the answer streams in progressively, and the grounding line shows the tool call actually made.
   - Ask something outside the schema (e.g. "who's overdue for a performance review?") and confirm the model declines rather than guessing, per `ai-query-api.md`'s own system-prompt decision.
