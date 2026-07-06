from fastapi import HTTPException
import re
from psycopg2 import pool
from typing import Optional
from app.core.config import settings
DATABASE_URL = settings.DATABASE_URL

connection_pool = pool.SimpleConnectionPool(1, 10, dsn=DATABASE_URL)

def get_connection():
    return connection_pool.getconn()


def release_connection(conn):
    connection_pool.putconn(conn)

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
    conn = get_connection()
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
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        release_connection(conn)


def log_audit(action: str, table: str, column: Optional[str], detail: str = "", performed_by: str = "ADMIN"):
    run_sql(
        """INSERT INTO schema_audit_log (action, table_name, column_name, detail, performed_by)
           VALUES (%s, %s, %s, %s, %s)""",
        (action, table, column, detail, performed_by),
    )
def validate_column_protected(column: str):
    if column in PROTECTED_COLUMNS:
        raise HTTPException(403, f"Cột '{column}' là cột hệ thống, không được phép xóa/đổi tên.")
