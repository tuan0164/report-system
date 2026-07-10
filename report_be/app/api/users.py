from fastapi import APIRouter
from fastapi import Depends
from fastapi import HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.dependencies.auth import (
    get_current_user,
    require_admin,
)
from app.core.database import get_db
from app.models.models import User
from app.models.daily_report import Report
from app.schemas.user import UserResponse, UserUpdate
router = APIRouter(
    prefix="/users",
    tags=["Users"]
)

@router.get("/me")
def get_me(
    user=Depends(get_current_user)
):
    return user


class RoleUpdate(BaseModel):
    role: str


class ActiveUpdate(BaseModel):
    is_active: bool


@router.get("/", response_model=list[UserResponse])
def list_users(
    db: Session = Depends(get_db),
    current_user=Depends(require_admin),
):
    # Báo cáo mới nhất của mỗi email -> lấy mã nhân viên & họ tên
    latest_report = (
        db.query(
            Report.email.label("email"),
            Report.employee_code.label("employee_code"),
            Report.full_name.label("report_full_name"),
        )
        .distinct(Report.email)
        .order_by(Report.email, Report.report_date.desc(), Report.id.desc())
        .subquery()
    )

    rows = (
        db.query(
            User,
            latest_report.c.employee_code,
            latest_report.c.report_full_name,
        )
        .outerjoin(latest_report, latest_report.c.email == User.email)
        .order_by(User.id.desc())
        .all()
    )

    return [
        UserResponse(
            id=user.id,
            email=user.email,
            full_name=user.full_name,
            role=user.role,
            is_active=user.is_active,
            employee_code=employee_code,
            report_full_name=report_full_name,
        )
        for user, employee_code, report_full_name in rows
    ]


@router.patch("/{user_id}/role", response_model=UserResponse)
def update_user_role(
    user_id: int,
    payload: RoleUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_admin),
):
    if payload.role not in ("USER", "ADMIN"):
        raise HTTPException(status_code=400, detail="Role không hợp lệ")

    if int(current_user["sub"]) == user_id:
        raise HTTPException(status_code=400, detail="Không thể tự đổi role của chính mình")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy user")

    if user.role == "ADMIN" and payload.role != "ADMIN" and user.is_active:
        active_admins = db.query(User).filter(
            User.role == "ADMIN", User.is_active == True
        ).count()
        if active_admins <= 1:
            raise HTTPException(
                status_code=400, detail="Không thể hạ quyền admin cuối cùng"
            )

    user.role = payload.role
    db.commit()
    db.refresh(user)
    return user


@router.patch("/{user_id}/active", response_model=UserResponse)
def update_user_active(
    user_id: int,
    payload: ActiveUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_admin),
):
    if int(current_user["sub"]) == user_id:
        raise HTTPException(status_code=400, detail="Không thể tự vô hiệu hóa chính mình")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy user")

    if user.role == "ADMIN" and not payload.is_active:
        active_admins = db.query(User).filter(
            User.role == "ADMIN", User.is_active == True
        ).count()
        if active_admins <= 1:
            raise HTTPException(
                status_code=400, detail="Không thể vô hiệu hóa admin cuối cùng"
            )

    user.is_active = payload.is_active
    db.commit()
    db.refresh(user)
    return user

@router.patch("/me", response_model=UserResponse)
def update_me( 
    payload:UserUpdate,
    db:Session = Depends(get_db),
    current_user=Depends(get_current_user),):
    user = db.query(User).filter(User.id == int(current_user["sub"])).first()
    if not user:
     raise HTTPException(status_code=404, detail="Không tìm thấy user")
    
    update_data = payload.model_dump(exclude_unset=True)
        
    if not update_data:
            raise HTTPException(status_code=400, detail="Không có dữ liệu để cập nhật")
        
    for key, value in update_data.items():
        setattr(user, key, value)
        
    db.commit()
    db.refresh(user)
      
    return user