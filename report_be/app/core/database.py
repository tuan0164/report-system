from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase 
from app.core.config import settings

engine = create_engine(
    settings.DATABASE_URL,

    # Trước mỗi lần lấy connection ra khỏi pool, gửi 1 query rỗng để kiểm tra
    # nó còn sống. Không có cờ này: connection nằm im qua đêm bị Postgres hoặc
    # firewall cắt, sáng hôm sau người đầu tiên vào ăn lỗi 500 ngẫu nhiên.
    pool_pre_ping=True,

    # Chủ động vứt connection cũ hơn 30 phút. Chặn trước các timeout im lặng
    # ở tầng mạng (idle timeout của firewall/NAT thường 30-60 phút).
    pool_recycle=1800,

    # 4 worker gunicorn x (5 + 5) = tối đa 40 connection.
    # Postgres mặc định cho 100 -> vẫn còn dư cho psql/backup.
    pool_size=5,
    max_overflow=5,
)

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