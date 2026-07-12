# ---- Backend: FastAPI + gunicorn/uvicorn ----
FROM python:3.12-slim

# Không ghi .pyc, log ra thẳng stdout
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# psycopg2-binary cần vài lib hệ thống; slim thiếu nên cài tối thiểu
RUN apt-get update \
    && apt-get install -y --no-install-recommends libpq5 \
    && rm -rf /var/lib/apt/lists/*

# Cài deps trước (tận dụng cache Docker layer)
COPY requirements.txt .
# LƯU Ý: requirements.txt hiện CHƯA có gunicorn -> thêm 1 dòng "gunicorn==23.0.0"
RUN pip install --no-cache-dir -r requirements.txt

# Copy source
COPY . .

EXPOSE 8000

# 4 worker uvicorn. Chỉnh -w theo số CPU (khuyến nghị 2*core + 1)
# --access-logfile - : ghi access log ra stdout. Không có nó thì prod mù,
# không biết ai gọi gì khi có sự cố. Docker đã giới hạn log 3x10MB.
CMD ["gunicorn", "app.main:app", \
     "-k", "uvicorn.workers.UvicornWorker", \
     "-w", "4", \
     "-b", "0.0.0.0:8000", \
     "--access-logfile", "-", \
     "--forwarded-allow-ips", "*"]
