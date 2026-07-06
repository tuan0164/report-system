from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional

from app.core.database import get_db
from app.dependencies.auth import get_current_user, require_admin
from app.models.field_option import FieldOption
from app.models.dynamic_column import DynamicColumnDef
from app.schemas.field_option import (
    FieldOptionCreate, FieldOptionUpdate, FieldOptionResponse
)

router = APIRouter(prefix="/field-options", tags=["FieldOptions"])

STATIC_ARRAY_FIELDS = {"project"}

def _ensure_array_column(name: str, db: Session):
    """Chỉ cho gắn option vào trường kiểu array (project hoặc cột động array)."""
    if name in STATIC_ARRAY_FIELDS:
        return
    col = db.query(DynamicColumnDef).filter(DynamicColumnDef.name == name).first()
    if not col or col.data_type != "array":
        raise HTTPException(
            400, f"Cột '{name}' không phải kiểu array, không thể gắn danh sách chọn"
        )

@router.get("/", response_model=list[FieldOptionResponse])
def list_field_options(
    column_name: Optional[str] = Query(None, description="Lọc theo cột"),
    all: bool = Query(False, description="Admin: hiện cả option bị ẩn"),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """List option. Mặc định chỉ option đang hiện; admin dùng all=True để xem hết."""
    query = db.query(FieldOption)
    if column_name:
        query = query.filter(FieldOption.column_name == column_name)
    if not all:
        query = query.filter(FieldOption.is_active == True)
    return query.order_by(FieldOption.column_name, FieldOption.field_order, FieldOption.id).all()


@router.post("/", response_model=FieldOptionResponse)
def create_field_option(
    body: FieldOptionCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_admin),
):
    _ensure_array_column(body.column_name, db)

    dup = db.query(FieldOption).filter(
        FieldOption.column_name == body.column_name,
        FieldOption.value == body.value,
    ).first()
    if dup:
        raise HTTPException(400, f"Giá trị '{body.value}' đã tồn tại trong cột '{body.column_name}'")

    opt = FieldOption(
        column_name=body.column_name,
        value=body.value,
        field_order=body.field_order,
        is_active=body.is_active,
    )
    db.add(opt)
    db.commit()
    db.refresh(opt)
    return opt


@router.patch("/{option_id}", response_model=FieldOptionResponse)
def update_field_option(
    option_id: int,
    body: FieldOptionUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_admin),
):
    opt = db.query(FieldOption).filter(FieldOption.id == option_id).first()
    if not opt:
        raise HTTPException(404, "Không tìm thấy option")

    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(opt, key, value)

    db.commit()
    db.refresh(opt)
    return opt


@router.delete("/{option_id}")
def delete_field_option(
    option_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_admin),
):
    opt = db.query(FieldOption).filter(FieldOption.id == option_id).first()
    if not opt:
        raise HTTPException(404, "Không tìm thấy option")

    db.delete(opt)
    db.commit()
    return {"success": True, "message": "Đã xóa option"}
