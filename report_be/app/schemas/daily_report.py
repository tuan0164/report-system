from pydantic import BaseModel, ConfigDict
from typing import Optional, List, Dict, Any
from datetime import date


class ReportCreate(BaseModel):
    
    model_config = ConfigDict(extra="allow")

    report_date: Optional[date] = None
    employee_code: str
    full_name: str
    project: Optional[List[str]] = None
    extra_fields: Optional[Dict[str, Any]] = None


class ReportResponse(ReportCreate):
    id: int
    email: str

    class Config:
        from_attributes = True
