import * as LocalAuthentication from "expo-local-authentication";

import { getSecureValue, secureStorageKeys, setSecureValue } from "@/storage/secureStore";

/**
 * A local UI curtain over already-issued tokens — never a backend auth
 * substitute. Disabling it or a failed device unlock never touches the
 * session in src/services/session.ts; it only gates rendering of the app's
 * screens. See docs/authentication.md.
 */

export async function isBiometricSupported(): Promise<boolean> {
  const [hasHardware, isEnrolled] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
  ]);
  return hasHardware && isEnrolled;
}

export async function isAppLockEnabled(): Promise<boolean> {
  return (await getSecureValue(secureStorageKeys.appLockEnabled)) === "true";
}

export async function setAppLockEnabled(enabled: boolean): Promise<void> {
  await setSecureValue(secureStorageKeys.appLockEnabled, enabled ? "true" : "false");
}

export async function requestUnlock(promptMessage = "Unlock Savvy Campus"): Promise<boolean> {
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage,
    disableDeviceFallback: false,
    cancelLabel: "Cancel",
  });
  return result.success;
}
