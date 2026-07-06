import axios from "axios";

// Prod: build-arg VITE_API_URL="/api" (nginx proxy). Dev: fallback localhost.
export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";
// export const API_URL = import.meta.env.VITE_API_URL ; 
const api = axios.create({
  baseURL: API_URL,
});


api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

export default api;