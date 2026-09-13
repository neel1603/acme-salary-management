from __future__ import annotations

import dataclasses
import json

from google.genai import types

from app.config import settings
from app.main import app as fastapi_app
from app.routers import ai_query as ai_query_router


class _FakeModels:
    def __init__(self, response=None, error=None):
        self._response = response
        self._error = error

    def generate_content(self, *, model, contents, config):
        if self._error is not None:
            raise self._error
        return self._response


class _FakeClient:
    def __init__(self, response=None, error=None):
        self.models = _FakeModels(response=response, error=error)


class _UnusedModels:
    def generate_content(self, *, model, contents, config):
        raise AssertionError("generate_content should not have been called")


class _UnusedClient:
    """A fake client whose use would fail a test, for proving a code path never calls it."""

    def __init__(self):
        self.models = _UnusedModels()


def _text_response(text: str) -> types.GenerateContentResponse:
    return types.GenerateContentResponse(
        candidates=[types.Candidate(content=types.Content(role="model", parts=[types.Part.from_text(text=text)]))]
    )


def _with_gemini_key(monkeypatch, key: str | None) -> None:
    monkeypatch.setattr(ai_query_router, "settings", dataclasses.replace(settings, gemini_api_key=key))


def _override_gemini_client(fake_client) -> None:
    fastapi_app.dependency_overrides[ai_query_router.get_gemini_client] = lambda: fake_client


def _fake_sleep_that_fails_after(allowed_calls: int):
    state = {"count": 0}

    async def _sleep(_seconds: float) -> None:
        state["count"] += 1
        if state["count"] > allowed_calls:
            raise RuntimeError("connection dropped")

    return _sleep


def _parse_sse_events(body: str) -> list[tuple[str, dict]]:
    events = []
    for block in body.strip().split("\n\n"):
        event_line, data_line = block.splitlines()
        events.append((event_line.removeprefix("event: "), json.loads(data_line.removeprefix("data: "))))
    return events


def test_status_reports_available_true_when_key_configured(client, monkeypatch):
    _with_gemini_key(monkeypatch, "fake-key")

    response = client.get("/api/v1/ai-query/status")

    assert response.status_code == 200
    assert response.json() == {"available": True}


def test_status_reports_available_false_when_key_missing(client, monkeypatch):
    _with_gemini_key(monkeypatch, None)

    response = client.get("/api/v1/ai-query/status")

    assert response.status_code == 200
    assert response.json() == {"available": False}


def test_ai_query_returns_503_when_key_missing(client, monkeypatch):
    _with_gemini_key(monkeypatch, None)

    response = client.post("/api/v1/ai-query", json={"question": "how many employees are there?"})

    assert response.status_code == 503
    assert response.json() == {"detail": "AI query is not configured"}


def test_ai_query_rejects_blank_or_overlong_question(client, monkeypatch):
    _with_gemini_key(monkeypatch, "fake-key")
    _override_gemini_client(_UnusedClient())

    blank_response = client.post("/api/v1/ai-query", json={"question": ""})
    overlong_response = client.post("/api/v1/ai-query", json={"question": "x" * 501})

    assert blank_response.status_code == 422
    assert overlong_response.status_code == 422


def test_ai_query_negotiation_failure_returns_502_json(client, monkeypatch):
    _with_gemini_key(monkeypatch, "fake-key")
    _override_gemini_client(_FakeClient(error=RuntimeError("upstream boom")))

    response = client.post("/api/v1/ai-query", json={"question": "how many employees are there?"})

    assert response.status_code == 502
    assert response.json() == {"detail": "AI query is temporarily unavailable"}


def test_ai_query_streams_grounding_then_chunks_on_success(client, monkeypatch):
    _with_gemini_key(monkeypatch, "fake-key")
    answer = "There are twelve employees across Engineering and Sales today"
    _override_gemini_client(_FakeClient(response=_text_response(answer)))

    response = client.post("/api/v1/ai-query", json={"question": "how many employees are there?"})

    assert response.status_code == 200
    events = _parse_sse_events(response.text)
    assert events[0] == ("grounding", {"grounding": []})
    chunk_events = events[1:]
    assert all(event_type == "chunk" for event_type, _ in chunk_events)
    assert "".join(data["text"] for _, data in chunk_events) == answer


def test_ai_query_stream_emits_error_event_on_mid_stream_failure(client, monkeypatch):
    _with_gemini_key(monkeypatch, "fake-key")
    answer = "There are twelve employees across Engineering and Sales today"
    _override_gemini_client(_FakeClient(response=_text_response(answer)))
    monkeypatch.setattr(ai_query_router, "_sleep", _fake_sleep_that_fails_after(1))

    response = client.post("/api/v1/ai-query", json={"question": "how many employees are there?"})

    assert response.status_code == 200
    events = _parse_sse_events(response.text)
    assert events[0][0] == "grounding"
    assert events[-1] == ("error", {"detail": "AI query is temporarily unavailable"})
    assert all(event_type == "chunk" for event_type, _ in events[1:-1])
