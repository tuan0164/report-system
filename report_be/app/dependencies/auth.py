from jose import jwt
from fastapi import Header
from fastapi import HTTPException

from app.core.config import settings

def get_current_user(
    authorization: str = Header(...)
):

    try:
        if not authorization.startswith("Bearer "):
         raise HTTPException(status_code=401, detail="Invalid Authorization header")

        token = authorization.split(" ", 1)[1] if " " in authorization else ""

        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=["HS256"]
        )

        return payload

    except Exception:

        raise HTTPException(
            status_code=401,
            detail="Invalid token"
        )


def require_admin(
    authorization: str = Header(...)
):

    try:

        token = authorization.replace(
            "Bearer ",
            ""
        )

        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=["HS256"]
        )

        if payload.get("role") != "ADMIN":
            raise HTTPException(
                status_code=403,
                detail="Cần quyền ADMIN"
            )

        return payload

    except HTTPException:
        raise

    except Exception:

        raise HTTPException(
            status_code=401,
            detail="Invalid token"
        )
