import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE_NAME } from "@shared/constants";
import type {
  AuthResponse,
  InvitePreview,
  ServerSummary,
  UserDto,
  WorkspaceDto,
} from "@shared/types";
import { isPlausibleInviteCode } from "@shared/validation";
import { ApiError, apiErrorFromBody } from "./api";
import { safeNextPath } from "./auth";

const API_BASE = (
  process.env.API_URL?.trim() || "http://127.0.0.1:4300"
).replace(/\/+$/u, "");

const REQUEST_TIMEOUT_MS = 5_000;

/** Reads the opaque session cookie and returns a ready `Cookie` header value. */
async function readSessionCookie(): Promise<string | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;
  return token ? `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}` : null;
}

async function serverFetch<T>(path: string, cookie: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      cache: "no-store",
      headers: {
        Accept: "application/json",
        Cookie: cookie,
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    throw new ApiError(0, "INTERNAL_ERROR", "API sunucusuna ulaşılamadı.");
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = null;
    }
  }

  if (!response.ok) {
    throw apiErrorFromBody(response.status, body);
  }

  return body as T;
}

/**
 * Server-side session lookup. Failures degrade to a logged-out view so public
 * pages (landing, invite) still render when the API is unavailable.
 */
export async function getSessionUser(): Promise<UserDto | null> {
  const cookie = await readSessionCookie();
  if (!cookie) return null;

  try {
    const body = await serverFetch<AuthResponse>("/api/auth/me", cookie);
    return body.user;
  } catch {
    return null;
  }
}

/** UX guard only; Express remains the authorization boundary. */
export async function requireUser(next?: string | null): Promise<UserDto> {
  const user = await getSessionUser();
  if (!user) {
    const target = next ? safeNextPath(next, "") : "";
    redirect(target ? `/giris?next=${encodeURIComponent(target)}` : "/giris");
  }
  return user;
}

export async function getMyServers(): Promise<ServerSummary[]> {
  const cookie = await readSessionCookie();
  if (!cookie) return [];

  try {
    const body = await serverFetch<{ servers: ServerSummary[] }>("/api/servers", cookie);
    return body.servers;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return [];
    throw error;
  }
}

export async function getWorkspace(serverId: string): Promise<WorkspaceDto | null> {
  const cookie = await readSessionCookie();
  if (!cookie) return null;

  try {
    const body = await serverFetch<{ workspace: WorkspaceDto }>(
      `/api/servers/${encodeURIComponent(serverId)}`,
      cookie,
    );
    return body.workspace;
  } catch (error) {
    if (error instanceof ApiError && (error.status === 401 || error.status === 404)) {
      return null;
    }
    throw error;
  }
}

export type InviteLookup =
  | { status: "ok"; invite: InvitePreview }
  | { status: "unauthenticated" }
  | { status: "not_found" };

export async function getInvite(code: string): Promise<InviteLookup> {
  if (!isPlausibleInviteCode(code)) {
    return { status: "not_found" };
  }

  const cookie = await readSessionCookie();
  if (!cookie) {
    return { status: "unauthenticated" };
  }

  try {
    const invite = await serverFetch<InvitePreview>(
      `/api/invites/${encodeURIComponent(code)}`,
      cookie,
    );
    return { status: "ok", invite };
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.status === 401) return { status: "unauthenticated" };
      if (error.status === 404) return { status: "not_found" };
    }
    throw error;
  }
}
