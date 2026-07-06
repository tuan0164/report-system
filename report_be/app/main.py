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
app = FastAPI()

app.add_middleware(
    SessionMiddleware,
    secret_key=settings.SESSION_SECRET_KEY
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