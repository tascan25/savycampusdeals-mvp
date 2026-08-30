import { create } from "axios";

import { env } from "@/config/env";
import {
  clearSession as clearSecureStorage,
  getSecureValue,
  secureStorageKeys,
  setSecureValue,
} from "@/storage/secureStore";

/**
 * Session storage + the single-flight refresh lock. Tokens live only in
 * SecureStore (iOS Keychain / Android Keystore) — never AsyncStorage, never
 * logged. See docs/authentication.md for the rotation/reuse-detection
 * design this talks to (POST /api/auth/mobile/refresh).
 */

export type TokenPair = {
  accessToken: string;
  refreshToken: string;
  /** Epoch milliseconds. */
  accessTokenExpiresAt: number;
};

type SessionListener = () => void;
const listeners = new Set<SessionListener>();

/** Fires when the session becomes invalid and the UI must force a re-login. */
export function onSessionExpired(listener: SessionListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notifySessionExpired() {
  listeners.forEach((listener) => listener());
}

export async function saveSession(tokens: TokenPair): Promise<void> {
  await Promise.all([
    setSecureValue(secureStorageKeys.accessToken, tokens.accessToken),
    setSecureValue(secureStorageKeys.refreshToken, tokens.refreshToken),
    setSecureValue(secureStorageKeys.accessTokenExpiresAt, String(tokens.accessTokenExpiresAt)),
  ]);
}

/** Convenience for callers holding a raw `/auth/mobile/*` response body. */
export async function saveSessionFromResponse(response: {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}): Promise<void> {
  await saveSession({
    accessToken: response.access_token,
    refreshToken: response.refresh_token,
    accessTokenExpiresAt: Date.now() + response.expires_in * 1000,
  });
}

export async function readSession(): Promise<TokenPair | null> {
  const [accessToken, refreshToken, expiresAtRaw] = await Promise.all([
    getSecureValue(secureStorageKeys.accessToken),
    getSecureValue(secureStorageKeys.refreshToken),
    getSecureValue(secureStorageKeys.accessTokenExpiresAt),
  ]);

  if (!accessToken || !refreshToken || !expiresAtRaw) {
    return null;
  }

  return {
    accessToken,
    refreshToken,
    accessTokenExpiresAt: Number(expiresAtRaw),
  };
}

export async function hasSession(): Promise<boolean> {
  return (await readSession()) !== null;
}

/** Clears the local session and tells subscribers to route to login. */
export async function endSession(): Promise<void> {
  await clearSecureStorage();
  notifySessionExpired();
}

const EXPIRY_SKEW_MS = 60_000; // refresh ~1 min before actual expiry

// A bare Axios instance with NO interceptors — refresh must never go through
// the interceptor-bearing apiClient, or a failed refresh could recursively
// trigger another refresh attempt.
const refreshClient = create({
  baseURL: `${env.API_URL}/api`,
  timeout: 15_000,
});

let refreshPromise: Promise<string | null> | null = null;

async function doRefresh(refreshToken: string): Promise<string | null> {
  try {
    const { data } = await refreshClient.post("/auth/mobile/refresh", {
      refresh_token: refreshToken,
    });
    await saveSessionFromResponse(data);
    return data.access_token as string;
  } catch {
    // One attempt, one failure, one logout — no retry loop. A refresh
    // failure (expired, revoked, or reuse-detected) always means the same
    // thing to the client: this session is over.
    await endSession();
    return null;
  }
}

/**
 * Returns a valid access token, transparently refreshing it if it's expired
 * or about to expire. Concurrent callers share one in-flight refresh
 * (single-flight lock) so a burst of requests never fires N refresh calls.
 */
export async function getValidAccessToken(): Promise<string | null> {
  const session = await readSession();
  if (!session) return null;

  if (session.accessTokenExpiresAt - EXPIRY_SKEW_MS > Date.now()) {
    return session.accessToken;
  }

  refreshPromise ??= doRefresh(session.refreshToken).finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}

/** Forces a refresh regardless of expiry — used by the 401 retry path. */
export async function forceRefresh(): Promise<string | null> {
  const session = await readSession();
  if (!session) return null;

  refreshPromise ??= doRefresh(session.refreshToken).finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}
