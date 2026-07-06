from sqlalchemy import (
    BigInteger,
    DateTime,
    String,
    Text,
    func
)
from typing import Optional
from sqlalchemy.orm import (
    Mapped,
    mapped_column
)
from app.core.database import Base


class SchemaAuditLog(Base):
    __tablename__ = "schema_audit_log"

    id: Mapped[int] = mapped_column(
        BigInteger,
        primary_key=True,
        index=True
    )

    action: Mapped[str] = mapped_column(
        String(50),
        nullable=False
    )

    table_name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        index=True
    )

    column_name: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True
    )

    detail: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True
    )

    performed_by: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True
    )

    created_at: Mapped[DateTime] = mapped_column(
        DateTime,
        server_default=func.now()
    )