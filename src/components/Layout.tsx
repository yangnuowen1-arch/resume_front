import { useState } from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, Briefcase, Upload, FileCheck, Activity, Menu, X, LogOut, Users, UserCog } from "lucide-react";
import { clearAccessToken, queryClient } from "../request";

export function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navigation = [
    { name: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
    { name: "Job Management", path: "/jobs", icon: Briefcase },
    { name: "Candidates", path: "/candidates", icon: Users },
    { name: "Resume Upload", path: "/resumes", icon: Upload },
    { name: "Screening Results", path: "/screening", icon: FileCheck },
    { name: "User Management", path: "/users", icon: UserCog },
    { name: "Operation Logs", path: "/logs", icon: Activity },
  ];

  const isActive = (path: string) => location.pathname.startsWith(path);

  const handleLogout = () => {
    clearAccessToken();
    queryClient.clear();
    setMobileMenuOpen(false);
    navigate("/login", { replace: true });
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <div className="fixed left-0 right-0 top-0 z-40 flex h-16 items-center justify-between border-b border-gray-200 bg-white px-4 lg:hidden">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-purple-600">
            <FileCheck className="h-5 w-5 text-white" />
          </div>
          <h1 className="font-semibold text-gray-900">AI Resume</h1>
        </div>
        <button onClick={() => setMobileMenuOpen((v) => !v)} className="rounded-lg p-2 hover:bg-gray-100">
          {mobileMenuOpen ? <X className="h-6 w-6 text-gray-700" /> : <Menu className="h-6 w-6 text-gray-700" />}
        </button>
      </div>

      <aside className="hidden w-64 flex-col border-r border-gray-200 bg-white lg:flex">
        <div className="flex h-16 items-center border-b border-gray-200 px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-purple-600">
              <FileCheck className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="font-semibold text-gray-900">AI Resume</h1>
              <p className="text-xs text-gray-500">Screening System</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 space-y-1 p-4">
          {navigation.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 rounded-lg px-4 py-2.5 transition-colors ${
                  active ? "bg-blue-50 text-blue-700" : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                <Icon className="h-5 w-5" />
                <span className="text-sm font-medium">{item.name}</span>
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-gray-200 p-4">
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100"
          >
            <LogOut className="h-5 w-5" />
            Sign Out
          </button>
        </div>
      </aside>

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="fixed inset-0 bg-black/50" onClick={() => setMobileMenuOpen(false)} />
          <div className="fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-white">
            <nav className="flex-1 space-y-1 p-4 pt-20">
              {navigation.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.path);
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 rounded-lg px-4 py-2.5 transition-colors ${
                      active ? "bg-blue-50 text-blue-700" : "text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="text-sm font-medium">{item.name}</span>
                  </Link>
                );
              })}
            </nav>
            <div className="border-t border-gray-200 p-4">
              <button
                type="button"
                onClick={handleLogout}
                className="flex w-full items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100"
              >
                <LogOut className="h-5 w-5" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 overflow-auto pt-16 lg:pt-0">
        <Outlet />
      </main>
    </div>
  );
}
