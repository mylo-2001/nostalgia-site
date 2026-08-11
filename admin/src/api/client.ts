// Thin fetch wrapper for the Express admin API. Same-origin cookies carry the
// admin session (dev goes through the Vite proxy, prod is same host).

export interface ApiResult<T = unknown> {
  ok: boolean;
  status: number;
  error?: string;
  [key: string]: unknown;
  data?: T;
}

const CSRF_STORAGE_KEY = "nostalgia_admin_csrf";

function csrfToken(): string {
  try { return window.sessionStorage.getItem(CSRF_STORAGE_KEY) || ""; }
  catch { return ""; }
}

function rememberCsrfToken(value: unknown) {
  if (typeof value !== "string" || !value) return;
  try { window.sessionStorage.setItem(CSRF_STORAGE_KEY, value); } catch { /* unavailable */ }
}

export function clearAdminClientSession() {
  try { window.sessionStorage.removeItem(CSRF_STORAGE_KEY); } catch { /* unavailable */ }
}

async function request<T = unknown>(method: string, path: string, body?: unknown,
  customHeaders?: Record<string, string>): Promise<ApiResult<T>> {
  const headers: Record<string, string> = {};
  if (body) headers["Content-Type"] = "application/json";
  if (!["GET", "HEAD"].includes(method)) {
    const token = csrfToken();
    if (token) headers["X-CSRF-Token"] = token;
  }
  Object.assign(headers, customHeaders || {});
  const res = await fetch(path, {
    method,
    headers: Object.keys(headers).length ? headers : undefined,
    body: body ? JSON.stringify(body) : undefined,
    credentials: "same-origin",
  });
  let json: Record<string, unknown> = {};
  try { json = (await res.json()) as Record<string, unknown>; } catch { /* empty body */ }
  rememberCsrfToken(json.csrfToken);
  return { ...(json as object), ok: res.ok && (json.ok !== false), status: res.status } as ApiResult<T>;
}

export const api = {
  get: <T = unknown>(path: string) => request<T>("GET", path),
  post: <T = unknown>(path: string, body?: unknown) => request<T>("POST", path, body ?? {}),
  postWithHeaders: <T = unknown>(path: string, body: unknown,
    headers: Record<string, string>) => request<T>("POST", path, body ?? {}, headers),
  patch: <T = unknown>(path: string, body?: unknown) => request<T>("PATCH", path, body ?? {}),
  del: <T = unknown>(path: string) => request<T>("DELETE", path),
};

export type AdminSessionState = "anonymous" | "mfa_setup" | "authenticated";

interface AdminSessionPayload {
  username: string;
  mfaRequired: boolean;
  mfaEnabled: boolean;
  mfaVerified: boolean;
  accessGranted: boolean;
  requiresMfaSetup: boolean;
  requiresMfaVerification: boolean;
}

/** Probe a dedicated session endpoint without touching protected business data. */
export async function checkSession(): Promise<AdminSessionState> {
  try {
    const r = await api.get("/api/admin/me");
    const admin = r.admin as AdminSessionPayload | null | undefined;
    if (!r.ok || !admin) return "anonymous";
    if (admin.accessGranted) return "authenticated";
    if (admin.requiresMfaSetup) return "mfa_setup";
    // An old, unverified session for an already-enrolled admin must log in again.
    return "anonymous";
  } catch {
    return "anonymous";
  }
}
