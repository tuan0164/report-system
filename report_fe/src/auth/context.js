import { createContext, useContext } from "react";

// Token nằm trong cookie HttpOnly nên frontend không tự đọc được danh tính.
// Nguồn sự thật duy nhất là GET /users/me.
export const AuthContext = createContext(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth phải dùng bên trong <AuthProvider>");
  }
  return ctx;
}
