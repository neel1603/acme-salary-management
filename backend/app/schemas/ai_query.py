from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class AiQueryRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    question: str = Field(min_length=1, max_length=500)


class AiQueryStatusResponse(BaseModel):
    available: bool


class GroundingItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    tool: str
    arguments: dict[str, Any]
