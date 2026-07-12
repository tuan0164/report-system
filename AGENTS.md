# AGENTS.md

## Project Structure

Full-stack daily report webapp.

- `backend/` — FastAPI (Python 3.13), SQLAlchemy, Alembic
- `frontend/` — React 19 + Vite 8, plain JS (no TypeScript)
- `docker-compose.yml` — PostgreSQL 18 on port **5434**

## Commands

### Backend (run from `backend/`)

```bash
# Start dev server
uvicorn app.main:app --reload

# Alembic migrations
alembic revision --autogenerate -m "description"
alembic upgrade head
alembic downgrade -1
```

### Frontend (run from `frontend/`)

```bash
npm run dev      # dev server on :5173
npm run build    # production build
npm run lint     # ESLint
```

### Database

```bash
docker compose up -d   # starts postgres on :5434
```

DB credentials: đọc từ `.env` ở thư mục gốc (`POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB`). Không hardcode.

## Important Notes

- **DB URL is hardcoded** in `backend/app/core/database.py:8` — does NOT use `.env` or `config.py`. The `alembic.ini` also has its own hardcoded URL.
- Backend CORS allows only `http://localhost:5173`.
- Frontend API client hardcodes `http://localhost:8000` in `frontend/src/api/client.js:4`.
- Auth: Google OAuth via `@react-oauth/google`, JWT tokens stored in `localStorage`.
- No tests configured in either backend or frontend.
- Backend `.env` is gitignored but contains secrets — never commit it.

## Features

- **Role-based access control**: `USER` and `ADMIN` roles. JWT payload includes `role` field.
- **Project management**: Admin-only CRUD at `/projects`. Projects have name, description, start_date, end_date, is_active.
- **Daily report**: Uses dynamic project list from API (filtered by `is_active=true`).
- **Admin report view**: Admin can view all employees' reports with filters at `/admin/reports`.
- **Frontend routing**: `PrivateRoute` uses `jwt-decode` to check role on client side.
