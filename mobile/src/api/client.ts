import { create, isAxiosError, type InternalAxiosRequestConfig } from "axios";

import { env } from "@/config/env";
import { forceRefresh, getValidAccessToken } from "@/services/session";

import { toApiError } from "./errors";

/** Lightweight, dependency-free request correlation id (not a security token). */
function correlationId(): string {
  return `mob_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

type RetryableConfig = InternalAxiosRequestConfig & { _retried?: boolean };

export const apiClient = create({
  baseURL: `${env.API_URL}/api`,
  timeout: 15_000,
});

apiClient.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  config.headers.set("X-Request-Id", correlationId());

  const token = await getValidAccessToken();
  if (token) {
    config.headers.set("Authorization", `Bearer ${token}`);
  }

  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (!isAxiosError(error) || error.response?.status !== 401) {
      throw toApiError(error);
    }

    const config = error.config as RetryableConfig | undefined;
    // Retry-after-refresh is opt-in for safe, idempotent reads only. A
    // safelist of retryable methods degrades gracefully if it misses
    // something new (worst case: an extra login prompt); a blocklist of
    // "non-idempotent" endpoints degrades dangerously (a newly added
    // mutation silently becomes replayable). Coupon claims, redemptions,
    // account deletion, and password changes are never in the safelist.
    const isRetryableRead = config?.method?.toLowerCase() === "get";

    if (!config || !isRetryableRead || config._retried) {
      throw toApiError(error);
    }

    const newToken = await forceRefresh();
    if (!newToken) {
      // forceRefresh already ended the session on failure.
      throw toApiError(error);
    }

    config._retried = true;
    config.headers.set("Authorization", `Bearer ${newToken}`);
    return apiClient.request(config);
  },
);
