from pydantic import BaseModel, Field
from typing import Optional

class UserUpdate(BaseModel):
    full_name: Optional[str] = Field(
        None,
        min_length=1,
        max_length=255
    )
class UserResponse(BaseModel):

    id: int

    email: str

    full_name: str

    role: str

    is_active: bool = True

    employee_code: Optional[str] = None

    report_full_name: Optional[str] = None

    class Config:
        from_attributes = True