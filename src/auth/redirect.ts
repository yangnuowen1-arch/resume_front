import type { Location } from "react-router-dom";

export const LOGIN_PATH = "/login";
export const DEFAULT_AUTHENTICATED_PATH = "/dashboard";

function isSafeInternalPath(path: string): boolean {
  return path.startsWith("/") && !path.startsWith("//");
}

export function resolveRedirectPath(path: unknown, fallback = DEFAULT_AUTHENTICATED_PATH): string {
  if (typeof path !== "string") {
    return fallback;
  }

  const normalizedPath = path.trim();
  if (!normalizedPath || !isSafeInternalPath(normalizedPath)) {
    return fallback;
  }

  if (
    normalizedPath === LOGIN_PATH ||
    normalizedPath.startsWith(`${LOGIN_PATH}?`) ||
    normalizedPath.startsWith(`${LOGIN_PATH}#`)
  ) {
    return fallback;
  }

  return normalizedPath;
}

export function readRedirectPathFromLocation(location: Pick<Location, "search" | "state">): string | null {
  const stateValue =
    location.state && typeof location.state === "object" && "from" in location.state
      ? (location.state as { from?: unknown }).from
      : undefined;
  if (typeof stateValue === "string" && stateValue.trim().length > 0) {
    return stateValue;
  }

  const queryValue = new URLSearchParams(location.search).get("redirect");
  if (typeof queryValue === "string" && queryValue.trim().length > 0) {
    return queryValue;
  }

  return null;
}

export function buildPathFromLocation(location: Pick<Location, "pathname" | "search" | "hash">): string {
  return `${location.pathname}${location.search}${location.hash}`;
}

export function buildLoginUrl(fromPath: string): string {
  const searchParams = new URLSearchParams();
  searchParams.set("redirect", fromPath);
  return `${LOGIN_PATH}?${searchParams.toString()}`;
}
