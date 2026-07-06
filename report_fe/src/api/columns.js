import api from "./client";

const TABLE = "reports";

export const listColumns = (table = TABLE) =>
  api.get(`/add_column/tables/${table}/columns`);

export const dropColumn = (column) =>
  api.delete(`/add_column/tables/${TABLE}/columns/${column}`);

export const getAuditLog = () => api.get("/add_column/audit-log");
