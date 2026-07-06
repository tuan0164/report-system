import { useState, useEffect, useCallback } from "react";
import { getAllReports, getUsers } from "../api/reports";
import { getDynamicColumns } from "../api/dynamicColumns";
import "./AdminReports.css";

// Chỉ còn trường lõi. Trường nghiệp vụ đã thành cột động (lấy từ API, sort theo field_order).
const STATIC_COLUMNS = [
  { key: "id", label: "#", default: true },
  { key: "email", label: "Email", default: true },
  { key: "report_date", label: "Ngày", default: true },
  { key: "employee_code", label: "Mã NV", default: true },
  { key: "full_name", label: "Họ tên", default: true },
  { key: "project", label: "Dự án", default: true },
];

const STORAGE_KEY = "admin_reports_columns";

function loadSavedColumns() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return new Set(JSON.parse(saved));
  } catch {
    /* ignore parse errors */
  }
  return null;
}

function saveColumns(columns) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...columns]));
}

function buildInitialVisible(saved, hiddenDefs) {
  if (saved) return saved;
  const defaults = new Set(STATIC_COLUMNS.filter((c) => c.default).map((c) => c.key));
  hiddenDefs.forEach((name) => defaults.delete(name));
  return defaults;
}

export default function AdminReports() {
  const [reports, setReports] = useState([]);
  const [users, setUsers] = useState([]);
  const [filterEmail, setFilterEmail] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [dynamicColumns, setDynamicColumns] = useState([]);
  const [, setHiddenDefs] = useState([]);
  const [visibleColumns, setVisibleColumns] = useState(() => {
    return buildInitialVisible(loadSavedColumns(), []);
  });

  const fetchReports = useCallback((email, date) => {
    setLoading(true);
    const params = {};
    if (email) params.email = email;
    if (date) params.report_date = date;
    getAllReports(params)
      .then((res) => setReports(res.data))
      .catch(() => setReports([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    getUsers().then((res) => setUsers(res.data)).catch(() => { /* ignored */ });
    getDynamicColumns()
      .then((res) => setDynamicColumns([...res.data].sort((a, b) => a.field_order - b.field_order)))
      .catch(() => { /* ignored */ });
    getDynamicColumns(true)
      .then((res) => {
        const hidden = res.data.filter((d) => !d.is_active).map((d) => d.name);
        setHiddenDefs(hidden);
        if (!loadSavedColumns()) {
          setVisibleColumns(buildInitialVisible(null, hidden));
        }
      })
      .catch(() => { /* ignored */ });
    getAllReports({})
      .then((res) => setReports(res.data))
      .catch(() => setReports([]))
      .finally(() => setLoading(false));
  }, []);

  const handleToggleColumn = (key) => {
    setVisibleColumns((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      saveColumns(next);
      return next;
    });
  };

  const handleSelectAll = () => {
    const all = new Set([
      ...STATIC_COLUMNS.map((c) => c.key),
      ...dynamicColumns.map((c) => c.name),
    ]);
    setVisibleColumns(all);
    saveColumns(all);
  };

  const handleDeselectAll = () => {
    const minimal = new Set(["id", "email", "full_name"]);
    setVisibleColumns(minimal);
    saveColumns(minimal);
  };

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

  const allColumnKeys = [
    ...STATIC_COLUMNS.map((c) => c.key),
    ...dynamicColumns.map((c) => c.name),
  ];

  return (
    <div className="admin-reports-page">
      <div className="admin-reports-header">
        <h1 className="admin-reports-title">Báo cáo tất cả nhân viên</h1>
      </div>

      <div className="card ar-column-selector">
        <div className="ar-column-selector-header">
          <span className="ar-column-selector-title">Hiển thị cột</span>
          <div className="ar-column-selector-actions">
            <button className="btn btn-ghost btn-sm" onClick={handleSelectAll}>
              Chọn tất cả
            </button>
            <button className="btn btn-ghost btn-sm" onClick={handleDeselectAll}>
              Bỏ tất cả
            </button>
          </div>
        </div>
        <div className="ar-column-grid">
          {STATIC_COLUMNS.map((col) => (
            <label key={col.key} className={`ar-column-checkbox${visibleColumns.has(col.key) ? " checked" : ""}`}>
              <input
                type="checkbox"
                checked={visibleColumns.has(col.key)}
                onChange={() => handleToggleColumn(col.key)}
              />
              {col.label}
            </label>
          ))}
        </div>
        {dynamicColumns.length > 0 && (
          <>
            <div className="ar-column-section-title">Cột động</div>
            <div className="ar-column-grid">
              {dynamicColumns.map((col) => (
                <label key={col.name} className={`ar-column-checkbox${visibleColumns.has(col.name) ? " checked" : ""}`}>
                  <input
                    type="checkbox"
                    checked={visibleColumns.has(col.name)}
                    onChange={() => handleToggleColumn(col.name)}
                  />
                  {col.label}
                </label>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="card admin-reports-filter">
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
            <button className="btn btn-primary btn-sm" onClick={() => fetchReports(filterEmail, filterDate)}>
              Lọc
            </button>
            <button className="btn btn-outline btn-sm" onClick={() => { setFilterEmail(""); setFilterDate(""); fetchReports("", ""); }}>
              Bỏ lọc
            </button>
          </div>
        </div>
      </div>

      <div className="card admin-reports-table-card">
        {loading ? (
          <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)" }}>
            <div className="spinner spinner-lg" style={{ margin: "0 auto 1rem" }}></div>
            <p>Đang tải báo cáo...</p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="admin-reports-table">
              <thead>
                <tr>
                  {allColumnKeys
                    .filter((k) => visibleColumns.has(k))
                    .map((k) => (
                      <th key={k} className={isDynamic(k) ? "col-dynamic" : ""}>
                        {isDynamic(k) ? getDynamicLabel(k) : STATIC_COLUMNS.find((c) => c.key === k)?.label || k}
                      </th>
                    ))}
                </tr>
              </thead>
              <tbody>
                {reports.map((r) => (
                  <tr key={r.id}>
                    {allColumnKeys
                      .filter((k) => visibleColumns.has(k))
                      .map((k) => (
                        <td
                          key={k}
                          className={
                            (k === "id" ? "col-id" : "") +
                            (k === "work_summary" || k === "work_detail" || k === "difficulty" || k === "proposal" || k === "tomorrow_plan"
                              ? " col-text"
                              : "") +
                            (isDynamic(k) ? " col-dynamic" : "")
                          }
                        >
                          {formatValue(r[k])}
                        </td>
                      ))}
                  </tr>
                ))}
                {reports.length === 0 && (
                  <tr>
                    <td colSpan={allColumnKeys.filter((k) => visibleColumns.has(k)).length || 1}>
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
      </div>
    </div>
  );
}
