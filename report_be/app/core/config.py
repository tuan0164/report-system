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

    class Config:
        env_file = ".env"

settings = Settings()