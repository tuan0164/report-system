import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/client";
import { getMyReports } from "../api/dailyReport";
import { getUsers, getAllReports } from "../api/reports";
import "./Dashboard.css";

const WEEKDAYS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
const MONTHS = [
  "tháng 1", "tháng 2", "tháng 3", "tháng 4", "tháng 5", "tháng 6",
  "tháng 7", "tháng 8", "tháng 9", "tháng 10", "tháng 11", "tháng 12",
];

// Initials từ tên (2 chữ cái cuối — hợp tên tiếng Việt "Bùi Văn Tuấn" -> "VT").
const initials = (name) => {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return parts.slice(-2).map((w) => w[0]).join("").toUpperCase();
};

// Tông avatar (muối trung tính, chuyên nghiệp). Chọn ổn định theo tên.
const AVATAR_TONES = [
  ["#e0ecff", "#1e40af"],
  ["#dcfce7", "#15803d"],
  ["#fef3c7", "#b45309"],
  ["#e0f2fe", "#0369a1"],
  ["#ede9fe", "#6d28d9"],
  ["#cffafe", "#0e7490"],
];
const avatarTone = (s) => {
  const key = s || "?";
  let sum = 0;
  for (let i = 0; i < key.length; i++) sum += key.charCodeAt(i);
  return AVATAR_TONES[sum % AVATAR_TONES.length];
};

export default function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [reports, setReports] = useState([]);
  const [users, setUsers] = useState([]); // admin: toàn user
  const [allReports, setAllReports] = useState([]); // admin: toàn report
  const [monthOffset, setMonthOffset] = useState(0); // 0 = tháng hiện tại

  useEffect(() => {
    api
      .get("/users/me")
      .then((res) => {
        setUser(res.data);
        if (res.data.role === "ADMIN") {
          getUsers()
            .then((r) => setUsers(Array.isArray(r.data) ? r.data : []))
            .catch(() => setUsers([]));
          getAllReports()
            .then((r) => setAllReports(Array.isArray(r.data) ? r.data : []))
            .catch(() => setAllReports([]));
        }
      })
      .catch(() => {
        localStorage.removeItem("access_token");
        navigate("/login");
      });
    getMyReports()
      .then((res) => setReports(Array.isArray(res.data) ? res.data : []))
      .catch(() => setReports([]));
  }, []);

  // Dự án của báo cáo gần nhất (rows sort id DESC ở BE -> phần tử [0]).
  const latestProjects = useMemo(() => {
    const p = reports[0]?.project;
    return Array.isArray(p) ? p.filter(Boolean) : [];
  }, [reports]);

  // Đã nộp báo cáo hôm nay chưa? -> đổi card thành "Sửa" để có đường sửa tường minh.
  const submittedToday = useMemo(() => {
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    return reports.some((r) => (r.report_date ? String(r.report_date).slice(0, 10) === todayStr : false));
  }, [reports]);

  // Lịch nộp báo cáo, xem được tháng hiện tại + các tháng trước.
  const calendar = useMemo(() => {
    const now = new Date();
    const base = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
    const year = base.getFullYear();
    const month = base.getMonth(); // 0-based
    const isCurrent = monthOffset === 0;
    const today = now.getDate();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const submitted = new Set(
      reports
        .map((r) => (r.report_date ? String(r.report_date).slice(0, 10) : null))
        .filter(Boolean)
    );

    // Lịch bắt đầu Thứ 2. Số ô trống đầu tháng.
    const firstDow = new Date(year, month, 1).getDay(); // 0=CN
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

  // Tổng quan admin: nộp hôm nay, chưa nộp, dự án + người tham gia.
  const adminData = useMemo(() => {
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

    // Nhân viên = active + không phải ADMIN.
    const employees = users.filter((u) => u.is_active && u.role !== "ADMIN");

    const submittedEmails = new Set(
      allReports
        .filter((r) => r.report_date && String(r.report_date).slice(0, 10) === todayStr)
        .map((r) => r.email)
    );
    const notSubmitted = employees.filter((u) => !submittedEmails.has(u.email));
    const doneCount = employees.length - notSubmitted.length;

    // Report gần nhất mỗi người (allReports đã sort id DESC ở BE).
    // Tên tự nhập ở report đúng thứ tự, dùng làm tên hiển thị thay full_name bảng user (bị ngược).
    const seen = new Set();
    const nameByEmail = new Map();
    const projMap = new Map();
    for (const r of allReports) {
      if (seen.has(r.email)) continue;
      seen.add(r.email);
      if (r.full_name) nameByEmail.set(r.email, r.full_name);
      const projs = Array.isArray(r.project) ? r.project.filter(Boolean) : [];
      for (const p of projs) {
        if (!projMap.has(p)) projMap.set(p, []);
        projMap.get(p).push({ name: r.full_name || r.email, code: r.employee_code || "" });
      }
    }
    const projects = Array.from(projMap.entries())
      .map(([name, members]) => ({ name, members }))
      .sort((a, b) => b.members.length - a.members.length);

    const notSubmittedNamed = notSubmitted.map((u) => ({
      ...u,
      displayName: nameByEmail.get(u.email) || u.full_name || u.email,
    }));

    return { total: employees.length, doneCount, notSubmitted: notSubmittedNamed, projects };
  }, [users, allReports]);

  if (!user) {
    return (
      <div className="page-loading">
        <div className="spinner spinner-lg"></div>
        <p>Đang tải...</p>
      </div>
    );
  }

  const isAdmin = user.role === "ADMIN";

  return (
    <div className="dashboard-page">
      <div className="dashboard-welcome">
        <h1 className="dashboard-greeting">HDC-Flowtech {user.full_name}</h1>
        <div className="dashboard-subtitle">
          <span className={`badge ${isAdmin ? "badge-info" : "badge-success"}`}>
            {isAdmin ? "Quản trị viên" : "Nhân viên"}
          </span>
          <span>{user.email}</span>
        </div>
      </div>

      {isAdmin ? (
      <div className="dashboard-layout">
        <div className="dashboard-grid">
          <div
            className="card dashboard-card dashboard-card--orange"
            onClick={() => navigate("/admin/reports")}
          >
            <div className="dashboard-card-icon dashboard-card-icon--orange">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
            </div>
            <h3 className="dashboard-card-title">Xem báo cáo</h3>
            <p className="dashboard-card-desc">Xem báo cáo tất cả nhân viên</p>
          </div>
        </div>

        <div className="admin-overview">
          <div className="admin-stat-row">
            <div className="card admin-stat admin-stat--done">
              <span className="admin-stat-ic">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
              </span>
              <div className="admin-stat-body">
                <span className="admin-stat-num kpi-num">{adminData.doneCount}</span>
                <span className="admin-stat-label">Đã nộp hôm nay</span>
              </div>
            </div>

            <div className="card admin-stat admin-stat--miss">
              <span className="admin-stat-ic">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              </span>
              <div className="admin-stat-body">
                <span className="admin-stat-num kpi-num">{adminData.notSubmitted.length}</span>
                <span className="admin-stat-label">Chưa nộp</span>
              </div>
            </div>

            <div className="card admin-stat admin-stat--total">
              <span className="admin-stat-ic">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 00-3-3.87" />
                  <path d="M16 3.13a4 4 0 010 7.75" />
                </svg>
              </span>
              <div className="admin-stat-body">
                <span className="admin-stat-num kpi-num">{adminData.total}</span>
                <span className="admin-stat-label">Tổng nhân viên</span>
              </div>
            </div>
          </div>

          <div className="card admin-panel admin-panel--warn">
            <div className="admin-panel-head">
              <h3 className="admin-panel-title">
                <span className="admin-panel-ic admin-panel-ic--warn">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                </span>
                Nhân viên chưa nộp báo cáo hôm nay
              </h3>
              <span className="admin-count admin-count--warn">{adminData.notSubmitted.length}</span>
            </div>
            {adminData.notSubmitted.length > 0 ? (
              <div className="admin-people">
                {adminData.notSubmitted.map((u) => {
                  const [bg, fg] = avatarTone(u.displayName);
                  return (
                    <div key={u.id} className="admin-person">
                      <span className="hdc-avatar admin-person-av" style={{ background: bg, color: fg }}>
                        {initials(u.displayName)}
                      </span>
                      <span className="admin-person-name">{u.displayName}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="admin-empty">Tất cả nhân viên đã nộp báo cáo hôm nay 🎉</p>
            )}
          </div>

          <div className="card admin-panel">
            <div className="admin-panel-head">
              <h3 className="admin-panel-title">
                <span className="admin-panel-ic admin-panel-ic--brand">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="7" width="20" height="14" rx="2" />
                    <path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16" />
                  </svg>
                </span>
                Dự án đang thực hiện
              </h3>
              <span className="admin-count">{adminData.projects.length}</span>
            </div>
            {adminData.projects.length > 0 ? (
              <div className="admin-proj-list">
                {adminData.projects.map((p) => (
                  <div key={p.name} className="admin-proj">
                    <div className="admin-proj-head">
                      <span className="admin-proj-name">{p.name}</span>
                      <span className="admin-proj-count">{p.members.length} người</span>
                    </div>
                    <div className="admin-proj-members">
                      {p.members.map((m, i) => {
                        const [bg, fg] = avatarTone(m.name);
                        return (
                          <div key={i} className="admin-member">
                            <span className="hdc-avatar admin-member-av" style={{ background: bg, color: fg }}>
                              {initials(m.name)}
                            </span>
                            <div className="admin-member-body">
                              <span className="admin-member-name">{m.name}</span>
                              {m.code && <span className="admin-member-role">Mã NV: {m.code}</span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="admin-empty">Chưa có dự án nào</p>
            )}
          </div>
        </div>
      </div>
      ) : (
      <div className="dashboard-layout">
        <div className="dashboard-grid">
          <div
            className={`card dashboard-card dashboard-report-card ${submittedToday ? "is-done" : "is-todo"}`}
            onClick={() => navigate("/report")}
          >
            <div className="dashboard-report-top">
              <div className="dashboard-card-icon dashboard-report-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </div>
              <span className="dashboard-status-pill">
                <span className="dashboard-status-dot" />
                {submittedToday ? "Đã nộp" : "Chưa nộp"}
              </span>
            </div>
            <h3 className="dashboard-card-title">{submittedToday ? "Sửa báo cáo hôm nay" : "Điền báo cáo hôm nay"}</h3>
            <p className="dashboard-card-desc">{submittedToday ? "Bạn đã nộp — bấm để chỉnh sửa" : "Báo cáo công việc hàng ngày"}</p>
          </div>

          {isAdmin && (
            <>
              <div
                className="card dashboard-card dashboard-card--orange"
                onClick={() => navigate("/admin/reports")}
              >
                <div className="dashboard-card-icon dashboard-card-icon--orange">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                  </svg>
                </div>
                <h3 className="dashboard-card-title">Xem báo cáo </h3>
                <p className="dashboard-card-desc">Xem báo cáo tất cả nhân viên</p>
              </div>

              <div
                className="card dashboard-card dashboard-card--purple"
                onClick={() => navigate("/admin/columns")}
              >
                <div className="dashboard-card-icon dashboard-card-icon--purple">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
                  </svg>
                </div>
                <h3 className="dashboard-card-title">Quản lý trường </h3>
                <p className="dashboard-card-desc">Thêm, sửa, xóa cột báo cáo</p>
              </div>

              <div
                className="card dashboard-card dashboard-card--blue"
                onClick={() => navigate("/admin/accounts")}
              >
                <div className="dashboard-card-icon dashboard-card-icon--blue">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 00-3-3.87" />
                    <path d="M16 3.13a4 4 0 010 7.75" />
                  </svg>
                </div>
                <h3 className="dashboard-card-title">Quản lý tài khoản</h3>
                <p className="dashboard-card-desc">Phân quyền, khóa tài khoản</p>
              </div>
            </>
          )}
        </div>

        <div className="dashboard-side">
          <div className="card dashboard-panel">
            <div className="dashboard-panel-head">
              <h3 className="dashboard-panel-title">
                <span className="dashboard-panel-icon dashboard-panel-icon--cyan">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="7" width="20" height="14" rx="2" />
                    <path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16" />
                  </svg>
                </span>
                Dự án đang tham gia
              </h3>
            </div>
            {latestProjects.length > 0 ? (
              <div className="dashboard-proj-list">
                {latestProjects.map((p, i) => (
                  <div key={i} className="dashboard-proj-item">
                    <span className="dashboard-proj-ic">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="2" y="7" width="20" height="14" rx="2" />
                        <path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16" />
                      </svg>
                    </span>
                    <span className="dashboard-proj-item-name">{p}</span>
                    <svg className="dashboard-proj-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  </div>
                ))}
              </div>
            ) : (
              <p className="dashboard-panel-empty">Hiện tại bạn chưa tham gia dự án nào </p>
            )}
          </div>

          <div className="card dashboard-panel">
            <div className="dashboard-panel-head">
              <h3 className="dashboard-panel-title">
                <span className="dashboard-panel-icon dashboard-panel-icon--blue">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                </span>
                Lịch sử nộp báo cáo
              </h3>
              <div className="dashboard-cal-nav">
                <button
                  type="button"
                  className="dashboard-cal-btn"
                  onClick={() => setMonthOffset((m) => m - 1)}
                  aria-label="Tháng trước"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                </button>
                <span className="dashboard-cal-month">{calendar.label}</span>
                <button
                  type="button"
                  className="dashboard-cal-btn"
                  onClick={() => setMonthOffset((m) => Math.min(0, m + 1))}
                  disabled={monthOffset >= 0}
                  aria-label="Tháng sau"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="dashboard-cal-grid">
              {WEEKDAYS.map((w) => (
                <div key={w} className="dashboard-cal-dow">{w}</div>
              ))}
              {calendar.cells.map((c) =>
                c.blank ? (
                  <div key={c.key} className="dashboard-cal-cell" />
                ) : (
                  <div
                    key={c.key}
                    className={`dashboard-cal-cell dashboard-cal-${c.status}${c.isToday ? " dashboard-cal-today" : ""}`}
                  >
                    <span className="dashboard-cal-day">{c.day}</span>
                    {c.status === "submitted" && (
                      <svg className="dashboard-cal-mk dashboard-cal-mk--yes" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                    )}
                    {c.status === "missing" && (
                      <svg className="dashboard-cal-mk dashboard-cal-mk--no" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    )}
                  </div>
                )
              )}
            </div>

            <div className="dashboard-cal-legend">
              <span className="dashboard-cal-leg">
                <i className="dashboard-cal-box dashboard-cal-box--yes">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                </i>
                Đã nộp ({calendar.done})
              </span>
              <span className="dashboard-cal-leg">
                <i className="dashboard-cal-box dashboard-cal-box--no">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                </i>
                Chưa nộp ({calendar.miss})
              </span>
              <span className="dashboard-cal-leg">
                <i className="dashboard-cal-box dashboard-cal-box--off" />
                Ngày nghỉ
              </span>
            </div>
          </div>
        </div>
      </div>
      )}
    </div>
  );
}
