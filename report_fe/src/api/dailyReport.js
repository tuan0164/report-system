import api from "./client";

export const submitReport = (data) => api.post("/daily-reports/", data);

export const updateReport = (id, data) => api.put(`/daily-reports/${id}`, data);

export const getMyReports = () => api.get("/daily-reports/");
