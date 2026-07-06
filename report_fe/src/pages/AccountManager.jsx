import { useState, useEffect, useMemo } from "react";
import api from "../api/client";
import { getUsers, updateUserRole, updateUserActive, getAllReports } from "../api/reports";
import ReportCalendar from "../components/ReportCalendar";
import "./AccountManager.css";

export default function AccountManager() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [meId, setMeId] = useState(null);
  const [busy, setBusy] = useState(null); // id đang xử lý
  const [error, setError] = useState("");

  // Modal lịch sử nộp báo cáo
  const [historyUser, setHistoryUser] = useState(null); // user đang xem
  const [historyReports, setHistoryReports] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const openHistory = (u) => {
    setHistoryUser(u);
    setHistoryReports([]);
    setHistoryLoading(true);
    getAllReports({ email: u.email })
      .then((res) => setHistoryReports(Array.isArray(res.data) ? res.data : []))
      .catch(() => setHistoryReports([]))
      .finally(() => setHistoryLoading(false));
  };

  const closeHistory = () => setHistoryUser(null);

  const load = () => {
    setLoading(true);
    getUsers()
      .then((res) => setUsers(res.data))
      .catch(() => setUsers([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    api.get("/users/me").then((res) => setMeId(String(res.data.sub))).catch(() => {});
    load();
  }, []);

  const getErr = (e) => {
    const d = e?.response?.data?.detail;
    if (Array.isArray(d)) return d[0]?.msg || "Lỗi";
    return d || "Có lỗi xảy ra";
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => (u.full_name || "").toLowerCase().includes(q));
  }, [users, search]);

  const isSelf = (u) => meId !== null && String(u.id) === meId;

  const handleRole = (u, role) => {
    if (role === u.role) return;
    setBusy(u.id);
    setError("");
    updateUserRole(u.id, role)
      .then((res) => setUsers((prev) => prev.map((x) => (x.id === u.id ? res.data : x))))
      .catch((e) => setError(getErr(e)))
      .finally(() => setBusy(null));
  };

  const handleActive = (u) => {
    setBusy(u.id);
    setError("");
    updateUserActive(u.id, !u.is_active)
      .then((res) => setUsers((prev) => prev.map((x) => (x.id === u.id ? res.data : x))))
      .catch((e) => setError(getErr(e)))
      .finally(() => setBusy(null));
  };

  return (
    <div className="acc-page">
      <div className="acc-header">
        <h1 className="acc-title">Quản lý tài khoản</h1>
      </div>

      <div className="card acc-toolbar">
        <div className="form-group" style={{ margin: 0, flex: 1 }}>
          <label className="form-label">Tìm theo họ tên</label>
          <input
            type="text"
            className="form-input"
            placeholder="Nhập họ tên..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="acc-count">{filtered.length} tài khoản</div>
      </div>

      {error && <div className="alert alert-error acc-alert">{error}</div>}

      <div className="card acc-table-card">
        {loading ? (
          <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)" }}>
            <div className="spinner spinner-lg" style={{ margin: "0 auto 1rem" }}></div>
            <p>Đang tải tài khoản...</p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="acc-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Họ tên</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Trạng thái</th>
                  <th>Vô hiệu hóa</th>
                  <th>Lịch sử</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => (
                  <tr key={u.id} className={u.is_active ? "" : "acc-row-disabled"}>
                    <td className="acc-col-id">{u.id}</td>
                    <td>
                      {u.full_name}
                      {isSelf(u) && <span className="acc-badge-self">bạn</span>}
                    </td>
                    <td className="acc-col-email">{u.email}</td>
                    <td>
                      <select
                        className="form-select acc-role-select"
                        value={u.role}
                        disabled={isSelf(u) || busy === u.id}
                        onChange={(e) => handleRole(u, e.target.value)}
                        title={isSelf(u) ? "Không thể tự đổi role của mình" : ""}
                      >
                        <option value="USER">User</option>
                        <option value="ADMIN">Admin</option>
                      </select>
                    </td>
                    <td>
                      <span className={`acc-status ${u.is_active ? "acc-status-on" : "acc-status-off"}`}>
                        {u.is_active ? "Hoạt động" : "Đã khóa"}
                      </span>
                    </td>
                    <td>
                      <label
                        className={`acc-switch${isSelf(u) ? " acc-switch-disabled" : ""}`}
                        title={isSelf(u) ? "Không thể tự vô hiệu hóa mình" : ""}
                      >
                        <input
                          type="checkbox"
                          checked={!u.is_active}
                          disabled={isSelf(u) || busy === u.id}
                          onChange={() => handleActive(u)}
                        />
                        <span className="acc-switch-slider"></span>
                      </label>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="acc-history-btn"
                        onClick={() => openHistory(u)}
                        title="Xem lịch sử nộp báo cáo"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="4" width="18" height="18" rx="2" />
                          <line x1="16" y1="2" x2="16" y2="6" />
                          <line x1="8" y1="2" x2="8" y2="6" />
                          <line x1="3" y1="10" x2="21" y2="10" />
                        </svg>
                        Xem
                      </button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7}>
                      <div className="empty-state">
                        <span className="empty-state-icon">👤</span>
                        <p className="empty-state-text">Không tìm thấy tài khoản</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {historyUser && (
        <div className="acc-modal-overlay" onClick={closeHistory}>
          <div className="acc-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="acc-modal-head">
              <div>
                <h2 className="acc-modal-title">Lịch sử nộp báo cáo</h2>
                <p className="acc-modal-sub">
                  {historyUser.full_name} · {historyUser.email}
                </p>
              </div>
              <button
                type="button"
                className="acc-modal-close"
                onClick={closeHistory}
                aria-label="Đóng"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {historyLoading ? (
              <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)" }}>
                <div className="spinner spinner-lg" style={{ margin: "0 auto 1rem" }}></div>
                <p>Đang tải lịch sử...</p>
              </div>
            ) : (
              <ReportCalendar reports={historyReports} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
