import { useSyncExternalStore } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { hasAccessToken, subscribeAccessTokenChange } from "../request";
import {
  buildLoginUrl,
  buildPathFromLocation,
  DEFAULT_AUTHENTICATED_PATH,
  LOGIN_PATH,
  readRedirectPathFromLocation,
  resolveRedirectPath,
} from "../auth/redirect";

function useIsAuthenticated(): boolean {
  return useSyncExternalStore(subscribeAccessTokenChange, hasAccessToken, () => false);
}

export function ProtectedRoute() {
  const location = useLocation();
  const isAuthenticated = useIsAuthenticated();

  if (isAuthenticated) {
    return <Outlet />;
  }

  const fromPath = buildPathFromLocation(location);
  return <Navigate to={buildLoginUrl(fromPath)} replace state={{ from: fromPath }} />;
}

export function PublicOnlyRoute() {
  const location = useLocation();
  const isAuthenticated = useIsAuthenticated();

  if (!isAuthenticated) {
    return <Outlet />;
  }

  const targetPath = resolveRedirectPath(readRedirectPathFromLocation(location), DEFAULT_AUTHENTICATED_PATH);
  return <Navigate to={targetPath} replace />;
}

export function AuthAwareFallbackRoute() {
  const isAuthenticated = useIsAuthenticated();
  return <Navigate to={isAuthenticated ? DEFAULT_AUTHENTICATED_PATH : LOGIN_PATH} replace />;
}
