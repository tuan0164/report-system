import api from "./client";

export const getFieldOptions = (columnName, all) =>
  api.get("/field-options/", {
    params: {
      ...(columnName ? { column_name: columnName } : {}),
      ...(all ? { all: true } : {}),
    },
  });

export const addFieldOption = (data) => api.post("/field-options/", data);
export const updateFieldOption = (id, data) => api.patch(`/field-options/${id}`, data);
export const deleteFieldOption = (id) => api.delete(`/field-options/${id}`);
