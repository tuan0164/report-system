"""fix extra_fields column type text -> jsonb

Cột reports.extra_fields bị tạo nhầm kiểu TEXT trong khi model khai JSONB.
Hậu quả: SQLAlchemy serialize None -> JSON 'null' -> ghi vào cột TEXT thành
CHUỖI "null". Khi đọc lại trả string "null", schema ReportResponse
(extra_fields: Optional[dict]) reject -> ResponseValidationError 500 dù data
đã insert (lỗi ở tầng serialize, sau commit).

Sửa: đổi cột sang JSONB, convert 'null'/'' -> NULL (jsonb null đọc ra None).
Không mất data thật (mọi giá trị hiện tại đều là 'null').

Revision ID: d3e4f5a6b7c8
Revises: c2d3e4f5a6b7
Create Date: 2026-07-04 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


revision: str = 'd3e4f5a6b7c8'
down_revision: Union[str, Sequence[str], None] = 'c2d3e4f5a6b7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        'ALTER TABLE "reports" ALTER COLUMN "extra_fields" TYPE JSONB '
        "USING (CASE WHEN \"extra_fields\" IS NULL "
        "OR \"extra_fields\" IN ('', 'null') THEN NULL "
        "ELSE \"extra_fields\"::jsonb END)"
    )


def downgrade() -> None:
    op.execute(
        'ALTER TABLE "reports" ALTER COLUMN "extra_fields" TYPE TEXT '
        'USING "extra_fields"::text'
    )
