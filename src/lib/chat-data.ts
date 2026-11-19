import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME } from "@shared/constants";
import type { MessagePage } from "@shared/types";
import { ApiError, apiErrorFromBody } from "./api";

const API_BASE = (
  process.env.API_URL?.trim() || "http://127.0.0.1:4300"
).replace(/\/+$/u, "");

const REQUEST_TIMEOUT_MS = 5_000;

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

export type ChannelMessagesResult =
  | { status: "ok"; page: MessagePage }
  | { status: "unauthenticated" }
  | { status: "not_found" };

/**
 * Loads the newest page of a channel's history for the current viewer. The
 * session cookie is forwarded to the Express API, which is the authorization
 * boundary: non-members receive a 404 and are surfaced as `not_found`.
 */
export async function getChannelMessages(
  channelId: string,
  limit = 50,
): Promise<ChannelMessagesResult> {
  const cookie = await readSessionCookie();
  if (!cookie) return { status: "unauthenticated" };

  try {
    const page = await serverFetch<MessagePage>(
      `/api/channels/${encodeURIComponent(channelId)}/messages?limit=${encodeURIComponent(String(limit))}`,
      cookie,
    );
    return { status: "ok", page };
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.status === 401) return { status: "unauthenticated" };
      if (error.status === 404) return { status: "not_found" };
    }
    throw error;
  }
}
