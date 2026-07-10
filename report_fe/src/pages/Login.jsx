import "./Login.css";
import { API_URL } from "../api/client";

export default function Login() {
  const params = new URLSearchParams(window.location.search);
  const isDisabled = params.get("error") === "disabled";
  const isNotCompany = params.get("error") === "not_company";
  const isSessionExpired = params.get("error") === "session_expired";

  const loginGoogle = () => {
    window.location.href = `${API_URL}/auth/google`;
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <img src="https://hdc-flowtech.com/assets/logo-horizontal.png" alt="HDC-Flowtech" className="login-logo-img" />
        </div>
        <p className="login-brand-title">Hệ thống Báo cáo Công việc</p>
        <p className="login-brand-sub">AI Automation Partner</p>

        {isDisabled && (
          <div className="alert alert-error login-alert">
            Tài khoản của bạn đã bị vô hiệu hóa. Vui lòng liên hệ quản trị viên.
          </div>
        )}

        {isNotCompany && (
          <div className="alert alert-error login-alert">
            Chỉ tài khoản công ty HDC-Flowtech mới đăng nhập được. Vui lòng dùng email công ty
          </div>
        )}

        {isSessionExpired && (
          <div className="alert alert-error login-alert">
            Phiên đăng nhập đã hết hạn hoặc bị hủy. Vui lòng đăng nhập lại.
          </div>
        )}

        <button className="login-google-btn" onClick={loginGoogle}>
          <svg viewBox="0 0 24 24" width="20" height="20">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          Đăng nhập với Google
        </button>

        <div className="login-features">
          <div className="login-feature">
            <div className="login-feature-icon fi-blue">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </div>
            <span className="login-feature-label">Báo cáo</span>
          </div>
          <div className="login-feature">
            <div className="login-feature-icon fi-cyan">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>
            <span className="login-feature-label">Nhanh chóng</span>
          </div>
          <div className="login-feature">
            <div className="login-feature-icon fi-purple">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            <span className="login-feature-label">Bảo mật</span>
          </div>
        </div>

        <p className="login-footer">
          &copy; 2026 <strong>HDC-Flowtech Technology JSC</strong>
        </p>
      </div>
    </div>
  );
}
