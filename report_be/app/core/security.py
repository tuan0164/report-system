from jose import jwt
from datetime import datetime
from datetime import timedelta

from app.core.config import settings

def create_access_token(data):

    payload = data.copy()

    payload["exp"] = (
        datetime.utcnow()
        + timedelta(hours=settings.ACCESS_TOKEN_EXPIRE_HOURS)
    )

    return jwt.encode(
        payload,
        settings.JWT_SECRET_KEY,
        algorithm=settings.ALGORITHM
    )
