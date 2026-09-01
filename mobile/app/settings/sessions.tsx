import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { ActivityIndicator, Alert, FlatList, StyleSheet, View } from "react-native";

import { apiListMobileSessions } from "@/api/profile";
import { queryKeys } from "@/api/queryKeys";
import { AppText, Button, Screen } from "@/design-system/components";
import { color, space } from "@/design-system/tokens";
import { useAuth } from "@/providers/AuthProvider";

export default function SessionsScreen() {
  const { logoutAllDevices } = useAuth();
  const sessions = useQuery({
    queryKey: queryKeys.auth.sessions(),
    queryFn: apiListMobileSessions,
  });
  const signOutEverywhere = () =>
    Alert.alert(
      "Sign out everywhere?",
      "Every active mobile session will end, including this device.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Sign out everywhere", style: "destructive", onPress: logoutAllDevices },
      ],
    );

  return (
    <Screen edges={["bottom"]}>
      <FlatList
        data={sessions.data ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        renderItem={({ item: session }) => (
          <View style={styles.sessionRow}>
            <View style={styles.icon}>
              <Ionicons
                name={session.platform === "ios" ? "logo-apple" : "logo-android"}
                size={20}
                color={color.textSecondary}
              />
            </View>
            <View style={styles.copy}>
              <AppText variant="bodyMedium">
                {session.device_name ||
                  (session.platform === "ios" ? "iOS device" : "Android device")}
              </AppText>
              <AppText variant="caption" color={color.textTertiary}>
                Last active{" "}
                {new Date(session.last_used_at).toLocaleString("en-IN", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </AppText>
            </View>
          </View>
        )}
        ListHeaderComponent={
          <>
            <View style={styles.intro}>
              <AppText variant="h1">Signed-in devices</AppText>
              <AppText variant="body" color={color.textSecondary}>
                These are the active mobile sessions connected to your account.
              </AppText>
            </View>
            {sessions.isLoading ? <ActivityIndicator color={color.primary} /> : null}
            {sessions.isError ? (
              <View style={styles.error}>
                <AppText variant="small" color={color.destructive}>
                  Couldn&apos;t load your sessions.
                </AppText>
                <Button label="Try again" variant="secondary" onPress={() => sessions.refetch()} />
              </View>
            ) : null}
          </>
        }
        ListFooterComponent={
          <View style={styles.footer}>
            <Button label="Sign out everywhere" variant="secondary" onPress={signOutEverywhere} />
          </View>
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: space.lg, paddingBottom: space.xxl },
  intro: { gap: space.xs, marginBottom: space.xl },
  sessionRow: {
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    padding: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.border,
    backgroundColor: color.surface,
  },
  icon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: color.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  copy: { flex: 1, gap: 3 },
  error: { gap: space.md, marginBottom: space.xl },
  footer: { marginTop: space.xl },
});
