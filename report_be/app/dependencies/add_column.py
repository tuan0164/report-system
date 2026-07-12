import logging
import re
from typing import Optional

from fastapi import HTTPException

from app.core.database import engine

logger = logging.getLogger(__name__)

# Trước đây file này tự mở một psycopg2 SimpleConnectionPool(1, 10) ngay lúc
# import. Hai vấn đề:
#   1. minconn=1 => nối DB ngay khi import module. DB chưa lên là app chết
#      lúc khởi động, chứ không phải lỗi ở request đầu tiên.
#   2. Pool đó không bao giờ tự nối lại. Postgres restart là mọi connection
#      trong pool thành xác chết, và run_sql lỗi vĩnh viễn.
# Giờ dùng chung pool của SQLAlchemy engine: nó có pool_pre_ping nên tự loại
# connection chết, và chỉ nối khi thật sự cần.

ALLOWED_TABLES = {"reports"}

ALLOWED_TYPES = {
    "text": "TEXT",
    "textarea": "TEXT",
    "integer": "INTEGER",
    "number": "NUMERIC",
    "boolean": "BOOLEAN",
    "date": "DATE",
    "time": "TIME",
    "datetime": "TIMESTAMP",
    "jsonb": "JSONB",
    "array": "TEXT[]",
}
PROTECTED_COLUMNS = {"id", "email", "employee_code", "full_name","report_date","project"}

STATIC_FIELDS = {
    "id", "email", "report_date", "employee_code", "full_name", "project",
    "extra_fields",
}
IDENTIFIER_RE = re.compile(r"^[a-zA-Z][a-zA-Z0-9_]{0,62}$")

def validate_identifier(name: str, label: str = "Tên"):
    if not IDENTIFIER_RE.match(name):
        raise HTTPException(
            status_code=400,
            detail=f"{label} '{name}' không hợp lệ. Chỉ cho phép chữ, số, dấu gạch dưới, bắt đầu bằng chữ.",
        )


def validate_table(table: str):
    if table not in ALLOWED_TABLES:
        raise HTTPException(
            status_code=403, detail=f"Bảng '{table}' không được phép chỉnh sửa."
        )


def validate_type(data_type: str) -> str:
    pg_type = ALLOWED_TYPES.get(data_type)
    if not pg_type:
        raise HTTPException(
            status_code=400,
            detail=f"Kiểu dữ liệu '{data_type}' không hợp lệ. Cho phép: {list(ALLOWED_TYPES.keys())}",
        )
    return pg_type


def run_sql(sql: str, params: tuple = None, fetch: bool = False):
    # raw_connection() lấy connection psycopg2 từ pool của SQLAlchemy, nên
    # cú pháp %s và cursor giữ nguyên như cũ. close() trả nó về pool.
    conn = engine.raw_connection()
    try:
        cur = conn.cursor()
        cur.execute(sql, params)
        result = cur.fetchall() if fetch else None
        columns = [desc[0] for desc in cur.description] if fetch else None
        conn.commit()
        cur.close()
        if fetch:
            return [dict(zip(columns, row)) for row in result]
        return None
    except Exception:
        conn.rollback()
        # Lỗi Postgres thô lộ tên bảng, tên cột, ràng buộc -> phơi cấu trúc DB
        # cho người lạ. Ghi đầy đủ vào log server, trả về câu chung chung.
        logger.exception("Lỗi SQL: %s", sql)
        raise HTTPException(status_code=400, detail="Thao tác với cơ sở dữ liệu thất bại")
    finally:
        conn.close()


def log_audit(action: str, table: str, column: Optional[str], detail: str = "", performed_by: str = "ADMIN"):
    run_sql(
        """INSERT INTO schema_audit_log (action, table_name, column_name, detail, performed_by)
           VALUES (%s, %s, %s, %s, %s)""",
        (action, table, column, detail, performed_by),
    )
def validate_column_protected(column: str):
    if column in PROTECTED_COLUMNS:
        raise HTTPException(403, f"Cột '{column}' là cột hệ thống, không được phép xóa/đổi tên.")
