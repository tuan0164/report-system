from jose import jwt
from fastapi import Header, HTTPException
from app.core.config import settings


def _decode_bearer(authorization: str) -> dict:
    """Tách 'Bearer <token>' + decode. Dùng chung cho mọi dependency."""
    scheme, _, token = authorization.partition(" ")
    if scheme != "Bearer" or not token:
        raise HTTPException(status_code=401, detail="Invalid Authorization header")
    try:
        return jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=["HS256"],
            options={"require_exp": True},
        )
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")


def get_current_user(authorization: str = Header(...)):
    return _decode_bearer(authorization)


def require_admin(authorization: str = Header(...)):
    payload = _decode_bearer(authorization)
    if payload.get("role") != "ADMIN":
        raise HTTPException(status_code=403, detail="Cần quyền ADMIN")
    return payload