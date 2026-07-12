from fastapi import Depends, HTTPException, Request
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.models.models import User


def _unauthorized(detail: str = "Chưa đăng nhập hoặc phiên đã hết hạn") -> HTTPException:
    return HTTPException(status_code=401, detail=detail)


def _decode_token(token: str) -> dict:
    """Decode JWT. Thuật toán pin cứng HS256 để chặn tấn công đổi alg."""
    try:
        return jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=["HS256"],
            options={"require_exp": True},
        )
    except JWTError:
        raise _unauthorized("Token không hợp lệ")


def get_current_user(
    request: Request,
    db: Session = Depends(get_db),
) -> dict:
    """Token đọc từ cookie HttpOnly. Không nhận Authorization header nữa.

    Sau khi decode còn tra DB: role và is_active lấy từ DB chứ không lấy từ
    payload, nên khóa tài khoản hoặc hạ quyền có hiệu lực ngay, không phải
    đợi token cũ hết hạn.
    """
    token = request.cookies.get(settings.ACCESS_TOKEN_COOKIE_NAME)
    if not token:
        raise _unauthorized()

    payload = _decode_token(token)

    try:
        user_id = int(payload["sub"])
    except (KeyError, TypeError, ValueError):
        raise _unauthorized("Token không hợp lệ")

    user = db.query(User).filter(User.id == user_id).first()
    if not user or not user.is_active:
        raise _unauthorized()

    return {
        "sub": str(user.id),
        "id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "role": user.role,
        "is_active": user.is_active,
    }


def require_admin(current_user: dict = Depends(get_current_user)) -> dict:
    if current_user["role"] != "ADMIN":
        raise HTTPException(status_code=403, detail="Cần quyền ADMIN")
    return current_user
