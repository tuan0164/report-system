from pydantic import BaseModel
from typing import Optional


class FieldOptionCreate(BaseModel):
    column_name: str
    value: str
    field_order: int = 0
    is_active: bool = True


class FieldOptionUpdate(BaseModel):
    value: Optional[str] = None
    field_order: Optional[int] = None
    is_active: Optional[bool] = None


class FieldOptionResponse(BaseModel):
    id: int
    column_name: str
    value: str
    field_order: int
    is_active: bool

    class Config:
        from_attributes = True
