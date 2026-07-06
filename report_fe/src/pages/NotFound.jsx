import { Link } from "react-router-dom";
import "./NotFound.css";

export default function NotFound() {
  return (
    <div className="not-found-page fade-in">
      <div className="not-found-code">404</div>
      <h1 className="not-found-title">Không tìm thấy trang</h1>
      <p className="not-found-desc">Trang bạn đang tìm kiếm không tồn tại hoặc đã bị di chuyển.</p>
      <Link to="/dashboard" className="btn btn-primary">
        Về trang chủ
      </Link>
    </div>
  );
}
