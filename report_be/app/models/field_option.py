from sqlalchemy import Integer, String, Boolean, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


class FieldOption(Base):
    
    __tablename__ = "field_options"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    column_name: Mapped[str] = mapped_column(String(100), nullable=False, index=True)

    value: Mapped[str] = mapped_column(String(255), nullable=False)

    field_order: Mapped[int] = mapped_column(Integer, default=0)

    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    created_at: Mapped[DateTime] = mapped_column(DateTime, server_default=func.now())
