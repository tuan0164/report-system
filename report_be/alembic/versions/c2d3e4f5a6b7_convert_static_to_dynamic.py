"""convert business static fields to dynamic columns

Đăng ký các trường nghiệp vụ (planned_work_time, start_time, ... ) thành cột
động trong dynamic_column_defs. GIỮ NGUYÊN cột vật lý + dữ liệu trong bảng
reports (không DROP, không mất data). Dùng ON CONFLICT DO UPDATE để ghi đè
metadata rác cũ (label thô, type sai, field_order=99) sinh ra từ cơ chế
"ẩn trường cố định" trước đây; KHÔNG động vào is_active.

Revision ID: c2d3e4f5a6b7
Revises: b1f2a3c4d5e6
Create Date: 2026-07-04 09:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


revision: str = 'c2d3e4f5a6b7'
down_revision: Union[str, Sequence[str], None] = 'b1f2a3c4d5e6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# (name, label, data_type, field_order, hint)
FIELDS = [
    ("planned_work_time", "Thời gian làm việc dự định", "text", 10, "VD: 9:00 - 18:00"),
    ("start_time", "Bắt đầu", "time", 20, None),
    ("end_time", "Kết thúc", "time", 30, None),
    ("actual_hours", "Số giờ làm việc thực tế", "text", 40, "Tổng thời gian thực tế làm việc trong ngày"),
    ("work_summary", "Tóm tắt công việc", "textarea", 50, "Mô tả ngắn gọn công việc thực hiện trong ngày"),
    ("work_detail", "Nội dung chi tiết", "textarea", 60, "Viết chi tiết các công việc đã thực hiện"),
    ("difficulty", "Khó khăn gặp phải", "textarea", 70, None),
    ("proposal", "Đề xuất giải pháp", "textarea", 80, None),
    ("tomorrow_plan", "Dự định ngày mai", "textarea", 90, None),
]


def _q(val):
    """Trích dẫn literal an toàn cho SQL (escape dấu nháy đơn)."""
    if val is None:
        return "NULL"
    return "'" + str(val).replace("'", "''") + "'"


def upgrade() -> None:
    for name, label, data_type, order, hint in FIELDS:
        op.execute(
            "INSERT INTO dynamic_column_defs "
            "(name, label, data_type, required, field_order, hint, is_active) "
            f"VALUES ({_q(name)}, {_q(label)}, {_q(data_type)}, false, "
            f"{order}, {_q(hint)}, true) "
            "ON CONFLICT (name) DO UPDATE SET "
            "label = EXCLUDED.label, data_type = EXCLUDED.data_type, "
            "field_order = EXCLUDED.field_order, hint = EXCLUDED.hint"
        )


def downgrade() -> None:
    names = ", ".join(_q(f[0]) for f in FIELDS)
    op.execute(f"DELETE FROM dynamic_column_defs WHERE name IN ({names})")
