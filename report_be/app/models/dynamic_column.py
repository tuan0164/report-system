from sqlalchemy import Integer, Boolean, DateTime, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column
from typing import Optional
from app.core.database import Base

class DynamicColumnDef(Base):
    __tablename__ = "dynamic_column_defs"

    name: Mapped[str] = mapped_column(String(100), primary_key=True)
    label: Mapped[str] = mapped_column(String(255), nullable=False)
    data_type: Mapped[str] = mapped_column(String(50), nullable=False)
    required: Mapped[bool] = mapped_column(Boolean, default=False)
    field_order: Mapped[int] = mapped_column(Integer, default=0)
    hint: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[DateTime] = mapped_column(DateTime, server_default=func.now())