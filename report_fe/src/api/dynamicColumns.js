import api from "./client";

export const getDynamicColumns = (all) => api.get("/dynamic-columns/", { params: all ? { all: true } : {} });
export const addDynamicColumn = (data) => api.post("/dynamic-columns/", data);
export const updateDynamicColumn = (name, data) => api.patch(`/dynamic-columns/${name}`, data);
export const deleteDynamicColumn = (name) => api.delete(`/dynamic-columns/${name}`);
