import { useEffect } from "react";
import "./LoginSuccess.css";

export default function LoginSuccess() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");

    if (!token) {
      window.location.replace("/login");
      return;
    }

    localStorage.setItem("access_token", token);
    window.location.replace("/dashboard");
  }, []);

  return (
    <div className="login-success-page">
      <div className="spinner spinner-lg"></div>
      <h2>Đang đăng nhập...</h2>
      <p>Vui lòng đợi trong giây lát</p>
    </div>
  );
}
