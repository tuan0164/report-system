from jose import jwt
from datetime import datetime, timedelta, timezone

from app.core.config import settings


def create_access_token(data):

    payload = data.copy()

    # datetime.utcnow() đã deprecated: nó trả về giờ UTC nhưng KHÔNG gắn
    # timezone, nên dễ bị so sánh nhầm với giờ local. now(timezone.utc)
    # trả về datetime có timezone rõ ràng.
    payload["exp"] = (
        datetime.now(timezone.utc)
        + timedelta(hours=settings.ACCESS_TOKEN_EXPIRE_HOURS)
    )

    return jwt.encode(
        payload,
        settings.JWT_SECRET_KEY,
        algorithm=settings.ALGORITHM
    )
