import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, View } from "react-native";

import { apiListMobileSessions } from "@/api/profile";
import { queryKeys } from "@/api/queryKeys";
import { AppText, Button, Screen } from "@/design-system/components";
import { color, radius, space } from "@/design-system/tokens";
import { useAuth } from "@/providers/AuthProvider";

export default function SessionsScreen() {
  const { logoutAllDevices } = useAuth();
  const sessions = useQuery({ queryKey: queryKeys.auth.sessions(), queryFn: apiListMobileSessions });
  const signOutEverywhere = () => Alert.alert("Sign out everywhere?", "Every active mobile session will end, including this device.", [
    { text: "Cancel", style: "cancel" },
    { text: "Sign out everywhere", style: "destructive", onPress: logoutAllDevices },
  ]);

  return <Screen edges={["bottom"]}>
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.intro}>
        <AppText variant="h1">Signed-in devices</AppText>
        <AppText variant="body" color={color.textSecondary}>These are the active mobile sessions connected to your account.</AppText>
      </View>
      {sessions.isLoading ? <ActivityIndicator color={color.primary} /> : null}
      {sessions.isError ? <View style={styles.error}><AppText variant="small" color={color.destructive}>Couldn&apos;t load your sessions.</AppText><Button label="Try again" variant="secondary" onPress={() => sessions.refetch()} /></View> : null}
      <View style={styles.list}>
        {sessions.data?.map((session) => <View key={session.id} style={styles.sessionRow}>
          <View style={styles.icon}><Ionicons name={session.platform === "ios" ? "logo-apple" : "logo-android"} size={20} color={color.textSecondary} /></View>
          <View style={styles.copy}>
            <AppText variant="bodyMedium">{session.device_name || (session.platform === "ios" ? "iOS device" : "Android device")}</AppText>
            <AppText variant="caption" color={color.textTertiary}>Last active {new Date(session.last_used_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</AppText>
          </View>
        </View>)}
      </View>
      <Button label="Sign out everywhere" variant="secondary" onPress={signOutEverywhere} />
    </ScrollView>
  </Screen>;
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: space.lg, paddingBottom: space.xxl, gap: space.xl }, intro: { gap: space.xs }, list: { borderRadius: radius.lg, backgroundColor: color.surface, overflow: "hidden" }, sessionRow: { minHeight: 72, flexDirection: "row", alignItems: "center", gap: space.md, padding: space.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.border }, icon: { width: 38, height: 38, borderRadius: 13, backgroundColor: color.surfaceMuted, alignItems: "center", justifyContent: "center" }, copy: { flex: 1, gap: 3 }, error: { gap: space.md },
});
