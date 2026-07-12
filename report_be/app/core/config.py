from pydantic_settings import BaseSettings

class Settings(BaseSettings):

    DATABASE_URL: str

    GOOGLE_CLIENT_ID: str

    GOOGLE_CLIENT_SECRET: str

    JWT_SECRET_KEY: str
    SESSION_SECRET_KEY: str

    FRONTEND_URL: str
    BACKEND_URL: str 
    
    ALGORITHM : str 

    ACCESS_TOKEN_EXPIRE_HOURS : int

    # Cookie chứa access token. HttpOnly nên JS không đọc được.
    ACCESS_TOKEN_COOKIE_NAME: str = "access_token"

    # Bắt buộc True ở prod (chỉ gửi cookie qua HTTPS).
    # Chỉ đặt False khi dev trên http://localhost.
    COOKIE_SECURE: bool = True

    # "lax" chặn cookie trong request cross-site không phải GET top-level
    # -> đủ để chống CSRF cho POST/PATCH/DELETE, và vẫn cho phép
    # redirect OAuth từ Google set được cookie.
    COOKIE_SAMESITE: str = "lax"

    # "production" | "development". Mặc định production: an toàn khi quên đặt.
    # Ở production, /docs, /redoc và /openapi.json bị tắt.
    ENVIRONMENT: str = "production"

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT.strip().lower() == "production"

    class Config:
        env_file = ".env"

settings = Settings()