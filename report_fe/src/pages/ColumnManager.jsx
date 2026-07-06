import { useState, useEffect, useCallback } from "react";
import {
  listColumns, getAuditLog, dropColumn,
} from "../api/columns";
import {
  addDynamicColumn, updateDynamicColumn, deleteDynamicColumn, getDynamicColumns,
} from "../api/dynamicColumns";
import {
  getFieldOptions, addFieldOption, updateFieldOption, deleteFieldOption,
} from "../api/fieldOptions";
import "./ColumnManager.css";

// FastAPI 422 trả detail = mảng object; 400 trả string. Chuẩn hoá về 1 chuỗi để render.
function getErrDetail(err, fallback) {
  const d = err?.response?.data?.detail;
  if (Array.isArray(d)) return d[0]?.msg || fallback;
  if (typeof d === "string") return d;
  return fallback;
}

const DATA_TYPES = [
  { value: "text", label: "Văn bản ngắn (text)" },
  { value: "textarea", label: "Văn bản dài (textarea)" },
  { value: "integer", label: "Số nguyên (integer)" },
  { value: "number", label: "Số thập phân (number)" },
  { value: "boolean", label: "Đúng/Sai (boolean)" },
  { value: "date", label: "Ngày (date)" },
  { value: "time", label: "Giờ (time)" },
  { value: "datetime", label: "Ngày giờ (datetime)" },
  { value: "array", label: "Danh sách (text[])" },
  { value: "jsonb", label: "JSON (jsonb)" },
];

// Trường lõi của bảng reports — không cho đổi tên/đổi kiểu/xóa, khớp STATIC_FIELDS backend.
// Các trường nghiệp vụ đã chuyển sang cột động nên KHÔNG còn ở đây.
const PROTECTED_COLS = [
  "id", "email", "report_date", "employee_code", "full_name", "project",
  "extra_fields",
];

const mapPgType = (pgType) => {
  if (!pgType) return "text";
  const t = pgType.toLowerCase();
  if (t.startsWith("character")) return "text";
  if (t === "integer" || t === "bigint" || t === "smallint") return "integer";
  if (t.startsWith("numeric") || t.startsWith("double")) return "number";
  if (t === "boolean") return "boolean";
  if (t === "date") return "date";
  if (t.startsWith("timestamp")) return "datetime";
  if (t.startsWith("time")) return "time";
  if (t === "text") return "text";
  if (t === "array" || t.endsWith("[]")) return "array";
  return "text";
};

const emptyColForm = { name: "", label: "", data_type: "text", required: false, field_order: 0, hint: "" };

export default function ColumnManager() {
  return (
    <div className="column-manager-page fade-in">
      <div className="cm-header">
        <h1 className="cm-header-title">Quản lý bảng</h1>
      </div>

      <ColumnsTab />
    </div>
  );
}

// Modal inline: quản lý danh sách tùy chọn (field_options) cho 1 trường kiểu array.
function ColumnOptionsModal({ column, label, onClose }) {
  const [options, setOptions] = useState([]);
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    getFieldOptions(column, true)
      .then((res) => setOptions(res.data))
      .catch(() => setError("Không tải được danh sách tùy chọn"))
      .finally(() => setLoading(false));
  }, [column]);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async (e) => {
    e.preventDefault();
    setError("");
    if (!value.trim()) { setError("Vui lòng nhập giá trị"); return; }
    setSaving(true);
    try {
      await addFieldOption({ column_name: column, value: value.trim(), field_order: (options.length + 1) * 10 });
      setValue("");
      load();
    } catch (err) { setError(getErrDetail(err, "Thêm tùy chọn thất bại")); }
    finally { setSaving(false); }
  };

  const handleToggle = async (opt) => {
    setError("");
    try { await updateFieldOption(opt.id, { is_active: !opt.is_active }); load(); }
    catch (err) { setError(getErrDetail(err, "Cập nhật trạng thái thất bại")); }
  };

  const handleRemove = async (opt) => {
    setError("");
    try { await deleteFieldOption(opt.id); load(); }
    catch (err) { setError(getErrDetail(err, "Xóa tùy chọn thất bại")); }
  };

  return (
    <div className="cm-confirm-overlay" onClick={onClose}>
      <div className="cm-confirm-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460, width: "100%" }}>
        <h3 className="cm-confirm-title">Tùy chọn: {label || column}</h3>
        {error && (
          <div className="alert alert-error" style={{ marginBottom: "0.5rem" }}>{error}</div>
        )}
        <form onSubmit={handleAdd} className="cm-inline-form" style={{ marginBottom: "0.75rem" }}>
          <input type="text" className="form-input" placeholder="Giá trị mới (VD: Nghỉ phép)"
            value={value} onChange={(e) => setValue(e.target.value)} autoFocus />
          <button type="submit" className="btn btn-success btn-sm" disabled={saving}>Thêm</button>
        </form>
        {loading ? (
          <p style={{ color: "var(--text-muted)", fontSize: "0.8125rem" }}>Đang tải...</p>
        ) : options.length === 0 ? (
          <p style={{ color: "var(--text-muted)", fontSize: "0.8125rem" }}>Chưa có tùy chọn nào.</p>
        ) : (
          <ul className="cm-opt-list">
            {options.map((opt) => (
              <li key={opt.id} className="cm-opt-item">
                <span className={opt.is_active ? "" : "cm-opt-inactive"}>
                  {opt.value}
                  {!opt.is_active && <span className="badge badge-danger" style={{ marginLeft: 6, fontSize: "0.625rem" }}>Ẩn</span>}
                </span>
                <span className="cm-opt-actions">
                  <button className="btn btn-ghost btn-sm" style={{ fontSize: "0.7rem" }} onClick={() => handleToggle(opt)}>
                    {opt.is_active ? "Ẩn" : "Hiện"}
                  </button>
                  <button className="btn btn-ghost btn-sm" style={{ color: "var(--color-danger)", fontSize: "0.7rem" }} onClick={() => handleRemove(opt)}>
                    Xóa
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
        <div className="cm-confirm-actions" style={{ marginTop: "0.75rem" }}>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Đóng</button>
        </div>
      </div>
    </div>
  );
}

function ColumnsTab() {
  const [columns, setColumns] = useState([]);
  const [dynamicDefs, setDynamicDefs] = useState([]);
  const [form, setForm] = useState(emptyColForm);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [editingLabel, setEditingLabel] = useState(null);
  const [labelValue, setLabelValue] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [auditLog, setAuditLog] = useState([]);
  const [showAudit, setShowAudit] = useState(false);
  const [dragCol, setDragCol] = useState(null);      // cột đang kéo
  const [dragOverCol, setDragOverCol] = useState(null); // cột đang được kéo qua
  const [optionsTarget, setOptionsTarget] = useState(null); // cột array đang mở modal tùy chọn

  const fetchAll = useCallback(() => {
    listColumns()
      .then((res) => setColumns(res.data))
      .catch(() => setError("Không tải được danh sách cột"));
    getDynamicColumns(true)
      .then((res) => setDynamicDefs(res.data))
      .catch(() => { });
    getAuditLog()
      .then((res) => setAuditLog(res.data))
      .catch(() => { });
  }, []);

  useEffect(() => {
    listColumns()
      .then((res) => setColumns(res.data))
      .catch(() => setError("Không tải được danh sách cột"))
      .finally(() => setLoading(false));
    getDynamicColumns(true)
      .then((res) => setDynamicDefs(res.data))
      .catch(() => { /* ignored */ });
    getAuditLog()
      .then((res) => setAuditLog(res.data))
      .catch(() => { /* ignored */ });
  }, []);

  const clearMessages = () => { setError(""); setSuccess(""); };

  const getDefForCol = (name) => dynamicDefs.find((d) => d.name === name);

  const handleAddColumn = async (e) => {
    e.preventDefault();
    clearMessages();
    if (!form.name.trim() || !form.label.trim()) {
      setError("Vui lòng nhập tên cột và label");
      return;
    }
    try {
      await addDynamicColumn({
        name: form.name.trim(),
        label: form.label.trim(),
        data_type: form.data_type,
        required: form.required,
        field_order: form.field_order,
        hint: form.hint || null,
      });
      setSuccess(`Đã thêm cột "${form.label}"`);
      setForm(emptyColForm);
      fetchAll();
    } catch (err) {
      setError(getErrDetail(err, "Thêm cột thất bại"));
    }
  };

  const handleSaveLabel = async (colName) => {
    clearMessages();
    if (!labelValue.trim()) { setEditingLabel(null); return; }
    try {
      await updateDynamicColumn(colName, { label: labelValue.trim() });
      setSuccess(`Đã đổi label "${colName}" → "${labelValue.trim()}"`);
      setEditingLabel(null);
      fetchAll();
    } catch (err) {
      setError(getErrDetail(err, "Đổi label thất bại"));
    }
  };

  // Bật/tắt bắt buộc cho cột động (metadata). Trường cố định luôn bắt buộc → checkbox khoá.
  const handleToggleRequired = async (colName, next) => {
    clearMessages();
    try {
      await updateDynamicColumn(colName, { required: next });
      setSuccess(next ? `Đã bật bắt buộc "${colName}"` : `Đã tắt bắt buộc "${colName}"`);
      fetchAll();
    } catch (err) {
      setError(getErrDetail(err, "Cập nhật bắt buộc thất bại"));
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    clearMessages();
    const def = getDefForCol(deleteTarget);
    try {
      if (def) {
        await deleteDynamicColumn(deleteTarget);
      } else {
        await dropColumn(deleteTarget);
      }
      setSuccess(`Đã xóa cột "${deleteTarget}"`);
      setDeleteTarget(null);
      fetchAll();
    } catch (err) {
      setError(getErrDetail(err, "Xóa cột thất bại"));
    } finally { setDeleteLoading(false); }
  };

  const handleToggleActive = async (colName, colType) => {
    clearMessages();
    const def = getDefForCol(colName);
    const mappedType = mapPgType(colType);
    try {
      if (def) {
        await updateDynamicColumn(colName, { is_active: !def.is_active });
        setSuccess(def.is_active ? `Đã ẩn cột "${def.label}"` : `Đã hiện cột "${def.label}"`);
      } else if (isProtected(colName)) {
        // Trường cố định: chỉ đổi metadata (PATCH upsert), KHÔNG tạo cột/ALTER TABLE
        await updateDynamicColumn(colName, {
          label: colName, data_type: mappedType,
          required: false, field_order: 0, is_active: false,
        });
        setSuccess(`Đã ẩn cột "${colName}"`);
      } else {
        await addDynamicColumn({
          name: colName, label: colName, data_type: mappedType,
          required: false, field_order: 99, hint: null, is_active: false,
        });
        setSuccess(`Đã ẩn cột "${colName}"`);
      }
      fetchAll();
    } catch (err) {
      setError(getErrDetail(err, "Cập nhật trạng thái thất bại"));
    }
  };

  const getDataTypeLabel = (pgType) => {
    const t = DATA_TYPES.find((d) => d.value === pgType);
    return t ? t.label : pgType;
  };

  const isProtected = (colName) => PROTECTED_COLS.includes(colName);

  // Cột động sắp được ở trang báo cáo = có def và không phải trường lõi
  const isReorderable = (colName) => !!getDefForCol(colName) && !isProtected(colName);
  const dynamicOrdered = columns
    .filter((c) => isReorderable(c.column_name))
    .sort((a, b) => getDefForCol(a.column_name).field_order - getDefForCol(b.column_name).field_order);
  const orderedColumns = [
    ...columns.filter((c) => !isReorderable(c.column_name)),
    ...dynamicOrdered,
  ];

  // Lưu thứ tự mới: đánh số lại toàn bộ cột động 10,20,30... (tránh trùng field_order)
  const persistOrder = async (arr) => {
    clearMessages();
    try {
      await Promise.all(arr.map((c, i) => updateDynamicColumn(c.column_name, { field_order: (i + 1) * 10 })));
      setSuccess("Đã cập nhật thứ tự hiển thị");
      fetchAll();
    } catch (err) {
      setError(getErrDetail(err, "Cập nhật thứ tự thất bại"));
    }
  };

  const handleDragStart = (colName) => (e) => {
    setDragCol(colName);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (colName) => (e) => {
    e.preventDefault(); // cho phép thả
    e.dataTransfer.dropEffect = "move";
    if (colName !== dragOverCol) setDragOverCol(colName);
  };

  const handleDragEnd = () => {
    setDragCol(null);
    setDragOverCol(null);
  };

  const handleDrop = (targetCol) => async (e) => {
    e.preventDefault();
    const sourceCol = dragCol;
    setDragCol(null);
    setDragOverCol(null);
    if (!sourceCol || sourceCol === targetCol) return;
    const from = dynamicOrdered.findIndex((c) => c.column_name === sourceCol);
    const to = dynamicOrdered.findIndex((c) => c.column_name === targetCol);
    if (from < 0 || to < 0) return;
    const arr = [...dynamicOrdered];
    const [moved] = arr.splice(from, 1); // gỡ cột nguồn
    arr.splice(to, 0, moved);            // chèn vào vị trí cột đích
    await persistOrder(arr);
  };

  const getAuditActionClass = (action) => {
    if (!action) return "";
    const a = action.toLowerCase();
    if (a.startsWith("add")) return "cm-audit-action--add";
    if (a.startsWith("rename")) return "cm-audit-action--rename";
    if (a.startsWith("change")) return "cm-audit-action--change_type";
    if (a.startsWith("drop") || a.startsWith("update")) return "cm-audit-action--drop";
    return "";
  };

  const getAuditActionLabel = (action) => {
    switch (action) {
      case "ADD_COLUMN": return "Thêm";
      case "RENAME_COLUMN": return "Đổi tên";
      case "CHANGE_TYPE": return "Đổi kiểu";
      case "DROP_COLUMN": return "Xóa";
      case "ADD_DYNAMIC_COLUMN": return "Thêm Động";
      case "UPDATE_DYNAMIC_COLUMN": return "Sửa Động";
      case "DROP_DYNAMIC_COLUMN": return "Xóa Động";
      default: return action;
    }
  };

  if (loading) {
    return (
      <div className="page-loading">
        <div className="spinner spinner-lg"></div>
        <p>Đang tải...</p>
      </div>
    );
  }

  return (
    <>
      {error && (
        <div className="alert alert-error" style={{ marginBottom: "0.75rem" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>
          {error}
        </div>
      )}
      {success && (
        <div className="alert alert-success" style={{ marginBottom: "0.75rem" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
          {success}
        </div>
      )}

      <div className="card cm-add-card">
        <div className="cm-form-title">Thêm cột động mới</div>
        <form onSubmit={handleAddColumn}>
          <div className="cm-form-row">
            <div className="form-group" style={{ margin: 0 }}>
              <input type="text" className="form-input" placeholder="Tên cột DB (VD: customer_name)"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <input type="text" className="form-input" placeholder="Label tiếng Việt (VD: Tên khách hàng)"
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <select className="form-select" value={form.data_type}
                onChange={(e) => setForm({ ...form, data_type: e.target.value })}>
                {DATA_TYPES.map((t) => (<option key={t.value} value={t.value}>{t.label}</option>))}
              </select>
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <input type="number" className="form-input" placeholder="Thứ tự" min="0" style={{ width: 70 }}
                value={form.field_order}
                onChange={(e) => setForm({ ...form, field_order: parseInt(e.target.value) || 0 })} />
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: "0.25rem", fontSize: "0.75rem", color: "var(--gray-600)", cursor: "pointer", whiteSpace: "nowrap" }}>
              <input type="checkbox" checked={form.required}
                onChange={(e) => setForm({ ...form, required: e.target.checked })}
                style={{ accentColor: "var(--color-primary)" }} />
              Bắt buộc
            </label>
            <div className="cm-form-actions">
              <button type="submit" className="btn btn-success btn-sm">Thêm</button>
            </div>
          </div>
        </form>
      </div>

      <div className="card cm-table-card">
        <div style={{ overflowX: "auto" }}>
          <table className="cm-table">
            <thead>
              <tr>
                <th>Tên cột</th>
                <th>Label</th>
                <th>Kiểu</th>
                <th>Thứ tự</th>
                <th>NULL</th>
                <th>Bắt buộc</th>
                <th style={{ minWidth: 300 }}>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {orderedColumns.map((col) => {
                const def = getDefForCol(col.column_name);
                const isProtected_ = isProtected(col.column_name);
                const canReorder = isReorderable(col.column_name)
                  && editingLabel !== col.column_name;
                const rowClass = [
                  isProtected_ ? "protected" : "",
                  dragOverCol === col.column_name && dragCol && dragCol !== col.column_name ? "cm-drag-over" : "",
                  dragCol === col.column_name ? "cm-dragging" : "",
                ].filter(Boolean).join(" ");
                return (
                  <tr
                    key={col.column_name}
                    className={rowClass}
                    draggable={canReorder}
                    onDragStart={canReorder ? handleDragStart(col.column_name) : undefined}
                    onDragOver={dragCol ? handleDragOver(col.column_name) : undefined}
                    onDrop={dragCol ? handleDrop(col.column_name) : undefined}
                    onDragEnd={handleDragEnd}
                  >
                    <td>
                      <span className="cm-col-name">
                        {canReorder && <span className="cm-drag-handle" title="Kéo để đổi vị trí">⠿</span>}
                        {col.column_name}
                        {def && !def.is_active && <span className="badge badge-danger" style={{ marginLeft: 6, fontSize: "0.625rem" }}>Ẩn</span>}
                      </span>
                    </td>
                    <td style={{ color: "var(--text-muted)", fontSize: "0.8125rem" }}>
                      {def ? def.label : "—"}
                    </td>
                    <td>
                      <span className="cm-col-type">{getDataTypeLabel(col.data_type)}</span>
                    </td>
                    <td style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>
                      {def ? def.field_order : "—"}
                    </td>
                    <td>
                      <span className={`badge cm-col-nullable ${col.is_nullable === "YES" ? "badge-success" : "badge-danger"}`}>
                        {col.is_nullable === "YES" ? "NULL" : "NOT NULL"}
                      </span>
                    </td>
                    <td style={{ textAlign: "center" }}>
                      {/* Cột động: tick chỉnh được. Trường cố định: luôn bắt buộc (trừ khi ẩn) → khoá tick. */}
                      <input type="checkbox"
                        checked={isProtected_ ? true : !!def?.required}
                        disabled={isProtected_ || !def}
                        onChange={(e) => handleToggleRequired(col.column_name, e.target.checked)}
                        style={{ accentColor: "var(--color-primary)", cursor: (isProtected_ || !def) ? "not-allowed" : "pointer" }}
                        title={isProtected_ ? "Trường cố định luôn bắt buộc (trừ khi ẩn)" : "Bắt buộc điền ở form báo cáo"} />
                    </td>
                    <td>
                      {editingLabel === col.column_name ? (
                        <div className="cm-inline-form">
                          <input type="text" value={labelValue} onChange={(e) => setLabelValue(e.target.value)} placeholder="Label mới" autoFocus
                            onKeyDown={(e) => { if (e.key === "Enter") handleSaveLabel(col.column_name); if (e.key === "Escape") setEditingLabel(null); }} />
                          <div className="cm-inline-actions">
                            <button className="btn btn-success btn-sm" style={{ fontSize: "0.6875rem", padding: "0.25rem 0.5rem" }} onClick={() => handleSaveLabel(col.column_name)}>OK</button>
                            <button className="btn btn-ghost btn-sm" style={{ fontSize: "0.6875rem", padding: "0.25rem 0.5rem" }} onClick={() => setEditingLabel(null)}>Hủy</button>
                          </div>
                        </div>
                      ) : (
                        <div className="cm-actions">
                          {/* 4 ô cố định để cùng loại thẳng hàng: Ẩn/Hiện | Đổi label | Xóa | Tùy chọn */}
                          {/* Ẩn/Hiện chỉ cho cột NULL (nullable). Cột NOT NULL ẩn nút → tránh insert lỗi thiếu giá trị. */}
                          {col.is_nullable === "YES" ? (
                            <button className="btn btn-ghost btn-sm cm-action-slot" style={{ color: def && !def.is_active ? "var(--color-success)" : "var(--gray-500)", fontSize: "0.75rem" }}
                              onClick={() => handleToggleActive(col.column_name, col.data_type)}>
                              {def && !def.is_active ? "Hiện" : "Ẩn"}
                            </button>
                          ) : <span className="cm-action-slot" />}
                          {!isProtected_ ? (
                            <button className="btn btn-ghost btn-sm cm-action-slot" style={{ color: "var(--color-primary)", fontSize: "0.75rem" }}
                              onClick={() => { setEditingLabel(col.column_name); setLabelValue(def ? def.label : col.column_name); }}>
                              Đổi label
                            </button>
                          ) : <span className="cm-action-slot" />}
                          {!isProtected_ ? (
                            <button className="btn btn-ghost btn-sm cm-action-slot" style={{ color: "var(--color-danger)", fontSize: "0.75rem" }}
                              onClick={() => setDeleteTarget(col.column_name)}>
                              Xóa
                            </button>
                          ) : <span className="cm-action-slot" />}
                          {(def?.data_type === "array" || col.column_name === "project") ? (
                            <button className="btn btn-ghost btn-sm cm-action-slot" style={{ color: "var(--color-primary)", fontSize: "0.75rem" }}
                              onClick={() => setOptionsTarget({ name: col.column_name, label: def ? def.label : col.column_name })}>
                              Tùy chọn
                            </button>
                          ) : <span className="cm-action-slot" />}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {columns.length === 0 && (
                <tr>
                  <td colSpan={7}>
                    <div className="empty-state">
                      <span className="empty-state-icon">📊</span>
                      <p className="empty-state-text">Chưa có cột nào</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card cm-audit-card">
        <div className="cm-audit-header">
          <div className="cm-audit-title">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
            </svg>
            Lịch sử thay đổi
            <span className="badge badge-info" style={{ fontSize: "0.625rem" }}>{auditLog.length}</span>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => { setShowAudit(!showAudit); if (!showAudit) getAuditLog().then(r => setAuditLog(r.data)).catch(() => { }); }}>
            {showAudit ? "Ẩn" : "Hiện"}
          </button>
        </div>
        {showAudit && (
          <div style={{ overflowX: "auto" }} className="fade-in">
            <table className="cm-audit-table">
              <thead>
                <tr><th>Hành động</th><th>Bảng</th><th>Cột</th><th>Chi tiết</th><th>Thời gian</th></tr>
              </thead>
              <tbody>
                {auditLog.map((log) => (
                  <tr key={log.id}>
                    <td><span className={`cm-audit-action ${getAuditActionClass(log.action)}`}>{getAuditActionLabel(log.action)}</span></td>
                    <td style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem" }}>{log.table_name}</td>
                    <td style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem" }}>{log.column_name || "—"}</td>
                    <td style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{log.detail || "—"}</td>
                    <td style={{ fontSize: "0.75rem", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                      {log.created_at ? new Date(log.created_at).toLocaleString("vi-VN") : "—"}
                    </td>
                  </tr>
                ))}
                {auditLog.length === 0 && (
                  <tr><td colSpan={5} style={{ textAlign: "center", padding: "1rem", color: "var(--text-muted)" }}>Chưa có lịch sử thay đổi</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {optionsTarget && (
        <ColumnOptionsModal
          column={optionsTarget.name}
          label={optionsTarget.label}
          onClose={() => setOptionsTarget(null)}
        />
      )}

      {deleteTarget && (
        <div className="cm-confirm-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="cm-confirm-box" onClick={(e) => e.stopPropagation()}>
            <h3 className="cm-confirm-title">Xác nhận xóa cột</h3>
            <p className="cm-confirm-desc">
              Bạn có chắc chắn muốn xóa cột <strong style={{ fontFamily: "var(--font-mono)", color: "var(--color-danger)" }}>{deleteTarget}</strong>?<br />
              Hành động này không thể hoàn tác. Dữ liệu trong cột này sẽ bị mất vĩnh viễn.
            </p>
            <div className="cm-confirm-actions">
              <button className="btn btn-ghost btn-sm" onClick={() => setDeleteTarget(null)} disabled={deleteLoading}>Hủy</button>
              <button className="btn btn-danger btn-sm" onClick={handleDelete} disabled={deleteLoading}>
                {deleteLoading ? "Đang xóa..." : "Xóa cột"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
