import api from "./client";

export const getAllReports = (params) => api.get("/daily-reports/all", { params });

export const getUsers = () => api.get("/users/");

export const updateUserRole = (id, role) => api.patch(`/users/${id}/role`, { role });

export const updateUserActive = (id, is_active) => api.patch(`/users/${id}/active`, { is_active });
