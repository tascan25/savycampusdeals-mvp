import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Non-sensitive, device-local application state. Authentication/session data
 * must continue to use SecureStore instead of this module.
 */
export const appStorageKeys = {
  notificationPermissionPrompt: "scd_notification_permission_prompt_v1",
  localNotificationRegistry: "scd_local_notification_registry_v1",
  claimNotificationReceipts: "scd_claim_notification_receipts_v1",
  offerReminderRegistry: "scd_offer_reminder_registry_v1",
} as const;

export type AppStorageKey = (typeof appStorageKeys)[keyof typeof appStorageKeys];

export async function getAppValue(key: AppStorageKey): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(key);
  } catch {
    return null;
  }
}

export async function setAppValue(key: AppStorageKey, value: string): Promise<void> {
  await AsyncStorage.setItem(key, value);
}

export async function deleteAppValue(key: AppStorageKey): Promise<void> {
  await AsyncStorage.removeItem(key);
}
