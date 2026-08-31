import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

/**
 * Invalidates this installation's native provider token while preserving the
 * user's OS permission. This is a privacy fallback when logout happens while
 * the backend is unreachable; the next login obtains and registers a new token.
 */
export async function unregisterNativePushToken(): Promise<void> {
  if (Platform.OS !== "android" && Platform.OS !== "ios") return;
  await Notifications.unregisterForNotificationsAsync();
}
