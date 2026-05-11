import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import DashboardPage from "./pages/dashboard";
import JobsPage from "./pages/jobs";
import ResumesPage from "./pages/resumes";
import ScreeningPage from "./pages/screening";
import ScreeningDetailPage from "./pages/screening/detail";
import LoginPage from "./pages/login";
import UsersPage from "./pages/users";
import { OperationLogs } from "./components/OperationLogs";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="jobs" element={<JobsPage />} />
          <Route path="resumes" element={<ResumesPage />} />
          <Route path="screening" element={<ScreeningPage />} />
          <Route path="screening/:id" element={<ScreeningDetailPage />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="logs" element={<OperationLogs />} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
