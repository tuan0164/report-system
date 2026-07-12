from fastapi import FastAPI
from starlette.middleware.sessions import SessionMiddleware
from fastapi.middleware.cors import CORSMiddleware
from app.core.database import Base, engine
from app.core.config import settings
from app.api.auth import router as auth_router
from app.api.users import router as users_router
from app.api.daily_report import router as daily_report_router
from app.api.field_options import router as field_options_router
from app.api.add_column import router as add_column_router
from app.api.dynamic_columns import router as dynamic_columns_router
import os

# Ở production tắt hẳn /docs, /redoc và /openapi.json: chúng phơi toàn bộ
# danh sách endpoint và schema cho người lạ. Muốn bật lại khi debug thì đặt
# ENVIRONMENT=development trong .env.
_docs_enabled = not settings.is_production

app = FastAPI(
    root_path="/api",
    docs_url="/docs" if _docs_enabled else None,
    redoc_url="/redoc" if _docs_enabled else None,
    openapi_url="/openapi.json" if _docs_enabled else None,
)


@app.get("/health", include_in_schema=False)
def health():
    """Liveness cho Docker healthcheck. Không đụng DB: chỉ trả lời được
    nghĩa là tiến trình còn sống và ASGI còn phục vụ."""
    return {"status": "ok"}


# Session này CHỈ giữ state của OAuth trong lúc chuyển hướng sang Google.
# Không chứa danh tính người dùng (danh tính nằm ở cookie access_token).
app.add_middleware(
    SessionMiddleware,
    secret_key=settings.SESSION_SECRET_KEY,
    session_cookie="oauth_session",
    # Chỉ gửi qua HTTPS ở prod. Dùng chung cờ với cookie access_token.
    https_only=settings.COOKIE_SECURE,
    same_site=settings.COOKIE_SAMESITE,
    # Vòng đời ngắn: chỉ đủ cho một lần đăng nhập, không phải phiên dài hạn.
    max_age=600,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(users_router)
app.include_router(daily_report_router)
app.include_router(field_options_router)
app.include_router(add_column_router)
app.include_router(dynamic_columns_router)