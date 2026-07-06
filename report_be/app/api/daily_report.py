from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from typing import Optional
from datetime import date, datetime
from zoneinfo import ZoneInfo

from app.core.database import get_db
from app.dependencies.auth import get_current_user, require_admin
from app.models.daily_report import Report
from app.schemas.daily_report import ReportCreate, ReportResponse
from app.dependencies.add_column import run_sql

router = APIRouter(prefix="/daily-reports", tags=["DailyReports"])

_VN_TZ = ZoneInfo("Asia/Ho_Chi_Minh")


def today_vn():
    return datetime.now(_VN_TZ).date()

# Trường lõi map bởi ORM Report. Phần còn lại là cột động → ghi qua raw SQL.
STATIC_FIELDS = {
    "report_date", "employee_code", "full_name", "project", "extra_fields",
}


# Ràng buộc 1 báo cáo/ngày: report_date NOT NULL + unique (email, report_date).
# Best-effort, chạy 1 lần khi load app — cùng cơ chế run_sql như các API cột động.
def _ensure_report_day_constraints():
    for sql in (
        'ALTER TABLE "reports" ALTER COLUMN "report_date" SET DEFAULT CURRENT_DATE',
        'UPDATE "reports" SET "report_date" = CURRENT_DATE WHERE "report_date" IS NULL',
        'ALTER TABLE "reports" ALTER COLUMN "report_date" SET NOT NULL',
        'CREATE UNIQUE INDEX IF NOT EXISTS uq_reports_email_date '
        'ON "reports" ("email", "report_date")',
    ):
        try:
            run_sql(sql)
        except Exception:
            pass


_ensure_report_day_constraints()


def _active_dynamic(db: Session, data: dict) -> dict:
    """Lọc phần cột động: bỏ trường lõi + email, chỉ giữ cột đang bật (is_active)."""
    dynamic = {k: v for k, v in data.items() if k not in STATIC_FIELDS and k != "email"}
    active_rows = db.execute(
        text("SELECT name FROM dynamic_column_defs WHERE is_active = true")
    ).fetchall()
    active_cols = {r[0] for r in active_rows}
    return {k: v for k, v in dynamic.items() if k in active_cols}


def _fetch_report_by_id(report_id: int):
    """Đọc 1 report kèm cả cột động (raw SQL, giống GET). Trả dict hoặc None."""
    col_info = run_sql(
        """SELECT column_name FROM information_schema.columns
           WHERE table_name = 'reports' ORDER BY ordinal_position""",
        fetch=True,
    )
    col_str = ", ".join([f'"{c["column_name"]}"' for c in col_info])
    rows = run_sql(
        f'SELECT {col_str} FROM "reports" WHERE "id" = %s',
        (report_id,), fetch=True,
    )
    if not rows:
        return None
    row = rows[0]
    for key, val in row.items():
        if hasattr(val, "isoformat"):
            row[key] = val.isoformat()
    return row


@router.post("/", response_model=ReportResponse)
def create_report(
    payload: ReportCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    data = payload.model_dump()
    data["report_date"] = today_vn()
    static = {k: v for k, v in data.items() if k in STATIC_FIELDS}
    dynamic = _active_dynamic(db, data)
    existing = db.query(Report).filter(
        Report.email == current_user["email"],
        Report.report_date == today_vn(),
    ).first()
    if existing:
        raise HTTPException(
            409, "Bạn đã gửi báo cáo hôm nay. Vui lòng cập nhật báo cáo đã gửi."
        )

    try:
        report = Report(email=current_user["email"], **static)
        db.add(report)
        db.flush() 
        new_id = report.id

        if dynamic:
            set_clauses = ", ".join([f'"{k}" = :{k}' for k in dynamic])
            params = dict(dynamic)
            params["_rid"] = report.id
            db.execute(
                text(f'UPDATE "reports" SET {set_clauses} WHERE id = :_rid'),
                params,
            )

        db.commit()  
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            409, "Bạn đã gửi báo cáo hôm nay. Vui lòng cập nhật báo cáo đã gửi."
        )
    except Exception:
        db.rollback() 
        raise

    return _fetch_report_by_id(new_id)

@router.put("/{report_id}", response_model=ReportResponse)
def update_report(
    report_id: int,
    payload: ReportCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Sửa báo cáo của CHÍNH mình, chỉ cho báo cáo hôm nay."""
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(404, "Không tìm thấy báo cáo")
    if report.email != current_user["email"]:
        raise HTTPException(403, "Không thể sửa báo cáo của người khác")
    if report.report_date != today_vn():
        raise HTTPException(403, "Chỉ được sửa báo cáo của hôm nay")

    data = payload.model_dump()
    data["report_date"] = today_vn()  
    for k in ("employee_code", "full_name", "project", "extra_fields"):
        if k in data:
            setattr(report, k, data[k])

    dynamic = _active_dynamic(db, data)

    try:
        if dynamic:
            set_clauses = ", ".join([f'"{k}" = :{k}' for k in dynamic])
            params = dict(dynamic)
            params["_rid"] = report.id
            db.execute(
                text(f'UPDATE "reports" SET {set_clauses} WHERE id = :_rid'),
                params,
            )
        db.commit()
    except Exception:
        db.rollback()
        raise

    return _fetch_report_by_id(report.id)


@router.get("/")
def get_my_reports(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    col_info = run_sql(
        """SELECT column_name FROM information_schema.columns
           WHERE table_name = 'reports' ORDER BY ordinal_position""",
        fetch=True,
    )
    col_str = ", ".join([f'"{c["column_name"]}"' for c in col_info])

    rows = run_sql(
        f'SELECT {col_str} FROM "reports" WHERE "email" = %s ORDER BY "id" DESC',
        (current_user["email"],), fetch=True,
    )
    for row in rows:
        for key, val in row.items():
            if hasattr(val, "isoformat"):
                row[key] = val.isoformat()
    return rows


@router.get("/all")
def get_all_reports(
    email: Optional[str] = Query(None),
    report_date: Optional[date] = Query(None),
    db: Session = Depends(get_db),
    current_user=Depends(require_admin),
):
    col_info = run_sql(
        """SELECT column_name FROM information_schema.columns
           WHERE table_name = 'reports' ORDER BY ordinal_position""",
        fetch=True,
    )
    col_names = [c["column_name"] for c in col_info]
    col_str = ", ".join([f'"{c}"' for c in col_names])

    query = f'SELECT {col_str} FROM "reports"'
    conditions, params = [], []

    if email:
        conditions.append('"email" = %s')
        params.append(email)
    if report_date:
        conditions.append('"report_date" = %s')
        params.append(str(report_date))

    if conditions:
        query += " WHERE " + " AND ".join(conditions)

    query += ' ORDER BY "id" DESC'

    rows = run_sql(query, tuple(params) if params else None, fetch=True)

    for row in rows:
        for key, val in row.items():
            if hasattr(val, "isoformat"):
                row[key] = val.isoformat()
            elif isinstance(val, list):
                row[key] = val

    return rows
