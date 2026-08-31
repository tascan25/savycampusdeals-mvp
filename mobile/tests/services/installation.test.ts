import * as SecureStore from "expo-secure-store";

import { getPushInstallationId } from "@/services/installation";

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

const mockedSecureStore = jest.mocked(SecureStore);

describe("getPushInstallationId", () => {
  it("creates one stable non-secret identifier and stores it outside the session", async () => {
    mockedSecureStore.getItemAsync.mockResolvedValue(null);
    const first = await getPushInstallationId();
    const second = await getPushInstallationId();

    expect(first).toMatch(/^install_[a-z0-9_]+$/);
    expect(second).toBe(first);
    expect(mockedSecureStore.setItemAsync).toHaveBeenCalledTimes(1);
    expect(mockedSecureStore.setItemAsync).toHaveBeenCalledWith("scd_push_installation_id", first);
  });
});
