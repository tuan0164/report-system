from sqlalchemy import (
    String,
    Date,
    Integer,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.orm import (
    Mapped,
    mapped_column,
)
from typing import Optional, List
from app.core.database import Base

class Report(Base):
    __tablename__ = "reports"
  
    __table_args__ = (
        UniqueConstraint("email", "report_date", name="uq_reports_email_date"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    email: Mapped[str] = mapped_column(String(255), nullable=False)

    report_date: Mapped[Date] = mapped_column(
        Date, nullable=False, server_default=func.current_date()
    )

    employee_code: Mapped[str] = mapped_column(String(100), nullable=False)

    full_name: Mapped[str] = mapped_column(String(255), nullable=False)

    project: Mapped[Optional[List[str]]] = mapped_column(
        ARRAY(String), nullable=True
    )

    extra_fields: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True, default=None)
