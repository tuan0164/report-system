import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/client";
import { submitReport, updateReport, getMyReports } from "../api/dailyReport";
import { getFieldOptions } from "../api/fieldOptions";
import { getDynamicColumns } from "../api/dynamicColumns";
import "./DailyReportForm.css";

const getToday = () => {
  const d = new Date();
  return d.getFullYear() + "-" +
    String(d.getMonth() + 1).padStart(2, "0") + "-" +
    String(d.getDate()).padStart(2, "0");
};

const renderDynamicInput = (col, value, onChange) => {
  switch (col.data_type) {
    case "text":
      return <input type="text" name={col.name} value={value} onChange={onChange} placeholder={`Nhập ${col.label}`} className="report-input" />;
    case "textarea":
      return <textarea name={col.name} value={value} onChange={onChange} placeholder={`Nhập ${col.label}`} rows={3} className="report-textarea" />;
    case "integer":
      return <input type="number" step="1" name={col.name} value={value} onChange={onChange} placeholder={`Nhập ${col.label}`} className="report-input" />;
    case "number":
      return <input type="number" step="0.01" name={col.name} value={value} onChange={onChange} placeholder={`Nhập ${col.label}`} className="report-input" />;
    case "boolean":
      return (
        <label className="report-checkbox-toggle">
          <input type="checkbox" name={col.name} checked={value === true} onChange={(e) => onChange({ target: { name: col.name, value: e.target.checked } })} />
          <span>Có</span>
        </label>
      );
    case "date":
      return <input type="date" name={col.name} value={value} onChange={onChange} className="report-input report-input--time" />;
    case "time":
      return <input type="time" name={col.name} value={value} onChange={onChange} className="report-input report-input--time" />;
    case "datetime":
      return <input type="datetime-local" name={col.name} value={value} onChange={onChange} className="report-input" />;
    case "array":
      return <textarea name={col.name} value={value} onChange={onChange} placeholder="Nhập mỗi mục một dòng" rows={3} className="report-textarea" />;
    case "jsonb":
      return <textarea name={col.name} value={value} onChange={onChange} placeholder='Nhập JSON (VD: {"key": "value"})' rows={4} className="report-textarea" style={{ fontFamily: "var(--font-mono)", fontSize: "0.8125rem" }} />;
    default:
      return <input type="text" name={col.name} value={value} onChange={onChange} className="report-input" />;
  }
};

// Chỉ còn trường lõi. Các trường nghiệp vụ đã thành cột động (render tự động).
const baseForm = {
  report_date: getToday(),
  employee_code: "",
  full_name: "",
  project: [],
};

export default function DailyReportForm() {
  const navigate = useNavigate();
  const [form, setForm] = useState(baseForm);
  const [userEmail, setUserEmail] = useState("");
  const [user, setUser] = useState(null);
  const [projectOptions, setProjectOptions] = useState([]);
  const [optionsMap, setOptionsMap] = useState({});
  const [dynamicColumns, setDynamicColumns] = useState([]);
  const [hiddenSet, setHiddenSet] = useState(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [missingFields, setMissingFields] = useState(new Set()); // tên trường bắt buộc còn trống
  const [editId, setEditId] = useState(null);       // id báo cáo hôm nay đang sửa (null = tạo mới)
  const [todayReport, setTodayReport] = useState(null); // dữ liệu báo cáo hôm nay để prefill
  const [checkFailed, setCheckFailed] = useState(false); // không kiểm tra được báo cáo hôm nay

  useEffect(() => {
    api.get("/users/me").then((res) => {
      setUser(res.data);
      setUserEmail(res.data.email);
      // Mã nhân viên = cụm số cuối local-part email (vd "tuanbv51" -> "51"), giữ số 0 đầu. Prefill khi trống.
      const localPart = (res.data.email || "").split("@")[0];
      const empCode = localPart.match(/\d+$/)?.[0] || localPart;
      setForm((f) => ({
        ...f,
        employee_code: f.employee_code || empCode,
        full_name: f.full_name || (res.data.full_name || ""),
      }));
    }).catch(() => { /* ignored */ });

    // Báo cáo của tôi: nếu đã có báo cáo HÔM NAY -> chuyển sang chế độ sửa (prefill).
    // Không có -> lấy họ tên từ báo cáo gần nhất làm gợi ý (vẫn sửa được).
    getMyReports()
      .then((res) => {
        setCheckFailed(false);
        const rows = res.data || [];
        const todayStr = getToday();
        const mine = rows.find((r) => (r.report_date || "").slice(0, 10) === todayStr);
        if (mine) {
          setEditId(mine.id);
          setTodayReport(mine);
          setForm((f) => ({ ...f, full_name: mine.full_name || f.full_name }));
        } else if (rows[0] && rows[0].full_name) {
          setForm((f) => ({ ...f, full_name: rows[0].full_name }));
        }
      })
      // Không nuốt lỗi: nếu không tải được báo cáo hôm nay, không biết đang tạo hay sửa
      // -> cảnh báo, tránh submit mù rồi dính 409.
      .catch(() => setCheckFailed(true));

    // Danh sách chọn cho mọi trường array (project + cột động array)
    getFieldOptions()
      .then((res) => {
        const map = {};
        res.data.forEach((o) => { (map[o.column_name] ||= []).push(o.value); });
        setOptionsMap(map);
        setProjectOptions(map.project || []);
      })
      .catch(() => { /* ignored */ });

    getDynamicColumns()
      .then((res) => {
        const sorted = res.data.sort((a, b) => a.field_order - b.field_order);
        setDynamicColumns(sorted);
        const defaults = {};
        sorted.forEach((col) => {
          defaults[col.name] = col.data_type === "boolean" ? false
            : col.data_type === "array" ? [] : "";
        });
        setForm((f) => ({ ...f, ...defaults }));
      })
      .catch(() => { /* ignored */ });

    getDynamicColumns(true)
      .then((res) => setHiddenSet(new Set(res.data.filter((d) => !d.is_active).map((d) => d.name))))
      .catch(() => { /* ignored */ });
  }, []);

  // Prefill form từ báo cáo hôm nay khi đã có (chờ dynamicColumns tải xong để map đúng kiểu).
  useEffect(() => {
    if (!todayReport) return;
    setForm((f) => {
      const next = { ...f };
      next.employee_code = todayReport.employee_code ?? f.employee_code;
      next.full_name = todayReport.full_name ?? f.full_name;
      next.project = Array.isArray(todayReport.project) ? todayReport.project : [];
      dynamicColumns.forEach((col) => {
        const v = todayReport[col.name];
        if (col.data_type === "array") next[col.name] = Array.isArray(v) ? v : [];
        else if (col.data_type === "boolean") next[col.name] = v === true;
        else next[col.name] = v ?? "";
      });
      return next;
    });
  }, [todayReport, dynamicColumns]);

  // Bỏ đánh dấu "còn trống" cho trường vừa được nhập
  const clearMissing = (name) => setMissingFields((s) => {
    if (!s.has(name)) return s;
    const n = new Set(s); n.delete(name); return n;
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
    clearMissing(name);
  };

  const handleProjectToggle = (proj) => handleArrayToggle("project", proj);

  // Tích/bỏ tích 1 phần tử của trường array bất kỳ
  const handleArrayToggle = (name, val) => {
    clearMissing(name);
    setForm((f) => {
      const cur = Array.isArray(f[name]) ? f[name] : [];
      return cur.includes(val)
        ? { ...f, [name]: cur.filter((x) => x !== val) }
        : { ...f, [name]: [...cur, val] };
    });
  };

  const handleClear = () => {
    const reset = { ...baseForm };
    dynamicColumns.forEach((col) => {
      reset[col.name] = col.data_type === "boolean" ? false
        : col.data_type === "array" ? [] : "";
    });
    setForm(reset);
    setError("");
    setMissingFields(new Set());
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    // Kiểm tra trường bắt buộc:
    //  - Trường cố định: luôn bắt buộc, trừ khi bị ẩn.
    //  - Trường động: bắt buộc khi def.required = true.
    const missing = [];   // label để nhắc người dùng
    const miss = new Set(); // name để tô đỏ ô

    const flag = (name, label) => { missing.push(label); miss.add(name); };

    if (!form.employee_code) flag("employee_code", "Mã nhân viên");
    if (!form.full_name) flag("full_name", "Họ và Tên");
    if (!hiddenSet.has("project") && form.project.length === 0) flag("project", "Dự án");

    dynamicColumns.forEach((col) => {
      if (!col.required) return;
      const val = form[col.name];
      let empty;
      if (col.data_type === "array") empty = !(Array.isArray(val) && val.length > 0);
      else if (col.data_type === "boolean") empty = false; // boolean luôn có giá trị
      else empty = val === "" || val === null || val === undefined;
      if (empty) flag(col.name, col.label);
    });

    if (missing.length > 0) {
      setMissingFields(miss);
      setError(`Vui lòng điền các trường bắt buộc: ${missing.join(", ")}.`);
      return;
    }
    setMissingFields(new Set());

    setSubmitting(true);
    try {
      const dynamicValues = {};
      dynamicColumns.forEach((col) => {
        const val = form[col.name];
        if (col.data_type === "array") {
          if (Array.isArray(val) && val.length > 0) dynamicValues[col.name] = val;
        } else if (val !== "" && val !== null && val !== undefined) {
          dynamicValues[col.name] = col.data_type === "boolean" ? (val ? true : false) : val;
        }
      });

      // Chỉ gửi trường đang hiển thị (không ẩn). Trường ẩn: không gửi, không lưu.
      // report_date luôn = hôm nay (server cũng tự ép).
      const payload = {
        report_date: getToday(),
        employee_code: form.employee_code,
        full_name: form.full_name,
        ...dynamicValues,
      };
      if (!hiddenSet.has("project")) payload.project = form.project.length > 0 ? form.project : null;

      const res = editId
        ? await updateReport(editId, payload)
        : await submitReport(payload);
      if (res?.data?.id) setEditId(res.data.id); // tạo mới xong -> chuyển sang chế độ sửa
      setSubmitted(true);
    } catch (err) {
      const status = err?.response?.status;
      const detail = err?.response?.data?.detail;
      setError(
        status === 409 && typeof detail === "string" ? detail
          : editId ? "Cập nhật báo cáo thất bại. Vui lòng thử lại."
            : "Gửi báo cáo thất bại. Vui lòng thử lại."
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="report-page">
        <div className="card report-success">
          <div className="report-success-circle">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>
          <h2 className="report-success-title">Đã lưu báo cáo!</h2>
          <p className="report-success-desc">Mỗi ngày 1 báo cáo. Bạn có thể chỉnh sửa báo cáo hôm nay bất cứ lúc nào trong ngày.</p>
          <div className="report-success-actions">
            <button className="btn btn-primary btn-lg" onClick={() => setSubmitted(false)}>
              Chỉnh sửa báo cáo
            </button>
            <button className="btn btn-outline btn-lg" onClick={() => navigate("/dashboard")}>
              Về Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="report-page fade-in">
      <div className="card report-header-card">
        <div className="report-header-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </svg>
        </div>
        <h1 className="report-title">BÁO CÁO CÔNG VIỆC HÀNG NGÀY</h1>
        <p className="report-subtitle">日次作業報告</p>
        <div className="report-meta-row">
          <span className="report-meta-badge"><span className="dot dot-required" /> Bắt buộc</span>
          <span className="report-meta-badge"><span className="dot dot-optional" /> Tùy chọn</span>
          <span className="report-meta-badge">{user ? user.full_name : "—"} · {userEmail || "Đang tải..."}</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="report-form">

        {checkFailed && (
          <div className="report-error" style={{ marginBottom: "1rem" }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            Không kiểm tra được báo cáo hôm nay. Có thể bạn đã gửi rồi — hãy tải lại trước khi gửi để tránh trùng.
            <button type="button" className="btn btn-outline" style={{ marginLeft: "auto" }} onClick={() => window.location.reload()}>Tải lại</button>
          </div>
        )}

        {editId && (
          <div className="alert alert-info" style={{ marginBottom: "1rem" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            Bạn đã gửi báo cáo hôm nay. Đang chỉnh sửa báo cáo đã gửi.
          </div>
        )}

        <div className="report-section">
          <div className="report-section-header">
            <div className="report-section-icon section-icon--blue">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" />
              </svg>
            </div>
            <span className="report-section-title">Thông tin cá nhân</span>
          </div>

          <div className="card report-info-grid">
            <div className="report-info-item">
              <label className="report-field-label">Email <span className="label-required">* Bắt buộc</span></label>
              <div className="report-static-value">
                <svg className="email-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" />
                </svg>
                {userEmail || "Đang tải..."}
              </div>
            </div>
            <div className="report-info-item">
              <label className="report-field-label">Ngày báo cáo <span className="label-optional">Hôm nay</span></label>
              <div className="report-static-value">
                <svg className="email-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                {new Date().toLocaleDateString("vi-VN")}
              </div>
            </div>
            <div className="report-info-item">
              <label className="report-field-label">Mã nhân viên <span className="label-required">* Bắt buộc</span></label>
              <input type="text" name="employee_code" value={form.employee_code} onChange={handleChange} placeholder="Nhập mã nhân viên" className={`report-input${missingFields.has("employee_code") ? " report-field--missing" : ""}`} />
            </div>
            <div className="report-info-item">
              <label className="report-field-label">Họ và Tên <span className="label-required">* Bắt buộc</span></label>
              <input type="text" name="full_name" value={form.full_name} onChange={handleChange} placeholder="Nhập họ và tên" className={`report-input${missingFields.has("full_name") ? " report-field--missing" : ""}`} />
            </div>
          </div>
        </div>

        {!hiddenSet.has("project") && (
        <div className="report-section">
          <div className="report-section-header">
            <div className="report-section-icon section-icon--green">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="9" y1="21" x2="9" y2="9" />
              </svg>
            </div>
            <span className="report-section-title">Dự án</span>
          </div>

          <div className={`card report-field-card report-field-card--last${missingFields.has("project") ? " report-field--missing" : ""}`}>
            <label className="report-field-label">Dự án <span className="label-required">* Bắt buộc</span></label>
            <p className="report-field-hint">Chọn dự án bạn đã làm việc trong ngày</p>
            <div className="report-checkbox-group">
              {projectOptions.map((proj) => (
                <label key={proj} className="report-checkbox-label">
                  <input type="checkbox" checked={form.project.includes(proj)} onChange={() => handleProjectToggle(proj)} />
                  {proj}
                </label>
              ))}
            </div>
          </div>
        </div>
        )}

        {dynamicColumns.length > 0 && (
          <div className="report-section">
            <div className="report-section-header">
              <div className="report-section-icon section-icon--blue">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
                </svg>
              </div>
              <span className="report-section-title">Thông tin bổ sung</span>
            </div>
            <div className="report-dyn-grid">
              {dynamicColumns.map((col) => {
                // Trường ngắn xếp 2 cột; trường dài (text/textarea/list/json) full-width
                const isShort = ["integer", "number", "date", "time", "boolean"].includes(col.data_type);
                return (
                  <div key={col.name} className={`card report-field-card report-dyn-item${isShort ? "" : " report-dyn-item--full"}${missingFields.has(col.name) ? " report-field--missing" : ""}`}>
                    <label className="report-field-label">
                      {col.label}
                      {col.required ? <span className="label-required">* Bắt buộc</span> : <span className="label-optional">Tùy chọn</span>}
                    </label>
                    {col.hint && <p className="report-field-hint">{col.hint}</p>}
                    {col.data_type === "array" ? (
                      <div className="report-checkbox-group">
                        {(optionsMap[col.name] || []).map((opt) => (
                          <label key={opt} className="report-checkbox-label">
                            <input type="checkbox"
                              checked={Array.isArray(form[col.name]) && form[col.name].includes(opt)}
                              onChange={() => handleArrayToggle(col.name, opt)} />
                            {opt}
                          </label>
                        ))}
                        {(optionsMap[col.name] || []).length === 0 && (
                          <span className="report-field-hint">Chưa có tùy chọn nào</span>
                        )}
                      </div>
                    ) : (
                      renderDynamicInput(col, form[col.name] ?? "", handleChange)
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {error && (
          <div className="report-error">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            {error}
          </div>
        )}

        <div className="report-actions">
          <div className="report-actions-inner">
            <button type="submit" className="report-btn-submit" disabled={submitting}>
              {submitting ? (
                <>
                  <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2, borderTopColor: "#fff" }} />
                  {editId ? "Đang cập nhật..." : "Đang gửi báo cáo..."}
                </>
              ) : (
                <>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                  {editId ? "Cập nhật báo cáo hôm nay" : "Gửi báo cáo"}
                </>
              )}
            </button>
            <button type="button" className="report-btn-clear" onClick={handleClear}>Xóa hết câu trả lời</button>
          </div>
        </div>
      </form>
    </div>
  );
}
