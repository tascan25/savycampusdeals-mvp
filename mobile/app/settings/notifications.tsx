import { Ionicons } from "@expo/vector-icons";
import { AppState, ScrollView, StyleSheet, View } from "react-native";
import { useEffect, useState } from "react";

import { AppText, Button, Screen } from "@/design-system/components";
import { color, radius, space } from "@/design-system/tokens";
import { usePushNotifications } from "@/providers/PushNotificationProvider";

export default function NotificationSettingsScreen() {
  const { permission, enable, openSystemSettings, refresh } = usePushNotifications();
  const [working, setWorking] = useState(false);

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
            Get verification updates, coupon reminders and occasional campus deal announcements. You
            remain in control through Android&apos;s notification settings.
          </AppText>
        </View>

        <View style={styles.card}>
          <View style={styles.statusRow}>
            <View style={styles.copy}>
              <AppText variant="bodyMedium">Notifications on this phone</AppText>
              <AppText variant="caption" color={color.textTertiary}>
                {enabled
                  ? "Enabled. You can control each category in Android settings."
                  : permission === "loading"
                    ? "Checking system permission…"
                    : "Disabled. In-app announcements will still work normally."}
              </AppText>
            </View>
            <View style={[styles.badge, enabled && styles.badgeEnabled]}>
              <AppText variant="caption" color={enabled ? color.success : color.textTertiary}>
                {enabled ? "On" : "Off"}
              </AppText>
            </View>
          </View>
        </View>

        {enabled ? (
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
            <Button label="Open system settings" variant="secondary" onPress={openSystemSettings} />
          </>
        )}

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
});
