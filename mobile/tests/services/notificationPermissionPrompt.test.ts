import {
  isNotificationPromptDue,
  NOTIFICATION_PROMPT_COOLDOWN_MS,
} from "@/services/notificationPermissionPrompt";

jest.mock("@/storage/appStorage", () => ({
  appStorageKeys: { notificationPermissionPrompt: "prompt" },
  getAppValue: jest.fn(),
  setAppValue: jest.fn(),
}));

describe("notification permission pre-prompt eligibility", () => {
  const now = Date.UTC(2026, 8, 1, 12);

  it("shows immediately when permission has never been requested in-app", () => {
    expect(isNotificationPromptDue(false, null, now)).toBe(true);
  });

  it("does not show again inside the rolling seven-day cooldown", () => {
    expect(isNotificationPromptDue(false, now - NOTIFICATION_PROMPT_COOLDOWN_MS + 1, now)).toBe(
      false,
    );
  });

  it("becomes eligible exactly seven days after the previous appearance", () => {
    expect(isNotificationPromptDue(false, now - NOTIFICATION_PROMPT_COOLDOWN_MS, now)).toBe(true);
  });

  it("never shows while notification permission is granted", () => {
    expect(isNotificationPromptDue(true, null, now)).toBe(false);
    expect(isNotificationPromptDue(true, now - NOTIFICATION_PROMPT_COOLDOWN_MS, now)).toBe(false);
  });
});
