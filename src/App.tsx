import { Navigate, Route, Routes } from "react-router-dom";
import { AuthAwareFallbackRoute, ProtectedRoute, PublicOnlyRoute } from "./components/AuthRoutes";
import { Layout } from "./components/Layout";
import DashboardPage from "./pages/dashboard";
import JobsPage from "./pages/jobs";
import ResumesPage from "./pages/resumes";
import LogsPage from "./pages/logs";
import ScreeningPage from "./pages/screening";
import ScreeningDetailPage from "./pages/screening/detail";
import LoginPage from "./pages/login";
import UsersPage from "./pages/users";

export default function App() {
  return (
    <Routes>
      <Route element={<PublicOnlyRoute />}>
        <Route path="/login" element={<LoginPage />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="jobs" element={<JobsPage />} />
          <Route path="resumes" element={<ResumesPage />} />
          <Route path="screening" element={<ScreeningPage />} />
          <Route path="screening/:id" element={<ScreeningDetailPage />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="logs" element={<LogsPage />} />
        </Route>
      </Route>

      <Route path="*" element={<AuthAwareFallbackRoute />} />
    </Routes>
  );
}
