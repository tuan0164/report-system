# HDC Work Report — Web App

Hệ thống báo cáo công việc hàng ngày cho nhân viên HDC-Flowtech. Nhân viên đăng nhập bằng Google, nộp **1 báo cáo/ngày**, chỉnh sửa báo cáo trong ngày; quản trị viên xem báo cáo toàn công ty, quản lý tài khoản và tùy biến các cột báo cáo (dynamic columns).

## Kiến trúc

```
Trình duyệt
    │  HTTPS
    ▼
┌─────────────┐   /api/*   ┌─────────────┐        ┌────────────┐
│  Frontend   │──proxy────▶│   Backend   │───────▶│ PostgreSQL │
│ React+Vite  │            │  FastAPI    │        │   (18)     │
│ (nginx:80)  │◀───SPA─────│ (uvicorn)   │        └────────────┘
└─────────────┘            └─────────────┘
```

- **Frontend**: React 19 + Vite, React Router 7, Axios. Build tĩnh phục vụ qua **nginx**; nginx proxy `/api/*` → backend (xem `report_fe/nginx.conf`).
- **Backend**: FastAPI + SQLAlchemy 2, chạy bằng gunicorn/uvicorn. Đăng nhập Google OAuth (Authlib) + JWT (python-jose).
- **DB**: PostgreSQL 18.

## Cấu trúc thư mục

```
webapp/
├── docker-compose.yml          # DEV: chỉ postgres
├── docker-compose.prod.yml     # PROD: postgres + backend + frontend (all-in-one)
├── report_be/                  # Backend (FastAPI)
│   ├── app/
│   │   ├── main.py             # Khởi tạo app, middleware, gắn router
│   │   ├── api/                # Route handlers (auth, users, daily_report, dynamic_columns, ...)
│   │   ├── core/               # config, database, security
│   │   ├── models/             # ORM models
│   │   ├── schemas/            # Pydantic schemas
│   │   ├── dependencies/       # auth, raw-SQL helper
│   │   └── services/           # google_service
│   ├── alembic/                # Migration
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env                    # Bí mật (KHÔNG commit) — xem .env.example
└── report_fe/                  # Frontend (React + Vite)
    ├── src/
    │   ├── api/                # Client axios + module gọi API
    │   ├── pages/              # Dashboard, DailyReportForm, AdminReports, ColumnManager, ...
    │   ├── components/         # Layout, Navbar, ReportCalendar
    │   └── routes/             # PrivateRoute
    ├── nginx.conf              # Cấu hình serve SPA + proxy /api
    ├── Dockerfile
    └── package.json
```

## Yêu cầu

- Docker + Docker Compose (chạy nhanh nhất), **hoặc**
- Node.js 24 + Python 3.12 + PostgreSQL 18 (chạy cục bộ).

---

## Chạy PRODUCTION (Docker, all-in-one)

```bash
# 1. Chuẩn bị biến môi trường backend
cp report_be/.env.example report_be/.env
# Sửa report_be/.env — DATABASE_URL host phải là "postgres" (tên service):
#   DATABASE_URL=postgresql://webapp:123456@postgres:5432/report

# 2. Build + chạy toàn bộ
docker compose -f docker-compose.prod.yml up -d --build

# 3. Chạy migration (lần đầu / khi có thay đổi schema)
docker compose -f docker-compose.prod.yml exec backend alembic upgrade head
```

- Truy cập: `http://localhost` (cổng 80).
- FE gọi API qua `/api` cùng origin → nginx proxy sang backend, không lo CORS.
- HTTPS: đặt nginx/certbot bên ngoài cho cổng 443.

**Quan trọng — timezone**: container mặc định UTC. Backend đã tính "hôm nay" theo giờ VN (`today_vn()` dùng `Asia/Ho_Chi_Minh`) nên không lệch ngày. Nếu muốn chắc thêm, set biến `TZ=Asia/Ho_Chi_Minh` cho service `backend`.

---

## Chạy DEV (hot reload, không rebuild mỗi lần sửa)

### 1. Postgres qua Docker

```bash
docker compose up -d postgres      # mở cổng 5434 ra host
```

### 2. Backend (uvicorn --reload)

```bash
cd report_be
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# .env cho dev: DATABASE_URL trỏ localhost:5434
#   DATABASE_URL=postgresql://webapp:123456@localhost:5434/report

uvicorn app.main:app --reload --port 8000
```

Sửa `.py` → server tự restart. API docs: `http://localhost:8000/docs`.

### 3. Frontend (vite dev)

```bash
cd report_fe
npm install
# Trỏ API về backend dev:
#   echo "VITE_API_URL=http://localhost:8000" > .env.local
npm run dev
```

Mở link Vite in ra (mặc định `http://localhost:5173`). Sửa file → HMR cập nhật ngay.

> **Lưu ý**: chỉ image Docker mới cần `--build` khi có thay đổi code. Ở chế độ dev (`--reload` / vite HMR), sửa file thấy ngay, không phải build lại.

---

## Biến môi trường (backend `.env`)

| Biến | Ý nghĩa |
|------|---------|
| `DATABASE_URL` | Chuỗi kết nối Postgres. Prod: host `postgres:5432`; dev: `localhost:5434`. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | OAuth Google (tạo tại Google Cloud Console). |
| `JWT_SECRET_KEY` | Ký JWT. Sinh: `python3 -c "import secrets; print(secrets.token_urlsafe(48))"`. |
| `SESSION_SECRET_KEY` | Ký session middleware. Sinh tương tự. |
| `FRONTEND_URL` | Origin FE — dùng cho CORS + redirect sau login. |
| `BACKEND_URL` | Origin BE (callback OAuth). |
| `ALGORITHM` | Thuật toán JWT (mặc định `HS256`). |
| `ACCESS_TOKEN_EXPIRE_HOURS` | Thời hạn token. |

Frontend dùng `VITE_API_URL` (nhúng lúc **build**): prod `/api`, dev `http://localhost:8000`.

---

## API chính

Base: prod `/api`, dev `http://localhost:8000`. Docs tự sinh: `/docs`.

| Method | Đường dẫn | Quyền | Mô tả |
|--------|-----------|-------|-------|
| GET | `/auth/google` | Public | Bắt đầu đăng nhập Google |
| GET | `/auth/google/callback` | Public | Callback OAuth, trả JWT |
| GET | `/users/me` | User | Thông tin người dùng hiện tại |
| GET | `/users/` | Admin | Danh sách tài khoản |
| POST | `/daily-reports/` | User | Nộp báo cáo hôm nay (409 nếu đã nộp) |
| PUT | `/daily-reports/{id}` | User | Sửa báo cáo hôm nay của chính mình |
| GET | `/daily-reports/` | User | Báo cáo của tôi |
| GET | `/daily-reports/all` | Admin | Báo cáo toàn công ty (lọc theo email/ngày) |
| GET/POST/DELETE | `/dynamic-columns/` | Admin | Quản lý cột báo cáo động |
| GET/POST/DELETE | `/field-options/` | Admin | Quản lý tùy chọn cho trường dạng danh sách |

### Quy tắc nghiệp vụ báo cáo
- Mỗi email chỉ **1 báo cáo/ngày**: chặn 2 lớp — query kiểm tra trước khi tạo + unique index `(email, report_date)` chống race.
- `report_date` do **server** quyết định (giờ VN), bỏ qua giá trị client gửi.
- Chỉ được sửa báo cáo **của chính mình** và **trong ngày**.

---

## Tính năng

**Nhân viên**
- Đăng nhập Google.
- Nộp/sửa báo cáo ngày (mã NV tự suy từ email, prefill họ tên từ báo cáo gần nhất).
- Dashboard: lịch nộp báo cáo theo tháng (đã nộp / chưa nộp / ngày nghỉ), dự án đang tham gia.

**Quản trị viên**
- Xem báo cáo toàn công ty, lọc theo nhân viên/ngày.
- Quản lý cột báo cáo động (thêm/sửa/xóa cột, kiểu dữ liệu, bắt buộc, tùy chọn).
- Quản lý tài khoản (phân quyền, khóa).

---

## Migration (Alembic)

```bash
# Tạo revision từ thay đổi model
alembic revision --autogenerate -m "mô tả"
# Áp dụng
alembic upgrade head
```

Trong Docker: `docker compose -f docker-compose.prod.yml exec backend alembic upgrade head`.

---

## Ghi chú vận hành

- **Đổi code prod → phải rebuild image**: `docker compose -f docker-compose.prod.yml up -d --build backend frontend`.
- `docker-compose.yml` (dev) mở cổng Postgres `5434` cho DataGrip; prod thật nên **bỏ** map cổng DB ra host.
- Không commit `report_be/.env` (chứa bí mật). Mẫu: `report_be/.env.example`.
# report-system
