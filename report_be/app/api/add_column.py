from fastapi import APIRouter, Depends
from app.dependencies.add_column import validate_identifier, validate_table, run_sql, log_audit, validate_column_protected
from app.dependencies.auth import require_admin

router = APIRouter(
    prefix="/add_column",
    tags=["add_column"]
)


@router.get("/tables/{table}/columns")
def list_columns(table: str, current_user=Depends(require_admin)):
    validate_table(table)
    rows = run_sql(
        """SELECT column_name, data_type, is_nullable, column_default
           FROM information_schema.columns
           WHERE table_name = %s
           ORDER BY ordinal_position""",
        (table,),
        fetch=True,
    )
    return rows


@router.delete("/tables/{table}/columns/{column}")
def drop_column(table: str, column: str,current_user=Depends(require_admin)):
    validate_table(table)
    validate_identifier(column, "Tên cột")
    validate_column_protected(column)

    run_sql(f'ALTER TABLE "{table}" DROP COLUMN "{column}"')
    log_audit("DROP_COLUMN", table, column)
    return {"success": True, "message": f"Đã xóa cột '{column}' khỏi bảng '{table}'"}


@router.get("/audit-log")
def get_audit_log(current_user=Depends(require_admin)):
    return run_sql(
        "SELECT * FROM schema_audit_log ORDER BY created_at DESC LIMIT 50",
        fetch=True,
    )
