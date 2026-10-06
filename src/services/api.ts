import { getToken, getSession, saveSession } from "./storage";
import type { Session } from "./session-types";
export class APIError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
let refresh: Promise<Session> | null = null;
function serviceURL() {
  const base = process.env.EXPO_PUBLIC_API_URL;
  if (!base)
    throw new Error(
      "The online service is not configured. Offline logging remains available.",
    );
  if (
    !base.startsWith("https://") &&
    !(__DEV__ && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(base))
  )
    throw new Error("Online services must use HTTPS.");
  return base.replace(/\/$/, "");
}
async function request<T>(path: string, body: unknown, token: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetch(`${serviceURL()}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const result = await response.json();
    if (!response.ok)
      throw new APIError(
        response.status,
        result.error || "Service unavailable.",
      );
    return result as T;
  } finally {
    clearTimeout(timer);
  }
}
export async function publicAPI<T>(path: string, body: unknown): Promise<T> {
  return request(path, body, "");
}
export async function api<T>(path: string, body: unknown): Promise<T> {
  const original = await getSession();
  let token = await getToken();
  if (!token)
    throw new Error("Sign in through Account to use online services.");
  const unchanged = async () => {
    const current = await getSession();
    if (
      (current?.userId || "guest") !== (original?.userId || "guest") ||
      (original && !current)
    )
      throw new Error(
        "Account changed while the request was running. Please retry.",
      );
  };
  try {
    const value = await request<T>(path, body, token);
    await unchanged();
    return value;
  } catch (e) {
    await unchanged();
    const session = await getSession();
    if (
      !(e instanceof APIError) ||
      e.status !== 401 ||
      !session ||
      path === "/auth/refresh"
    )
      throw e;
    if (!refresh)
      refresh = publicAPI<Session>("/auth/refresh", {
        refreshToken: session.refreshToken,
      })
        .then(async (value) => {
          await unchanged();
          await saveSession(value);
          return value;
        })
        .finally(() => {
          refresh = null;
        });
    token = (await refresh).token;
    await unchanged();
    const value = await request<T>(path, body, token);
    await unchanged();
    return value;
  }
}
