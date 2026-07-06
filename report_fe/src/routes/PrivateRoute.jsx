import { Navigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode";

export default function PrivateRoute({ children, requiredRole }) {
  const token = localStorage.getItem("access_token");

  if (!token) {
    return <Navigate to="/login" />;
  }

  if (requiredRole) {
    let decoded;
    try {
      decoded = jwtDecode(token);
    } catch {
      return <Navigate to="/login" />;
    }
    if (decoded.role !== requiredRole) {
      return <Navigate to="/dashboard" />;
    }
  }

  return children;
}
