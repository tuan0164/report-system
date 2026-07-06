from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.dependencies.auth import require_admin, get_current_user
from app.dependencies.add_column import (
    run_sql, validate_type, log_audit, PROTECTED_COLUMNS, STATIC_FIELDS
)
from app.models.dynamic_column import DynamicColumnDef
from app.schemas.dynamic_column import (
    DynamicColumnCreate, DynamicColumnUpdate, DynamicColumnResponse
)

router = APIRouter(prefix="/dynamic-columns", tags=["DynamicColumns"])

FIXED_COLS = {"id", "email", "full_name", "employee_code","project", "report_date"

}


@router.get("/", response_model=list[DynamicColumnResponse])
def list_dynamic_columns(
    all: bool = Query(False, description="Admin: hiển thị cả cột bị ẩn"),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """List cột động, sắp xếp theo field_order. Mặc định chỉ hiện cột active."""
    query = db.query(DynamicColumnDef)
    if not all:
        query = query.filter(
            DynamicColumnDef.is_active == True,
            DynamicColumnDef.name.notin_(STATIC_FIELDS),
        )
    return query.order_by(DynamicColumnDef.field_order, DynamicColumnDef.name).all()


@router.post("/", response_model=DynamicColumnResponse)
def add_dynamic_column(
    body: DynamicColumnCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_admin)
):
    """Thêm định nghĩa cột + ALTER TABLE ADD COLUMN (nếu cột chưa tồn tại)"""
    if body.name in STATIC_FIELDS:
        raise HTTPException(
            400, f"'{body.name}' là trường cố định, không thể tạo cột động"
        )

    existing = db.query(DynamicColumnDef).filter(
        DynamicColumnDef.name == body.name
    ).first()
    if existing:
        raise HTTPException(400, f"Định nghĩa cột '{body.name}' đã tồn tại")

    col_check = run_sql(
        """SELECT column_name FROM information_schema.columns
           WHERE table_name = 'reports' AND column_name = %s""",
        (body.name,), fetch=True
    )
    column_exists = len(col_check) > 0

    if column_exists:
        pass
    else:
        if body.name in FIXED_COLS or body.name in PROTECTED_COLUMNS:
            raise HTTPException(403, f"Tên '{body.name}' trùng cột hệ thống")
        pg_type = validate_type(body.data_type)
        nullable_str = "" if body.required else " NULL"
        run_sql(
            f'ALTER TABLE "reports" ADD COLUMN "{body.name}" {pg_type}{nullable_str}'
        )

    col_def = DynamicColumnDef(
        name=body.name,
        label=body.label,
        data_type=body.data_type,
        required=body.required,
        field_order=body.field_order,
        hint=body.hint,
        is_active=body.is_active,
    )
    db.add(col_def)
    db.commit()
    db.refresh(col_def)

    log_audit("ADD_DYNAMIC_COLUMN", "reports", body.name,
              f"label={body.label}, type={body.data_type}")

    return col_def


@router.patch("/{name}", response_model=DynamicColumnResponse)
def update_dynamic_column(
    name: str,
    body: DynamicColumnUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_admin)
):
    """Sửa label, type, required, order, hint"""
    col_def = db.query(DynamicColumnDef).filter(
        DynamicColumnDef.name == name
    ).first()
    if not col_def:
        if name in STATIC_FIELDS:
            col_def = DynamicColumnDef(
                name=name, label=name, data_type="text",
                required=False, field_order=0, is_active=True,
            )
            db.add(col_def)
        else:
            raise HTTPException(404, f"Không tìm thấy cột '{name}'")

    update_data = body.model_dump(exclude_unset=True)

    update_data.pop("data_type", None)

    for key, value in update_data.items():
        setattr(col_def, key, value)

    db.commit()
    db.refresh(col_def)

    log_audit("UPDATE_DYNAMIC_COLUMN", "reports", name, str(update_data))
    return col_def


@router.delete("/{name}")
def delete_dynamic_column(
    name: str,
    db: Session = Depends(get_db),
    current_user=Depends(require_admin)
):
    """Xóa định nghĩa + ALTER TABLE DROP COLUMN"""
    if name in STATIC_FIELDS:
        raise HTTPException(403, f"'{name}' là trường cố định, không thể xóa")

    col_def = db.query(DynamicColumnDef).filter(
        DynamicColumnDef.name == name
    ).first()
    if not col_def:
        raise HTTPException(404, f"Không tìm thấy cột '{name}'")
    run_sql(f'ALTER TABLE "reports" DROP COLUMN "{name}"')
    db.delete(col_def)
    db.commit()

    log_audit("DROP_DYNAMIC_COLUMN", "reports", name)
    return {"success": True, "message": f"Đã xóa cột '{name}'"}