import { Ionicons } from "@expo/vector-icons";
import { AppState, ScrollView, StyleSheet, View } from "react-native";
import { useEffect, useState } from "react";

import { AppText, Button, Screen } from "@/design-system/components";
import { color, radius, space } from "@/design-system/tokens";
import { usePushNotifications } from "@/providers/PushNotificationProvider";
import { useAuth } from "@/providers/AuthProvider";
import {
  cancelAllManagedLocalNotifications,
  getManagedLocalNotificationCount,
  presentDevelopmentNotification,
  scheduleDevelopmentNotification,
} from "@/services/localNotifications";

export default function NotificationSettingsScreen() {
  const { user } = useAuth();
  const isStudent = user?.role === "student";
  const { permission, enable, openSystemSettings, refresh, reconcileReminders } =
    usePushNotifications();
  const [working, setWorking] = useState(false);
  const [testStatus, setTestStatus] = useState("");

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void refresh();
    });
    return () => subscription.remove();
  }, [refresh]);

  const activate = async () => {
    setWorking(true);
    await enable();
    setWorking(false);
  };

  const enabled = permission === "enabled";
  const denied = permission === "denied";

  const runDevelopmentAction = async (action: () => Promise<string | void>, success: string) => {
    setWorking(true);
    setTestStatus("");
    try {
      const result = await action();
      setTestStatus(result ?? success);
    } catch {
      setTestStatus("The notification action failed. Check permission and try again.");
    } finally {
      setWorking(false);
    }
  };
  return (
    <Screen edges={["bottom"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.heroIcon, enabled && styles.heroIconEnabled]}>
          <Ionicons
            name={enabled ? "notifications" : "notifications-outline"}
            size={28}
            color={enabled ? color.success : color.textSecondary}
          />
        </View>
        <View style={styles.intro}>
          <AppText variant="h1">Stay in the loop</AppText>
          <AppText variant="body" color={color.textSecondary}>
            {isStudent
              ? "Get verification updates, coupon reminders and occasional campus deal announcements."
              : "Get partner announcements and important outlet account updates."}{" "}
            You remain in control through your device&apos;s notification settings.
          </AppText>
        </View>

        <View style={styles.card}>
          <View style={styles.statusRow}>
            <View style={styles.copy}>
              <AppText variant="bodyMedium">Notifications on this phone</AppText>
              <AppText variant="caption" color={color.textTertiary}>
                {enabled
                  ? "Enabled. You can control notification behavior in system settings."
                  : permission === "loading"
                    ? "Checking system permission…"
                    : denied
                      ? "Blocked in system settings. In-app announcements still work normally."
                      : "Not enabled yet. In-app announcements still work normally."}
              </AppText>
            </View>
            <View style={[styles.badge, enabled && styles.badgeEnabled]}>
              <AppText variant="caption" color={enabled ? color.success : color.textTertiary}>
                {enabled ? "On" : "Off"}
              </AppText>
            </View>
          </View>
        </View>

        {enabled || denied ? (
          <Button
            label="Open system notification settings"
            variant="secondary"
            onPress={openSystemSettings}
          />
        ) : (
          <>
            <Button
              label="Enable notifications"
              onPress={activate}
              loading={working || permission === "loading"}
            />
          </>
        )}

        {enabled && isStudent ? (
          <Button
            label="Refresh scheduled reminders"
            variant="secondary"
            onPress={() =>
              void runDevelopmentAction(async () => {
                const count = await reconcileReminders();
                return `${count} reminder${count === 1 ? "" : "s"} scheduled.`;
              }, "Reminders refreshed.")
            }
            disabled={working}
          />
        ) : null}

        {__DEV__ ? (
          <View style={styles.developmentCard}>
            <View style={styles.developmentHeading}>
              <Ionicons name="flask-outline" size={19} color="#C7D2FE" />
              <View style={styles.copy}>
                <AppText variant="bodyMedium">Local notification testing</AppText>
                <AppText variant="caption" color={color.textTertiary}>
                  Development build only. No backend or push token is used.
                </AppText>
              </View>
            </View>
            <Button
              label="Show test notification now"
              onPress={() =>
                void runDevelopmentAction(presentDevelopmentNotification, "Test notification sent.")
              }
              disabled={!enabled || working}
            />
            <Button
              label="Schedule test in 10 seconds"
              variant="secondary"
              onPress={() =>
                void runDevelopmentAction(async () => {
                  await scheduleDevelopmentNotification(10);
                }, "Test scheduled. Background the app now.")
              }
              disabled={!enabled || working}
            />
            <Button
              label="Count managed reminders"
              variant="secondary"
              onPress={() =>
                void runDevelopmentAction(async () => {
                  const count = await getManagedLocalNotificationCount();
                  return `${count} managed reminder${count === 1 ? "" : "s"} scheduled.`;
                }, "Reminder count refreshed.")
              }
              disabled={working}
            />
            <Button
              label="Cancel managed reminders"
              variant="secondary"
              onPress={() =>
                void runDevelopmentAction(
                  cancelAllManagedLocalNotifications,
                  "Managed reminders cancelled.",
                )
              }
              disabled={working}
            />
            {testStatus ? (
              <AppText variant="caption" color={color.textSecondary} style={styles.testStatus}>
                {testStatus}
              </AppText>
            ) : null}
          </View>
        ) : null}

        <AppText variant="caption" color={color.textTertiary} style={styles.note}>
          Savvy never includes verification documents, coupon codes or other sensitive account data
          in a notification.
        </AppText>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: space.lg, paddingBottom: space.xxl, gap: space.lg },
  heroIcon: {
    width: 58,
    height: 58,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: color.surfaceElevated,
  },
  heroIconEnabled: { backgroundColor: "rgba(34,197,94,0.12)" },
  intro: { gap: space.sm },
  card: { borderRadius: radius.lg, backgroundColor: color.surface, padding: space.md },
  statusRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  copy: { flex: 1, gap: 4 },
  badge: {
    borderRadius: radius.pill,
    backgroundColor: color.surfaceElevated,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  badgeEnabled: { backgroundColor: "rgba(34,197,94,0.12)" },
  note: { textAlign: "center", paddingHorizontal: space.md },
  developmentCard: {
    gap: space.md,
    padding: space.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.borderStrong,
    backgroundColor: color.surfaceMuted,
  },
  developmentHeading: { flexDirection: "row", alignItems: "center", gap: space.md },
  testStatus: { textAlign: "center" },
});
