import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/context";
import { getMyReports } from "../api/dailyReport";
import { getUsers, getAllReports } from "../api/reports";
import { getDynamicColumns } from "../api/dynamicColumns";
import "./Dashboard.css";

const WEEKDAYS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
const DOW_FULL = ["Chủ nhật", "Thứ hai", "Thứ ba", "Thứ tư", "Thứ năm", "Thứ sáu", "Thứ bảy"];

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

// Meta cho panel danh sách nhân viên theo từng thẻ số liệu.
const PANEL_META = {
  submitted: { title: "Nhân viên đã nộp hôm nay" },
  not_submitted: { title: "Nhân viên chưa nộp" },
  all: { title: "Tổng nhân viên" },
};
const PANEL_IC_CLASS = {
  submitted: "admin-panel-ic--done",
  not_submitted: "admin-panel-ic--warn",
  all: "admin-panel-ic--brand",
};

// Số nhân viên mỗi trang — lấp đầy lưới 3x4 rồi mới sang trang mới.
const PAGE_SIZE = 12;

// Bỏ dấu để dò nhãn cột động ("Dự định ngày mai") không phụ thuộc cách gõ dấu.
const deaccent = (s) =>
  (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();

const ymd = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [reports, setReports] = useState([]);
  const [users, setUsers] = useState([]); // admin: toàn user
  const [allReports, setAllReports] = useState([]); // admin: toàn report
  const [monthOffset, setMonthOffset] = useState(0); // 0 = tháng hiện tại

  // Panel danh sách nhân viên dưới 3 thẻ. Mặc định "chưa nộp".
  const [panelKind, setPanelKind] = useState("not_submitted"); // submitted | not_submitted | all
  const [panelLoading, setPanelLoading] = useState(false);
  const [page, setPage] = useState(1);

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const [openProjects, setOpenProjects] = useState(() => new Set());
  const [showScrollFab, setShowScrollFab] = useState(false);
  const [columns, setColumns] = useState([]); // cột động, để dò "Dự định ngày mai"

  useEffect(() => {
    if (user?.role !== "ADMIN") return;
    getUsers()
      .then((r) => setUsers(Array.isArray(r.data) ? r.data : []))
      .catch(() => setUsers([]));
    getAllReports()
      .then((r) => setAllReports(Array.isArray(r.data) ? r.data : []))
      .catch(() => setAllReports([]));
  }, [user]);

  useEffect(() => {
    getMyReports()
      .then((res) => setReports(Array.isArray(res.data) ? res.data : []))
      .catch(() => setReports([]));
    getDynamicColumns()
      .then((r) => setColumns(Array.isArray(r.data) ? r.data : []))
      .catch(() => setColumns([]));
  }, []);

  // Dự án của báo cáo gần nhất (rows sort id DESC ở BE -> phần tử [0]).
  const latestProjects = useMemo(() => {
    const p = reports[0]?.project;
    return Array.isArray(p) ? p.filter(Boolean) : [];
  }, [reports]);

  // Tên gọi + ngày cho hero nhân viên.
  // full_name ở report do user tự nhập (đúng thứ tự) -> ưu tiên; lấy chữ cuối làm tên gọi.
  const heroName = useMemo(() => {
    const full = reports[0]?.full_name || user?.full_name || "";
    const parts = full.trim().split(/\s+/).filter(Boolean);
    return parts.length ? parts[parts.length - 1] : "bạn";
  }, [reports, user]);

  const todayLabel = useMemo(() => {
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, "0");
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    return `${DOW_FULL[now.getDay()]}, ${dd}/${mm}/${now.getFullYear()}`;
  }, []);

  // "Kế hoạch hôm nay" = trường "Dự định ngày mai" của báo cáo gần nhất trước hôm nay.
  const todayPlan = useMemo(() => {
    const col = columns.find((c) => {
      const l = deaccent(c.label);
      return l.includes("du dinh") || l.includes("ngay mai");
    });
    if (!col) return null;

    const todayStr = ymd(new Date());
    const prev = reports
      .filter((r) => r.report_date && String(r.report_date).slice(0, 10) < todayStr)
      .sort((a, b) => String(b.report_date).localeCompare(String(a.report_date)))[0];

    const raw = prev?.extra_fields?.[col.name];
    const text = Array.isArray(raw) ? raw.filter(Boolean).join(", ") : raw;
    if (text === null || text === undefined || String(text).trim() === "") return null;
    return { label: col.label, text: String(text), date: String(prev.report_date).slice(0, 10) };
  }, [columns, reports]);

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

    return { cells, label: `Tháng ${month + 1}/${year}`, done, miss };
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

  // Chọn thẻ: fetch mới toàn user + toàn report ngay lúc click (không dùng cache cũ).
  const openPanel = (kind) => {
    setPanelKind(kind);
    setPanelLoading(true);
    Promise.all([getUsers(), getAllReports()])
      .then(([u, r]) => {
        setUsers(Array.isArray(u.data) ? u.data : []);
        setAllReports(Array.isArray(r.data) ? r.data : []);
      })
      .catch(() => {})
      .finally(() => setPanelLoading(false));
  };
  const cardKey = (kind) => (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openPanel(kind);
    }
  };

  // Danh sách nhân viên cho panel — tính từ users + allReports theo thẻ đang chọn.
  const panelList = useMemo(() => {
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

    const employees = users.filter((u) => u.is_active && u.role !== "ADMIN");
    const submittedEmails = new Set(
      allReports
        .filter((r) => r.report_date && String(r.report_date).slice(0, 10) === todayStr)
        .map((r) => r.email)
    );

    // Báo cáo gần nhất mỗi người (đã sort id DESC ở BE) — lấy tên/mã/dự án.
    const seen = new Set();
    const nameByEmail = new Map();
    const codeByEmail = new Map();
    const projByEmail = new Map();
    for (const r of allReports) {
      if (seen.has(r.email)) continue;
      seen.add(r.email);
      if (r.full_name) nameByEmail.set(r.email, r.full_name);
      if (r.employee_code) codeByEmail.set(r.email, r.employee_code);
      projByEmail.set(r.email, Array.isArray(r.project) ? r.project.filter(Boolean) : []);
    }

    const rows = employees.map((u) => ({
      id: u.id,
      email: u.email,
      displayName: nameByEmail.get(u.email) || u.full_name || u.email,
      code: codeByEmail.get(u.email) || u.employee_code || "",
      submitted: submittedEmails.has(u.email),
      projects: projByEmail.get(u.email) || [],
    }));

    let filtered = rows;
    if (panelKind === "submitted") filtered = rows.filter((r) => r.submitted);
    else if (panelKind === "not_submitted") filtered = rows.filter((r) => !r.submitted);
    return filtered.sort((a, b) => a.displayName.localeCompare(b.displayName, "vi"));
  }, [panelKind, users, allReports]);

  const pageCount = Math.max(1, Math.ceil(panelList.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageRows = panelList.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // Đổi thẻ -> về trang 1.
  useEffect(() => setPage(1), [panelKind]);

  // Đóng dropdown khi bấm ra ngoài / bấm Esc.
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    const onKey = (e) => e.key === "Escape" && setMenuOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  // FAB cuộn xuống — chỉ hiện khi trang còn phần chưa nhìn thấy.
  useEffect(() => {
    const onScroll = () => {
      const doc = document.documentElement;
      const rest = doc.scrollHeight - window.innerHeight - window.scrollY;
      setShowScrollFab(rest > 80);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [pageRows.length, adminData.projects.length, openProjects]);

  const toggleProject = (name) =>
    setOpenProjects((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });

  const scrollToBottom = () =>
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" });

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
      {isAdmin ? (
      <>
        <div className="admin-hero">
          <div className="admin-hero-main">
            <span className="admin-hero-role">Quản trị viên</span>
            <h1 className="admin-hero-title">HDC-Flowtech</h1>
            <span className="admin-hero-email">{user.email}</span>
          </div>

          <div className="admin-hero-actions">
            <div className="admin-hero-menu" ref={menuRef}>
              <button
                type="button"
                className="admin-hero-dots"
                aria-label="Menu quản trị"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((v) => !v)}
              >
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="5" cy="12" r="1.7" />
                  <circle cx="12" cy="12" r="1.7" />
                  <circle cx="19" cy="12" r="1.7" />
                </svg>
              </button>

              {menuOpen && (
                <div className="admin-menu-pop" role="menu">
                  <button
                    type="button"
                    role="menuitem"
                    className="admin-menu-item"
                    onClick={() => { setMenuOpen(false); navigate("/admin/columns"); }}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 20h9" />
                      <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
                    </svg>
                    Quản lý trường
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="admin-menu-item"
                    onClick={() => { setMenuOpen(false); navigate("/admin/accounts"); }}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M23 21v-2a4 4 0 00-3-3.87" />
                      <path d="M16 3.13a4 4 0 010 7.75" />
                    </svg>
                    Quản lý tài khoản
                  </button>
                  <div className="admin-menu-sep" />
                  <button
                    type="button"
                    role="menuitem"
                    className="admin-menu-item admin-menu-item--danger"
                    onClick={() => { setMenuOpen(false); logout(); }}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                      <polyline points="16 17 21 12 16 7" />
                      <line x1="21" y1="12" x2="9" y2="12" />
                    </svg>
                    Đăng xuất
                  </button>
                </div>
              )}
            </div>

            <button type="button" className="admin-hero-cta" onClick={() => navigate("/admin/reports")}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
              Xem báo cáo
            </button>
          </div>
        </div>

        <div className="admin-overview">
          <div className="admin-stat-row">
            <div
              className={`card admin-stat admin-stat--done admin-stat--clickable${panelKind === "submitted" ? " is-active" : ""}`}
              role="button"
              tabIndex={0}
              aria-pressed={panelKind === "submitted"}
              onClick={() => openPanel("submitted")}
              onKeyDown={cardKey("submitted")}
            >
              <div className="admin-stat-top">
                <span className="admin-stat-ic">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                </span>
                <span className="admin-stat-label">Đã nộp hôm nay</span>
              </div>
              <span className="admin-stat-num kpi-num">{adminData.doneCount}</span>
            </div>

            <div
              className={`card admin-stat admin-stat--miss admin-stat--clickable${panelKind === "not_submitted" ? " is-active" : ""}`}
              role="button"
              tabIndex={0}
              aria-pressed={panelKind === "not_submitted"}
              onClick={() => openPanel("not_submitted")}
              onKeyDown={cardKey("not_submitted")}
            >
              <div className="admin-stat-top">
                <span className="admin-stat-ic">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                </span>
                <span className="admin-stat-label">Chưa nộp</span>
              </div>
              <span className="admin-stat-num kpi-num">{adminData.notSubmitted.length}</span>
            </div>

            <div
              className={`card admin-stat admin-stat--total admin-stat--clickable${panelKind === "all" ? " is-active" : ""}`}
              role="button"
              tabIndex={0}
              aria-pressed={panelKind === "all"}
              onClick={() => openPanel("all")}
              onKeyDown={cardKey("all")}
            >
              <div className="admin-stat-top">
                <span className="admin-stat-ic">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 00-3-3.87" />
                    <path d="M16 3.13a4 4 0 010 7.75" />
                  </svg>
                </span>
                <span className="admin-stat-label">Tổng nhân viên</span>
              </div>
              <span className="admin-stat-num kpi-num">{adminData.total}</span>
            </div>
          </div>

          <div className={`card admin-panel admin-result-panel${panelLoading ? " is-loading" : ""}`}>
            <div className="admin-panel-head">
              <h3 className="admin-panel-title">
                <span className={`admin-panel-ic ${PANEL_IC_CLASS[panelKind]}`}>
                  {panelKind === "submitted" ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
                      <polyline points="22 4 12 14.01 9 11.01" />
                    </svg>
                  ) : panelKind === "all" ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M23 21v-2a4 4 0 00-3-3.87" />
                      <path d="M16 3.13a4 4 0 010 7.75" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                  )}
                </span>
                {PANEL_META[panelKind].title}
                <span className="admin-panel-count">({panelList.length})</span>
              </h3>
            </div>

            {panelLoading ? (
              <div className="admin-result-loading">
                <div className="spinner spinner-lg"></div>
                <p>Đang tải...</p>
              </div>
            ) : panelList.length === 0 ? (
              <p className="admin-empty">
                {panelKind === "not_submitted"
                  ? "Tất cả nhân viên đã nộp báo cáo hôm nay 🎉"
                  : "Không có nhân viên nào"}
              </p>
            ) : (
              <>
                <div className="emp-grid">
                  {pageRows.map((p) => {
                    const [bg, fg] = avatarTone(p.displayName);
                    return (
                      <div key={p.id} className="emp-chip" title={p.email}>
                        <span className="hdc-avatar emp-chip-av" style={{ background: bg, color: fg }}>
                          {initials(p.displayName)}
                        </span>
                        <div className="emp-chip-body">
                          <span className="emp-chip-name">{p.displayName}</span>
                          <span className="emp-chip-code">
                            {p.code ? `Mã NV: ${p.code}` : "Chưa có mã NV"}
                          </span>
                        </div>
                        {panelKind === "all" && (
                          <span
                            className={`emp-dot emp-dot--${p.submitted ? "done" : "miss"}`}
                            title={p.submitted ? "Đã nộp" : "Chưa nộp"}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="emp-foot">
                  <span className="emp-foot-count">
                    Hiển thị {pageRows.length} / {panelList.length}
                  </span>

                  {pageCount > 1 && (
                    <div className="pager">
                      <button
                        type="button"
                        className="pager-btn"
                        onClick={() => setPage(safePage - 1)}
                        disabled={safePage === 1}
                        aria-label="Trang trước"
                      >
                        ‹
                      </button>
                      {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => (
                        <button
                          key={n}
                          type="button"
                          className={`pager-btn${n === safePage ? " is-active" : ""}`}
                          onClick={() => setPage(n)}
                          aria-current={n === safePage ? "page" : undefined}
                        >
                          {n}
                        </button>
                      ))}
                      <button
                        type="button"
                        className="pager-btn"
                        onClick={() => setPage(safePage + 1)}
                        disabled={safePage === pageCount}
                        aria-label="Trang sau"
                      >
                        ›
                      </button>
                    </div>
                  )}
                </div>
              </>
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
                <span className="admin-panel-count">({adminData.projects.length})</span>
              </h3>
            </div>
            {adminData.projects.length > 0 ? (
              <div className="admin-proj-list">
                {adminData.projects.map((p) => {
                  const open = openProjects.has(p.name);
                  const shown = p.members.slice(0, 3);
                  const rest = p.members.length - shown.length;
                  return (
                    <div key={p.name} className={`admin-proj${open ? " is-open" : ""}`}>
                      <button
                        type="button"
                        className="admin-proj-head"
                        aria-expanded={open}
                        onClick={() => toggleProject(p.name)}
                      >
                        <span className="admin-proj-name">{p.name}</span>
                        <span className="avatar-stack">
                          {shown.map((m, i) => {
                            const [bg, fg] = avatarTone(m.name);
                            return (
                              <span
                                key={i}
                                className="hdc-avatar avatar-stack-av"
                                style={{ background: bg, color: fg }}
                                title={m.name}
                              >
                                {initials(m.name)}
                              </span>
                            );
                          })}
                          {rest > 0 && (
                            <span className="hdc-avatar avatar-stack-av avatar-stack-more">+{rest}</span>
                          )}
                        </span>
                        <span className="admin-proj-count">{p.members.length} người</span>
                      </button>

                      {open && (
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
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="admin-empty">Chưa có dự án nào</p>
            )}
          </div>
        </div>
      </>
      ) : (
      <div className="user-layout">
        <div className="user-hero">
          <div className="user-hero-main">
            <span className="user-hero-role">Nhân viên</span>
            <h1 className="user-hero-title">Chào {heroName}, hôm nay thế nào?</h1>
            <span className="user-hero-date">{todayLabel}</span>
          </div>
          <span className="user-hero-avatar">{heroName.charAt(0).toUpperCase()}</span>
        </div>

        <div className="user-cards">
          <button
            type="button"
            className={`card user-card user-card--report ${submittedToday ? "is-done" : "is-todo"}`}
            onClick={() => navigate("/report")}
          >
            <div className="user-card-head">
              <span className="user-card-ic">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </span>
              <span className="user-card-title">Báo cáo hôm nay</span>
              <span className="user-card-pill">
                <span className="user-card-dot" />
                {submittedToday ? "Đã nộp" : "Chưa nộp"}
              </span>
            </div>
            <p className="user-card-desc">
              {submittedToday
                ? "Bạn đã nộp hôm nay — bấm để chỉnh sửa"
                : "Bấm để điền báo cáo công việc hôm nay"}
            </p>
          </button>

          <div className="card user-card user-card--plan">
            <div className="user-card-head">
              <span className="user-card-ic">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </span>
              <span className="user-card-title">Kế hoạch hôm nay</span>
            </div>
            <p className="user-card-desc">
              {todayPlan ? todayPlan.text : "Chưa có dự định nào từ báo cáo trước"}
            </p>
          </div>
        </div>

        <div className="card user-panel">
          <div className="user-panel-head">
            <h3 className="user-panel-title">
              <span className="user-panel-ic">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="7" width="20" height="14" rx="2" />
                  <path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16" />
                </svg>
              </span>
              Dự án đang tham gia
            </h3>
          </div>

          {latestProjects.length > 0 ? (
            <div className="user-proj-list">
              {latestProjects.map((p, i) => (
                <div key={i} className="user-proj-row">
                  <span className="user-proj-name">{p}</span>
                  <svg className="user-proj-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                </div>
              ))}
            </div>
          ) : (
            <p className="admin-empty">Hiện tại bạn chưa tham gia dự án nào</p>
          )}
        </div>

        <div className="card user-panel">
          <div className="user-panel-head">
            <h3 className="user-panel-title">
              <span className="user-panel-ic">
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
                </div>
              )
            )}
          </div>

          <div className="dashboard-cal-legend">
            <span className="dashboard-cal-leg">
              <i className="dashboard-cal-box dashboard-cal-box--yes" />
              Đã nộp ({calendar.done})
            </span>
            <span className="dashboard-cal-leg">
              <i className="dashboard-cal-box dashboard-cal-box--no" />
              Chưa nộp ({calendar.miss})
            </span>
            <span className="dashboard-cal-leg">
              <i className="dashboard-cal-box dashboard-cal-box--off" />
              Ngày nghỉ
            </span>
          </div>
        </div>
      </div>
      )}

      {showScrollFab && (
        <button type="button" className="scroll-fab" onClick={scrollToBottom} aria-label="Cuộn xuống cuối trang">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <polyline points="19 12 12 19 5 12" />
          </svg>
        </button>
      )}
    </div>
  );
}
