import axios from "axios";

// Prod: build-arg VITE_API_URL="/api" (nginx proxy). Dev: fallback localhost.
export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

// Token nằm trong cookie HttpOnly do backend set -> JS không đọc được,
// trình duyệt tự đính kèm. withCredentials để axios gửi cookie kèm request.
const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

// Cookie hết hạn / bị thu hồi -> backend trả 401 -> đá về trang login.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const path = window.location.pathname;
    if (error.response?.status === 401 && path !== "/login") {
      window.location.replace("/login");
    }
    return Promise.reject(error);
  }
);

export default api;
