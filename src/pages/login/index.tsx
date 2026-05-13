import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { LoaderCircle } from "lucide-react";
import { login, register } from "../../api";
import { isRequestError, setAccessToken } from "../../request";

type AuthMode = "login" | "register";

export default function LoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<AuthMode>("login");
  const [account, setAccount] = useState("");
  const [username, setUsername] = useState("");
  const [realName, setRealName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const resetFeedback = () => {
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  const resetForm = () => {
    setAccount("");
    setUsername("");
    setRealName("");
    setPhone("");
    setEmail("");
    setPassword("");
    setConfirmPassword("");
  };

  const loginMutation = useMutation({
    mutationKey: ["auth", "login"],
    mutationFn: login,
    onSuccess: (response) => {
      const token = typeof response === "string" ? response.trim() : "";
      if (!token.length) {
        setSuccessMessage("Login succeeded, but no token was returned by backend.");
        return;
      }

      setAccessToken(token);
      navigate("/dashboard", { replace: true });
    },
    onError: (error) => {
      const message = isRequestError(error) ? error.message : "Login failed";
      setErrorMessage(message);
    },
  });

  const registerMutation = useMutation({
    mutationKey: ["auth", "register"],
    mutationFn: register,
    onSuccess: () => {
      setMode("login");
      setAccount(username);
      setUsername("");
      setRealName("");
      setPhone("");
      setEmail("");
      setSuccessMessage("Registration succeeded. Please sign in.");
    },
    onError: (error) => {
      const message = isRequestError(error) ? error.message : "Registration failed";
      setErrorMessage(message);
    },
  });

  const isSubmitting = loginMutation.isPending || registerMutation.isPending;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    resetFeedback();

    if (mode === "register") {
      if (!username.trim() || !realName.trim() || !phone.trim() || !email.trim() || !password.trim()) {
        setErrorMessage("Please complete username, real name, phone, email, and password.");
        return;
      }

      if (password !== confirmPassword) {
        setErrorMessage("Passwords do not match.");
        return;
      }

      const payload = {
        email: email.trim(),
        password,
        phone: phone.trim(),
        realName: realName.trim(),
        username: username.trim(),
      };

      registerMutation.mutate(payload);
      return;
    }

    if (!account.trim() || !password.trim()) {
      setErrorMessage("Account and password are required.");
      return;
    }

    const payload = {
      account: account.trim(),
      password,
    };
    loginMutation.mutate(payload);
  };

  const switchMode = (nextMode: AuthMode) => {
    if (isSubmitting || mode === nextMode) {
      return;
    }
    resetFeedback();
    resetForm();
    setMode(nextMode);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-6 grid grid-cols-2 gap-2 rounded-lg bg-gray-100 p-1">
          <button
            type="button"
            onClick={() => switchMode("login")}
            className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              mode === "login" ? "bg-white text-blue-700 shadow-sm" : "text-gray-600 hover:text-gray-800"
            }`}
          >
            Login
          </button>
          <button
            type="button"
            onClick={() => switchMode("register")}
            className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              mode === "register" ? "bg-white text-blue-700 shadow-sm" : "text-gray-600 hover:text-gray-800"
            }`}
          >
            Register
          </button>
        </div>

        <h1 className="mb-2 text-2xl font-semibold text-gray-900">{mode === "login" ? "Welcome Back" : "Create Account"}</h1>
        <p className="mb-6 text-sm text-gray-600">
          {mode === "login" ? "Sign in to resume screening system." : "Register your account to get started."}
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === "register" && (
            <>
              <input
                className="w-full rounded-lg border border-gray-300 px-4 py-2"
                placeholder="Username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                autoComplete="username"
                required
              />
              <input
                className="w-full rounded-lg border border-gray-300 px-4 py-2"
                placeholder="Real name"
                value={realName}
                onChange={(event) => setRealName(event.target.value)}
                autoComplete="name"
                required
              />
              <input
                className="w-full rounded-lg border border-gray-300 px-4 py-2"
                placeholder="Phone"
                type="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                autoComplete="tel"
                required
              />
              <input
                className="w-full rounded-lg border border-gray-300 px-4 py-2"
                placeholder="Email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                required
              />
              <input
                className="w-full rounded-lg border border-gray-300 px-4 py-2"
                type="password"
                placeholder="Password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="new-password"
                required
              />
              <input
                className="w-full rounded-lg border border-gray-300 px-4 py-2"
                type="password"
                placeholder="Confirm password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
                required
              />
            </>
          )}

          {mode === "login" && (
            <>
              <input
                className="w-full rounded-lg border border-gray-300 px-4 py-2"
                placeholder="Account"
                value={account}
                onChange={(event) => setAccount(event.target.value)}
                autoComplete="username"
                required
              />
              <input
                className="w-full rounded-lg border border-gray-300 px-4 py-2"
                type="password"
                placeholder="Password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
              />
            </>
          )}

          {errorMessage && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{errorMessage}</div>
          )}
          {successMessage && (
            <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">{successMessage}</div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-center text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting && <LoaderCircle className="h-4 w-4 animate-spin" />}
            {mode === "login" ? "Sign In" : "Create Account"}
          </button>
        </form>
      </div>
    </div>
  );
}
