import { AxiosError, AxiosHeaders } from "axios";
import * as SecureStore from "expo-secure-store";

import {
  endSession,
  readCachedUser,
  saveCachedUser,
  shouldExpireSessionForRefreshError,
} from "@/services/session";
import type { User } from "@/types/user";

jest.mock("@/config/env", () => ({
  env: { API_URL: "http://127.0.0.1:8000", WEB_URL: "http://127.0.0.1:3000" },
}));

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

const mockedSecureStore = jest.mocked(SecureStore);

function responseError(status: number): AxiosError {
  return new AxiosError("Request failed", String(status), undefined, undefined, {
    status,
    statusText: "",
    headers: new AxiosHeaders(),
    config: { headers: new AxiosHeaders() } as never,
    data: {},
    request: undefined,
  } as never);
}

const cachedUser = {
  id: "student-1",
  email: "student@example.com",
  role: "student",
} as User;

describe("mobile session resilience", () => {
  beforeEach(() => jest.clearAllMocks());

  it("expires only after an explicit authentication rejection", () => {
    expect(shouldExpireSessionForRefreshError(responseError(401))).toBe(true);
    expect(shouldExpireSessionForRefreshError(responseError(403))).toBe(true);
    expect(shouldExpireSessionForRefreshError(responseError(500))).toBe(false);
    expect(shouldExpireSessionForRefreshError(new AxiosError("timeout", "ECONNABORTED"))).toBe(
      false,
    );
  });

  it("stores and restores the cached identity from secure storage", async () => {
    mockedSecureStore.getItemAsync.mockResolvedValue(JSON.stringify(cachedUser));

    await saveCachedUser(cachedUser);
    await expect(readCachedUser()).resolves.toEqual(cachedUser);

    expect(mockedSecureStore.setItemAsync).toHaveBeenCalledWith(
      "scd_cached_user_v1",
      JSON.stringify(cachedUser),
    );
  });

  it("ignores a corrupted cached identity", async () => {
    mockedSecureStore.getItemAsync.mockResolvedValue("not-json");

    await expect(readCachedUser()).resolves.toBeNull();
  });

  it("removes the cached identity during a real logout", async () => {
    await endSession();

    expect(mockedSecureStore.deleteItemAsync).toHaveBeenCalledWith("scd_cached_user_v1");
  });
});
