from pydantic import BaseModel, field_validator
from typing import Optional
import re

IDENTIFIER_RE = re.compile(r"^[a-zA-Z][a-zA-Z0-9_]{0,62}$")

class DynamicColumnCreate(BaseModel):
    name: str
    label: str
    data_type: str
    required: bool = False
    field_order: int = 0
    hint: Optional[str] = None
    is_active: bool = True

    @field_validator("name")
    @classmethod
    def check_name(cls, v):
        if not IDENTIFIER_RE.match(v):
            raise ValueError("Tên cột không hợp lệ")
        return v

    @field_validator("data_type")
    @classmethod
    def check_type(cls, v):
        allowed = {"text", "textarea", "integer", "number", "boolean", "date", "time", "datetime", "array", "jsonb"}
        if v not in allowed:
            raise ValueError(f"Kiểu không hợp lệ. Cho phép: {allowed}")
        return v

class DynamicColumnUpdate(BaseModel):
    label: Optional[str] = None
    data_type: Optional[str] = None
    required: Optional[bool] = None
    field_order: Optional[int] = None
    hint: Optional[str] = None
    is_active: Optional[bool] = None

class DynamicColumnResponse(BaseModel):
    name: str
    label: str
    data_type: str
    required: bool
    field_order: int
    hint: Optional[str] = None
    is_active: bool = True

    class Config:
        from_attributes = True