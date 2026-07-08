import { useMemo, useState } from "react";
import "./ReportCalendar.css";

const WEEKDAYS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
const MONTHS = [
  "tháng 1", "tháng 2", "tháng 3", "tháng 4", "tháng 5", "tháng 6",
  "tháng 7", "tháng 8", "tháng 9", "tháng 10", "tháng 11", "tháng 12",
];

// Lịch đã/chưa nộp báo cáo. Tái dùng: truyền list report (có report_date).
// Xem tháng hiện tại + các tháng trước; T7/CN + tương lai để trống.
export default function ReportCalendar({ reports = [] }) {
  const [monthOffset, setMonthOffset] = useState(0);

  const calendar = useMemo(() => {
    const now = new Date();
    const base = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
    const year = base.getFullYear();
    const month = base.getMonth();
    const isCurrent = monthOffset === 0;
    const today = now.getDate();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const submitted = new Set(
      reports
        .map((r) => (r.report_date ? String(r.report_date).slice(0, 10) : null))
        .filter(Boolean)
    );

    const firstDow = new Date(year, month, 1).getDay();
    const lead = (firstDow + 6) % 7;

    const cells = [];
    for (let i = 0; i < lead; i++) cells.push({ blank: true, key: `b${i}` });

    let done = 0;
    let miss = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const dow = new Date(year, month, d).getDay();
      const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const isToday = isCurrent && d === today;
      let status;
      if (isCurrent && d > today) status = "future";
      else if (submitted.has(iso)) { status = "submitted"; done++; }
      else if (dow === 0 || dow === 6) status = "weekend";
      else { status = "missing"; miss++; }
      cells.push({ day: d, status, isToday, key: iso });
    }

    return { cells, label: `${MONTHS[month]}/${year}`, done, miss };
  }, [reports, monthOffset]);

  return (
    <div className="rc">
      <div className="rc-nav">
        <button
          type="button"
          className="rc-btn"
          onClick={() => setMonthOffset((m) => m - 1)}
          aria-label="Tháng trước"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <span className="rc-month">{calendar.label}</span>
        <button
          type="button"
          className="rc-btn"
          onClick={() => setMonthOffset((m) => Math.min(0, m + 1))}
          disabled={monthOffset >= 0}
          aria-label="Tháng sau"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>

      <div className="rc-grid">
        {WEEKDAYS.map((w) => (
          <div key={w} className="rc-dow">{w}</div>
        ))}
        {calendar.cells.map((c) =>
          c.blank ? (
            <div key={c.key} className="rc-cell" />
          ) : (
            <div
              key={c.key}
              className={`rc-cell rc-${c.status}${c.isToday ? " rc-today" : ""}`}
            >
              <span className="rc-day">{c.day}</span>
              {c.status === "submitted" && (
                <svg className="rc-mk rc-mk--yes" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              )}
              {c.status === "missing" && (
                <svg className="rc-mk rc-mk--no" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              )}
            </div>
          )
        )}
      </div>

      <div className="rc-legend">
        <span className="rc-leg">
          <i className="rc-box rc-box--yes">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
          </i>
          Đã nộp ({calendar.done})
        </span>
        <span className="rc-leg">
          <i className="rc-box rc-box--no">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </i>
          Chưa nộp ({calendar.miss})
        </span>
        <span className="rc-leg">
          <i className="rc-box rc-box--off" />
          Ngày nghỉ
        </span>
      </div>
    </div>
  );
}
