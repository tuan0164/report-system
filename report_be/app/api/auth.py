import logging

from authlib.integrations.starlette_client import OAuthError
from fastapi import APIRouter
from fastapi import Request
from fastapi import Depends
from fastapi.responses import RedirectResponse

from sqlalchemy.orm import Session

from app.core.database import get_db
from app.services.google_service import oauth
from app.models.models import User
from app.core.security import create_access_token
from app.core.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/auth",
    tags=["Auth"]
)


def _login_error(code: str) -> RedirectResponse:
    return RedirectResponse(
        url=f"{settings.FRONTEND_URL}/login?error={code}",
        status_code=302,
    )

@router.get("/google")
async def login_google(request: Request):
    redirect_uri = f"{settings.BACKEND_URL}/auth/google/callback"
    return await oauth.google.authorize_redirect(request, redirect_uri)


@router.get("/google/callback", name="google_callback")
async def google_callback(request: Request, db: Session = Depends(get_db)):
    try:
        token = await oauth.google.authorize_access_token(request)
    except OAuthError as exc:
        # State hết hạn / user bấm hủy / mã đổi token không hợp lệ
        logger.warning("Google OAuth callback thất bại: %s", exc.error)
        return _login_error("session_expired")

    userinfo = token.get("userinfo")
    if not userinfo or not userinfo.get("email"):
        logger.warning("Google OAuth callback thiếu userinfo")
        return _login_error("session_expired")

    email = userinfo["email"]

    if not email.endswith("@hdc-flowtech.com"):#("@hdc-flowtech.com")
        return _login_error("not_company")

    google_id = userinfo["sub"]
    full_name = userinfo.get("name") or email.split("@")[0]

    user = db.query(User).filter(User.email == email).first()

    if not user:
        user = User(email=email, full_name=full_name, google_id=google_id, role="USER")
        db.add(user)
        db.commit()
        db.refresh(user)

    if not user.is_active:
        return _login_error("disabled")

    access_token = create_access_token({
        "sub": str(user.id),
        "email": user.email,
        "role": user.role
    })

    return RedirectResponse(
        url=f"{settings.FRONTEND_URL}/login-success?token={access_token}",
        status_code=302  
    )