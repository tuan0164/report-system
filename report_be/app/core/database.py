from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase 
from app.core.config import settings

engine = create_engine(
    settings.DATABASE_URL
)

# DATABASE_URL = "postgresql://webapp:123456@localhost:5434/report"
# engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

class Base( DeclarativeBase ):
    pass

def get_db():

    db = SessionLocal()

    try:
        yield db

    finally:
        db.close()