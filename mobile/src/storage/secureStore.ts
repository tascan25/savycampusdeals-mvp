import * as SecureStore from "expo-secure-store";

/**
 * The ONLY place tokens/session data may be written. Never use AsyncStorage
 * for anything that flows through this module — see docs/security.md and
 * docs/authentication.md. Values here go into iOS Keychain / Android
 * Keystore, not plain files.
 */
export const secureStorageKeys = {
  accessToken: "scd_access_token",
  refreshToken: "scd_refresh_token",
  accessTokenExpiresAt: "scd_access_token_expires_at",
  /** Cached identity keeps navigation stable during temporary API outages. */
  cachedUser: "scd_cached_user_v1",
  /** A device-level preference, not session data — deliberately excluded
   * from `clearSession()` so enabling app-lock survives logout/login. */
  appLockEnabled: "scd_app_lock_enabled",
  /** Stable per-install identifier used to unregister only this phone. */
  pushInstallationId: "scd_push_installation_id",
} as const;

const sessionKeys = [
  secureStorageKeys.accessToken,
  secureStorageKeys.refreshToken,
  secureStorageKeys.accessTokenExpiresAt,
  secureStorageKeys.cachedUser,
] as const;

export type SecureStorageKey = (typeof secureStorageKeys)[keyof typeof secureStorageKeys];

export async function getSecureValue(key: SecureStorageKey): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    // A corrupted keychain entry or platform-level failure should never crash
    // the app — treat it as "no value" and let the caller fall back to a
    // logged-out state.
    return null;
  }
}

export async function setSecureValue(key: SecureStorageKey, value: string): Promise<void> {
  await SecureStore.setItemAsync(key, value);
}

export async function deleteSecureValue(key: SecureStorageKey): Promise<void> {
  await SecureStore.deleteItemAsync(key);
}

export async function clearSession(): Promise<void> {
  await Promise.all(sessionKeys.map((key) => deleteSecureValue(key)));
}
