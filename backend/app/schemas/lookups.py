from __future__ import annotations

from pydantic import BaseModel, ConfigDict


class CountryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    code: str
    name: str
    currency_code: str


class DepartmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
