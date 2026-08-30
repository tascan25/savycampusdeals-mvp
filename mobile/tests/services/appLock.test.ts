import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";

import {
  isAppLockEnabled,
  isBiometricSupported,
  requestUnlock,
  setAppLockEnabled,
} from "@/services/appLock";

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

jest.mock("expo-local-authentication", () => ({
  hasHardwareAsync: jest.fn(),
  isEnrolledAsync: jest.fn(),
  authenticateAsync: jest.fn(),
}));

const mockedSecureStore = jest.mocked(SecureStore);
const mockedLocalAuth = jest.mocked(LocalAuthentication);

beforeEach(() => {
  jest.clearAllMocks();
});

describe("isBiometricSupported", () => {
  it("is only true when hardware exists AND biometrics are enrolled", async () => {
    mockedLocalAuth.hasHardwareAsync.mockResolvedValue(true);
    mockedLocalAuth.isEnrolledAsync.mockResolvedValue(false);
    expect(await isBiometricSupported()).toBe(false);

    mockedLocalAuth.isEnrolledAsync.mockResolvedValue(true);
    expect(await isBiometricSupported()).toBe(true);
  });
});

describe("isAppLockEnabled / setAppLockEnabled", () => {
  it("round-trips the preference through SecureStore as a string flag", async () => {
    mockedSecureStore.getItemAsync.mockResolvedValue("true");
    expect(await isAppLockEnabled()).toBe(true);

    mockedSecureStore.getItemAsync.mockResolvedValue(null);
    expect(await isAppLockEnabled()).toBe(false);

    await setAppLockEnabled(true);
    expect(mockedSecureStore.setItemAsync).toHaveBeenCalledWith("scd_app_lock_enabled", "true");

    await setAppLockEnabled(false);
    expect(mockedSecureStore.setItemAsync).toHaveBeenCalledWith("scd_app_lock_enabled", "false");
  });
});

describe("requestUnlock", () => {
  it("resolves true only when the platform prompt succeeds", async () => {
    mockedLocalAuth.authenticateAsync.mockResolvedValue({ success: true });
    expect(await requestUnlock()).toBe(true);

    mockedLocalAuth.authenticateAsync.mockResolvedValue({
      success: false,
      error: "user_cancel",
    });
    expect(await requestUnlock()).toBe(false);
  });
});
