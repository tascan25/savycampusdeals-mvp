import * as Notifications from "expo-notifications";

import { unregisterNativePushToken } from "@/services/pushLifecycle";

jest.mock("expo-notifications", () => ({
  unregisterForNotificationsAsync: jest.fn(),
}));

describe("unregisterNativePushToken", () => {
  it("invalidates the provider token during local logout", async () => {
    jest.mocked(Notifications.unregisterForNotificationsAsync).mockResolvedValue();
    await unregisterNativePushToken();
    expect(Notifications.unregisterForNotificationsAsync).toHaveBeenCalledTimes(1);
  });
});
