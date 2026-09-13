from __future__ import annotations

import asyncio
import json
from collections.abc import AsyncIterator

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from google import genai
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.schemas.ai_query import AiQueryRequest, AiQueryStatusResponse, GroundingItem
from app.services import ai_query_service

router = APIRouter(tags=["ai-query"])

_CHUNK_WORD_GROUP_SIZE = 3
_CHUNK_DELAY_SECONDS = 0.05

# Aliased so a test can patch just this module's pacing delay, without touching the real
# asyncio.sleep that the test client's own event loop relies on.
_sleep = asyncio.sleep


def get_gemini_client() -> genai.Client | None:
    if settings.gemini_api_key is None:
        return None
    return genai.Client(api_key=settings.gemini_api_key)


@router.get("/ai-query/status", response_model=AiQueryStatusResponse)
def get_ai_query_status() -> AiQueryStatusResponse:
    return AiQueryStatusResponse(available=settings.gemini_api_key is not None)


def _chunk_answer(text: str, group_size: int = _CHUNK_WORD_GROUP_SIZE) -> list[str]:
    """Splits into word-groups whose trailing space is kept in the chunk itself.

    This means plain concatenation of the returned chunks (no separator needed) reproduces
    `text` exactly - the frontend, and tests, can just append chunk text as it arrives.
    """
    words = text.split(" ")
    groups = [words[i : i + group_size] for i in range(0, len(words), group_size)]
    chunks = []
    for index, group in enumerate(groups):
        piece = " ".join(group)
        if index < len(groups) - 1:
            piece += " "
        chunks.append(piece)
    return chunks


def _sse_event(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


async def _stream_answer(result: ai_query_service.NegotiationResult) -> AsyncIterator[str]:
    grounding = [GroundingItem(tool=g.tool, arguments=g.arguments).model_dump(mode="json") for g in result.grounding]
    yield _sse_event("grounding", {"grounding": grounding})

    try:
        for chunk in _chunk_answer(result.answer):
            yield _sse_event("chunk", {"text": chunk})
            await _sleep(_CHUNK_DELAY_SECONDS)
    except Exception:
        yield _sse_event("error", {"detail": "AI query is temporarily unavailable"})


@router.post("/ai-query")
def ask_ai_query(
    request: AiQueryRequest,
    db: Session = Depends(get_db),
    client: genai.Client | None = Depends(get_gemini_client),
) -> StreamingResponse:
    if client is None:
        raise HTTPException(status_code=503, detail="AI query is not configured")

    try:
        result = ai_query_service.run_negotiation(client, db, request.question)
    except Exception as error:
        raise HTTPException(status_code=502, detail="AI query is temporarily unavailable") from error

    return StreamingResponse(_stream_answer(result), media_type="text/event-stream")
