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

router = APIRouter(
    prefix="/auth",
    tags=["Auth"]
)

@router.get("/google")
async def login_google(request: Request):
    redirect_uri = f"{settings.BACKEND_URL}/auth/google/callback"
    return await oauth.google.authorize_redirect(request, redirect_uri)


@router.get("/google/callback", name="google_callback")
async def google_callback(request: Request, db: Session = Depends(get_db)):
    token = await oauth.google.authorize_access_token(request)
    userinfo = token["userinfo"]
    email = userinfo["email"]

    if not email.endswith("@hdc-flowtech.com"):#("@hdc-flowtech.com")
        return RedirectResponse(
            url=f"{settings.FRONTEND_URL}/login?error=not_company",
            status_code=302,
        )

    google_id = userinfo["sub"]
    full_name = userinfo["name"]

    user = db.query(User).filter(User.email == email).first()

    if not user:
        user = User(email=email, full_name=full_name, google_id=google_id, role="USER")
        db.add(user)
        db.commit()
        db.refresh(user)

    if not user.is_active:
        return RedirectResponse(
            url=f"{settings.FRONTEND_URL}/login?error=disabled",
            status_code=302,
        )

    access_token = create_access_token({
        "sub": str(user.id),
        "email": user.email,
        "role": user.role
    })

    return RedirectResponse(
        url=f"{settings.FRONTEND_URL}/login-success?token={access_token}",
        status_code=302  
    )