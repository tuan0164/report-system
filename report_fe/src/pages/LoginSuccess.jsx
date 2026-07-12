import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/context";
import "./LoginSuccess.css";

export default function LoginSuccess() {
  const { refresh } = useAuth();
  const navigate = useNavigate();

  // Backend đã set cookie HttpOnly ở bước redirect. Ở đây chỉ xác nhận
  // phiên hợp lệ rồi vào dashboard — không có token nào trong URL để đọc.
  useEffect(() => {
    refresh().then((user) => {
      navigate(user ? "/dashboard" : "/login", { replace: true });
    });
  }, [refresh, navigate]);

  return (
    <div className="login-success-page">
      <div className="spinner spinner-lg"></div>
      <h2>Đang đăng nhập...</h2>
      <p>Vui lòng đợi trong giây lát</p>
    </div>
  );
}
