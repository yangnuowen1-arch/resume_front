import { Link } from "react-router-dom";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h1 className="mb-2 text-2xl font-semibold text-gray-900">Login</h1>
        <p className="mb-6 text-sm text-gray-600">Sign in to resume screening system.</p>
        <div className="space-y-3">
          <input className="w-full rounded-lg border border-gray-300 px-4 py-2" placeholder="Email" />
          <input className="w-full rounded-lg border border-gray-300 px-4 py-2" type="password" placeholder="Password" />
          <Link to="/dashboard" className="block w-full rounded-lg bg-blue-600 px-4 py-2 text-center text-white hover:bg-blue-700">
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
