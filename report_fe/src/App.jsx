import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Layout from "./components/Layout";
import Login from "./pages/Login";
import LoginSuccess from "./pages/LoginSuccess";
import Dashboard from "./pages/Dashboard";
import DailyReportForm from "./pages/DailyReportForm";
import AdminReports from "./pages/AdminReports";
import NotFound from "./pages/NotFound";
import ColumnManager from "./pages/ColumnManager";
import AccountManager from "./pages/AccountManager";
import PrivateRoute from "./routes/PrivateRoute";
import { AuthProvider } from "./auth/AuthProvider";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/login-success" element={<LoginSuccess />} />

          <Route element={<PrivateRoute><Layout /></PrivateRoute>}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/report" element={<DailyReportForm />} />
            <Route path="/admin/reports" element={<PrivateRoute requiredRole="ADMIN"><AdminReports /></PrivateRoute>} />
            <Route path="/admin/columns" element={<PrivateRoute requiredRole="ADMIN"><ColumnManager /></PrivateRoute>} />
            <Route path="/admin/accounts" element={<PrivateRoute requiredRole="ADMIN"><AccountManager /></PrivateRoute>} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
