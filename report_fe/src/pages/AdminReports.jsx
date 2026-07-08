import { useState, useEffect, useCallback, useRef, useLayoutEffect } from "react";
import { getAllReports, getUsers } from "../api/reports";
import { getDynamicColumns } from "../api/dynamicColumns";
import "./AdminReports.css";

// Chỉ còn trường lõi. Trường nghiệp vụ đã thành cột động (lấy từ API, sort theo field_order).
// Cột "email" giờ là cột định danh NV: trên là "full_name - mã NV", dưới là email in nhạt.
// full_name + employee_code không còn cột riêng — đã gộp vào cột này.
const STATIC_COLUMNS = [
  { key: "id", label: "#", default: true },
  { key: "email", label: "Nhân viên", default: true },
  { key: "report_date", label: "Ngày", default: true },
  { key: "project", label: "Dự án", default: true },
];

// Cột luôn hiện dù rỗng (để bảng không trống trơn).
const ALWAYS_VISIBLE = ["id", "email"];

// Cặp cột gộp: 2 giá trị xếp trên/dưới trong 1 ô. Chỉ gộp khi CẢ 2 cùng hiện;
// nếu chỉ 1 cột bật thì render như cột đơn bình thường.
const MERGE_GROUPS = [
  { members: ["start_time", "end_time"] },
  { members: ["planned_work_time", "actual_hours"] },
];

// Cột số/giờ → mono, canh phải (không bóp width theo dữ liệu nữa).
const NUMERIC_COLUMNS = new Set(["planned_work_time", "actual_hours", "start_time", "end_time"]);

// Cột text dài → cho xuống dòng, hiện đủ, giới hạn bề rộng.
const TEXT_COLUMNS = new Set(["work_summary", "work_detail", "difficulty", "proposal", "tomorrow_plan"]);

// Ngày hôm nay theo local, dạng YYYY-MM-DD.
function todayStr() {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d - tz).toISOString().slice(0, 10);
}

function hasData(v) {
  if (v === null || v === undefined || v === "") return false;
  if (Array.isArray(v)) return v.length > 0;
  return true;
}

// PA A: tính cột hiển thị từ dữ liệu — cột nào có ít nhất 1 dòng có data thì hiện.
function computeVisibleFromData(reports, dynamicColumns) {
  const keys = [...STATIC_COLUMNS.map((c) => c.key), ...dynamicColumns.map((c) => c.name)];
  const visible = new Set(ALWAYS_VISIBLE);
  keys.forEach((k) => {
    if (reports.some((r) => hasData(r[k]))) visible.add(k);
  });
  return visible;
}

export default function AdminReports() {
  const [reports, setReports] = useState([]);
  const [users, setUsers] = useState([]);
  const [filterEmail, setFilterEmail] = useState("");
  const [filterDate, setFilterDate] = useState(todayStr());
  const [loading, setLoading] = useState(true);
  const [dynamicColumns, setDynamicColumns] = useState([]);
  const [visibleColumns, setVisibleColumns] = useState(() => new Set(ALWAYS_VISIBLE));
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);

  const scrollRef = useRef(null);
  const barRef = useRef(null);
  const filterPanelRef = useRef(null);
  const [tableWidth, setTableWidth] = useState(0);

  const syncFromScroll = () => {
    if (scrollRef.current && barRef.current) barRef.current.scrollLeft = scrollRef.current.scrollLeft;
  };
  const syncFromBar = () => {
    if (scrollRef.current && barRef.current) scrollRef.current.scrollLeft = barRef.current.scrollLeft;
  };

  // Giữ dữ liệu mới nhất để tính lại cột khi reports hoặc cột động đổi (tránh setState đồng bộ trong effect).
  const reportsRef = useRef([]);
  const dynColsRef = useRef([]);

  // PA A: gán reports + tự tính cột hiển thị theo data, đè lựa chọn cũ.
  const applyReports = useCallback((data) => {
    reportsRef.current = data;
    setReports(data);
    setVisibleColumns(computeVisibleFromData(data, dynColsRef.current));
  }, []);

  const fetchReports = useCallback((email, date) => {
    setLoading(true);
    const params = {};
    if (email) params.email = email;
    if (date) params.report_date = date;
    getAllReports(params)
      .then((res) => applyReports(res.data))
      .catch(() => applyReports([]))
      .finally(() => setLoading(false));
  }, [applyReports]);

  useEffect(() => {
    getUsers().then((res) => setUsers(res.data)).catch(() => { /* ignored */ });
    getDynamicColumns()
      .then((res) => {
        const sorted = [...res.data].sort((a, b) => a.field_order - b.field_order);
        dynColsRef.current = sorted;
        setDynamicColumns(sorted);
        // Cột động có thể về sau reports → tính lại cột hiển thị theo reports hiện có.
        setVisibleColumns(computeVisibleFromData(reportsRef.current, sorted));
      })
      .catch(() => { /* ignored */ });
    // Mặc định: chỉ load báo cáo hôm nay (loading đã true sẵn nên không setState đồng bộ ở đây).
    getAllReports({ report_date: todayStr() })
      .then((res) => applyReports(res.data))
      .catch(() => applyReports([]))
      .finally(() => setLoading(false));
  }, [applyReports]);

  // Panel lọc: đóng bằng Esc hoặc click ra ngoài.
  useEffect(() => {
    if (!filterPanelOpen) return;
    const onKey = (e) => { if (e.key === "Escape") setFilterPanelOpen(false); };
    const onClick = (e) => {
      if (filterPanelRef.current && !filterPanelRef.current.contains(e.target)) setFilterPanelOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [filterPanelOpen]);

  const getDynamicLabel = (key) => {
    const d = dynamicColumns.find((c) => c.name === key);
    return d ? d.label : key;
  };

  const isDynamic = (key) => dynamicColumns.some((c) => c.name === key);

  const formatValue = (value) => {
    if (value === null || value === undefined) return "—";
    if (Array.isArray(value)) return value.join(", ");
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  };

  // Ngày YYYY-MM-DD -> DD/MM/YYYY.
  const formatDate = (value) => {
    if (value === null || value === undefined) return "—";
    const m = String(value).slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m ? `${m[3]}/${m[2]}/${m[1]}` : formatValue(value);
  };

  // Cột "Nhân viên": tên (đậm) / "Mã NV : xxx" (thường) / email (nhạt).
  const employeeCodeLabel = (r) => (r.employee_code ? `Mã NV : ${r.employee_code}` : "");

  const allColumnKeys = [
    ...STATIC_COLUMNS.map((c) => c.key),
    ...dynamicColumns.map((c) => c.name),
  ];

  const visibleKeys = allColumnKeys.filter((k) => visibleColumns.has(k));
  const activeFilterCount = (filterEmail ? 1 : 0) + (filterDate ? 1 : 0);

  // Danh sách "đơn vị cột" để render: cột đơn hoặc cặp gộp (khi cả 2 thành viên cùng hiện).
  const renderUnits = (() => {
    const units = [];
    const consumed = new Set();
    for (const k of visibleKeys) {
      if (consumed.has(k)) continue;
      const group = MERGE_GROUPS.find((g) => g.members.includes(k));
      if (group && group.members.every((m) => visibleColumns.has(m))) {
        units.push({ type: "merged", group });
        group.members.forEach((m) => consumed.add(m));
      } else {
        units.push({ type: "single", key: k });
      }
    }
    return units;
  })();

  const colClass = (k) =>
    (k === "id" ? "col-id" : "") +
    (k === "email" ? " col-email" : "") +
    (TEXT_COLUMNS.has(k) ? " col-text" : "") +
    (isDynamic(k) ? " col-dynamic" : "") +
    (NUMERIC_COLUMNS.has(k) ? " col-num" : "");

  const singleLabel = (k) =>
    isDynamic(k) ? getDynamicLabel(k) : STATIC_COLUMNS.find((c) => c.key === k)?.label || k;

  useLayoutEffect(() => {
    const table = scrollRef.current?.querySelector("table");
    setTableWidth(table ? table.offsetWidth : 0);
  }, [reports, visibleColumns, dynamicColumns, loading]);

  return (
    <div className="admin-reports-page">
      <div className="admin-reports-header">
        <h1 className="admin-reports-title">Báo cáo tất cả nhân viên</h1>
      </div>

      <div className="ar-toolbar">
        <div className="ar-filter-selector" ref={filterPanelRef}>
          <button
            className={`btn btn-outline btn-sm ar-filter-btn${filterPanelOpen ? " active" : ""}`}
            onClick={() => setFilterPanelOpen((o) => !o)}
          >
            <span className="ar-filter-btn-icon">⚲</span>
            Lọc
            {activeFilterCount > 0 && <span className="ar-filter-count">{activeFilterCount}</span>}
            <span className="ar-filter-caret">{filterPanelOpen ? "▲" : "▼"}</span>
          </button>
          {filterPanelOpen && (
            <div className="ar-filter-panel">
              <div className="admin-reports-filter-grid">
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Nhân viên</label>
                  <select
                    value={filterEmail}
                    onChange={(e) => setFilterEmail(e.target.value)}
                    className="form-select"
                  >
                    <option value="">Tất cả</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.email}>
                        {u.full_name} ({u.email})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Ngày</label>
                  <input
                    type="date"
                    value={filterDate}
                    onChange={(e) => setFilterDate(e.target.value)}
                    className="form-input"
                  />
                </div>
                <div className="admin-reports-filter-actions">
                  <button className="btn btn-primary btn-sm" onClick={() => { fetchReports(filterEmail, filterDate); setFilterPanelOpen(false); }}>
                    Lọc
                  </button>
                  <button className="btn btn-outline btn-sm" onClick={() => { setFilterEmail(""); setFilterDate(""); fetchReports("", ""); }}>
                    Bỏ lọc
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="card admin-reports-table-card">
        {loading ? (
          <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)" }}>
            <div className="spinner spinner-lg" style={{ margin: "0 auto 1rem" }}></div>
            <p>Đang tải báo cáo...</p>
          </div>
        ) : (
          <div className="admin-reports-scroll" ref={scrollRef} onScroll={syncFromScroll}>
            <table className="admin-reports-table">
              <thead>
                <tr>
                  {renderUnits.map((u) =>
                    u.type === "merged" ? (
                      <th key={u.group.members.join("+")} className="col-dynamic col-stacked">
                        <div className="ar-stack">
                          <span>{getDynamicLabel(u.group.members[0])}</span>
                          <span>{getDynamicLabel(u.group.members[1])}</span>
                        </div>
                      </th>
                    ) : (
                      <th key={u.key} className={colClass(u.key)}>
                        {singleLabel(u.key)}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {reports.map((r) => (
                  <tr key={r.id}>
                    {renderUnits.map((u) =>
                      u.type === "merged" ? (
                        <td key={u.group.members.join("+")} className="col-dynamic col-stacked">
                          <div className="ar-stack">
                            <span>{formatValue(r[u.group.members[0]])}</span>
                            <span>{formatValue(r[u.group.members[1]])}</span>
                          </div>
                        </td>
                      ) : (
                        <td key={u.key} className={colClass(u.key)}>
                          {u.key === "email" ? (
                            <div className="ar-email-cell">
                              {r.full_name ? <span className="ar-emp-name">{r.full_name}</span> : null}
                              {employeeCodeLabel(r) ? <span className="ar-emp-code">{employeeCodeLabel(r)}</span> : null}
                              <span className="ar-emp-mail">{formatValue(r.email)}</span>
                            </div>
                          ) : u.key === "report_date" ? (
                            formatDate(r[u.key])
                          ) : (
                            formatValue(r[u.key])
                          )}
                        </td>
                      )
                    )}
                  </tr>
                ))}
                {reports.length === 0 && (
                  <tr>
                    <td colSpan={renderUnits.length || 1}>
                      <div className="empty-state">
                        <span className="empty-state-icon">📋</span>
                        <p className="empty-state-text">Không có báo cáo nào</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        {!loading && (
          <div className="admin-reports-hbar" ref={barRef} onScroll={syncFromBar}>
            <div className="admin-reports-hbar-spacer" style={{ width: tableWidth }} />
          </div>
        )}
      </div>
    </div>
  );
}
