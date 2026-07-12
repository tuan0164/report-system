"""Ràng buộc 1 báo cáo/ngày/người: report_date NOT NULL + unique (email, report_date)

Trước đây các câu lệnh này chạy trong _ensure_report_day_constraints() ở
app/api/daily_report.py, ngay lúc import module, và bọc trong "except: pass".
Hậu quả: index unique KHÔNG BAO GIỜ được tạo (bảng đang có bản ghi trùng làm
nó fail), nhưng lỗi bị nuốt im lặng. create_report() lại dựa vào chính index
đó để bắt IntegrityError khi hai request vào cùng lúc -> lưới an toàn rỗng,
và bảng thật sự đã sinh ra bản ghi trùng do double-submit.

Đưa về migration: chạy đúng một lần, có thứ tự, và fail là báo lỗi rõ ràng.

Revision ID: f4a5b6c7d8e9
Revises: d3e4f5a6b7c8
Create Date: 2026-07-12

"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "f4a5b6c7d8e9"
down_revision: Union[str, Sequence[str], None] = "d3e4f5a6b7c8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Bản ghi cũ chưa có ngày -> gán ngày hôm nay, để đặt được NOT NULL.
    op.execute(
        'UPDATE "reports" SET "report_date" = CURRENT_DATE '
        'WHERE "report_date" IS NULL'
    )
    op.execute(
        'ALTER TABLE "reports" '
        'ALTER COLUMN "report_date" SET DEFAULT CURRENT_DATE'
    )
    op.execute(
        'ALTER TABLE "reports" ALTER COLUMN "report_date" SET NOT NULL'
    )

    # Nếu bảng còn cặp (email, report_date) trùng, lệnh này sẽ FAIL và cả
    # migration dừng lại. Đó là chủ ý: phải dọn trùng trước, không được
    # âm thầm bỏ qua như code cũ.
    op.execute(
        'CREATE UNIQUE INDEX IF NOT EXISTS uq_reports_email_date '
        'ON "reports" ("email", "report_date")'
    )


def downgrade() -> None:
    op.execute('DROP INDEX IF EXISTS uq_reports_email_date')
    op.execute('ALTER TABLE "reports" ALTER COLUMN "report_date" DROP NOT NULL')
    op.execute('ALTER TABLE "reports" ALTER COLUMN "report_date" DROP DEFAULT')
