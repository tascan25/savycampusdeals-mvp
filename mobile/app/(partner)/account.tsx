import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { type ReactNode, useState } from "react";
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Switch, View } from "react-native";

import { apiGetPartnerProfile } from "@/api/partner";
import { queryKeys } from "@/api/queryKeys";
import { LoadingShimmer } from "@/components/LoadingShimmer";
import { env } from "@/config/env";
import { AppText, Screen } from "@/design-system/components";
import { color, radius, space } from "@/design-system/tokens";
import { useAnnouncements } from "@/providers/AnnouncementProvider";
import { useAppLock } from "@/providers/AppLockProvider";
import { useAuth } from "@/providers/AuthProvider";

function Row({
  icon,
  title,
  subtitle,
  onPress,
  trailing,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  trailing?: ReactNode;
}) {
  const body = (
    <>
      <View style={styles.rowIcon}>
        <Ionicons name={icon} size={19} color={color.textSecondary} />
      </View>
      <View style={styles.rowCopy}>
        <AppText variant="bodyMedium">{title}</AppText>
        {subtitle ? (
          <AppText variant="caption" color={color.textTertiary}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {trailing ??
        (onPress ? <Ionicons name="chevron-forward" size={18} color={color.textTertiary} /> : null)}
    </>
  );
  return onPress ? (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      {body}
    </Pressable>
  ) : (
    <View style={styles.row}>{body}</View>
  );
}

export default function PartnerAccountScreen() {
  const { user, logout, logoutAllDevices } = useAuth();
  const { supported, enabled, setEnabled } = useAppLock();
  const { unreadCount, openCentre } = useAnnouncements();
  const router = useRouter();
  const profile = useQuery({
    queryKey: queryKeys.partner.profile(),
    queryFn: apiGetPartnerProfile,
  });
  const [togglingLock, setTogglingLock] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const version = Constants.nativeAppVersion ?? Constants.expoConfig?.version ?? "1.0.0";
  const openWeb = async (path: string) => {
    const url = `${env.WEB_URL.replace(/\/$/, "")}${path}`;
    if (await Linking.canOpenURL(url)) await Linking.openURL(url);
  };
  const toggleLock = async (next: boolean) => {
    setTogglingLock(true);
    const applied = await setEnabled(next);
    setTogglingLock(false);
    if (next && !applied)
      Alert.alert("App lock wasn't enabled", "Biometric verification was cancelled or failed.");
  };
  const signOut = () =>
    Alert.alert("Sign out?", "You can sign in again with the same partner account.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out",
        style: "destructive",
        onPress: async () => {
          setSigningOut(true);
          await logout();
        },
      },
    ]);

  return (
    <Screen edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View>
          <AppText variant="caption" color={color.success} style={styles.eyebrow}>
            PARTNER ACCOUNT
          </AppText>
          <AppText variant="h1">Account</AppText>
        </View>
        {profile.isLoading ? (
          <>
            <LoadingShimmer style={styles.identitySkeleton} />
            <LoadingShimmer style={styles.outletSkeleton} />
          </>
        ) : (
          <>
            <View style={styles.identity}>
              <View style={styles.avatar}>
                <AppText variant="h1">
                  {(profile.data?.name || user?.name || "P").charAt(0).toUpperCase()}
                </AppText>
              </View>
              <View style={styles.rowCopy}>
                <AppText variant="h2" numberOfLines={1}>
                  {profile.data?.name || user?.name}
                </AppText>
                <AppText variant="small" color={color.textSecondary} numberOfLines={1}>
                  {profile.data?.email || user?.email}
                </AppText>
                <View style={styles.partnerBadge}>
                  <Ionicons name="shield-checkmark" size={13} color={color.success} />
                  <AppText variant="caption" color={color.success}>
                    Verified outlet partner
                  </AppText>
                </View>
              </View>
            </View>
            <View style={styles.outletCard}>
              <AppText variant="caption" color={color.textTertiary}>
                ASSIGNED OUTLET
              </AppText>
              <AppText variant="h3">{profile.data?.outlet?.name || "Outlet unavailable"}</AppText>
              <AppText variant="small" color={color.textSecondary}>
                {profile.data?.outlet?.address ||
                  profile.data?.outlet?.city ||
                  "Contact Savvy support if this assignment is incorrect."}
              </AppText>
              <AppText variant="caption" color={color.textTertiary}>
                Offers and outlet details are managed by the Savvy admin.
              </AppText>
            </View>
          </>
        )}

        <View style={styles.section}>
          <AppText variant="caption" color={color.textTertiary} style={styles.sectionLabel}>
            UPDATES
          </AppText>
          <View style={styles.sectionBody}>
            <Row
              icon="notifications-outline"
              title="Announcements"
              subtitle={
                unreadCount
                  ? `${unreadCount} unread partner update${unreadCount === 1 ? "" : "s"}`
                  : "Partner and platform updates"
              }
              onPress={openCentre}
            />
            <Row
              icon="phone-portrait-outline"
              title="Push notifications"
              subtitle="Control alerts on this phone"
              onPress={() => router.push("/settings/notifications" as never)}
            />
          </View>
        </View>
        <View style={styles.section}>
          <AppText variant="caption" color={color.textTertiary} style={styles.sectionLabel}>
            SECURITY
          </AppText>
          <View style={styles.sectionBody}>
            {supported ? (
              <Row
                icon="lock-closed-outline"
                title="App lock"
                subtitle="Require biometrics when returning to Savvy"
                trailing={
                  <Switch
                    value={enabled}
                    disabled={togglingLock}
                    onValueChange={(next) => void toggleLock(next)}
                    trackColor={{ false: color.surfaceElevated, true: color.primary }}
                  />
                }
              />
            ) : null}
            <Row
              icon="laptop-outline"
              title="Active sessions"
              subtitle="Review devices signed into this account"
              onPress={() => router.push("/settings/sessions" as never)}
            />
            <Row
              icon="key-outline"
              title="Change password"
              subtitle="Update the password for this partner account"
              onPress={() => router.push("/settings/change-password" as never)}
            />
          </View>
        </View>
        <View style={styles.section}>
          <AppText variant="caption" color={color.textTertiary} style={styles.sectionLabel}>
            SUPPORT
          </AppText>
          <View style={styles.sectionBody}>
            <Row
              icon="help-circle-outline"
              title="Help & support"
              onPress={() => void openWeb("/support")}
            />
            <Row
              icon="document-text-outline"
              title="Terms of service"
              onPress={() => void openWeb("/terms")}
            />
            <Row
              icon="hand-left-outline"
              title="Privacy policy"
              onPress={() => void openWeb("/privacy")}
            />
          </View>
        </View>
        <View style={styles.section}>
          <AppText variant="caption" color={color.textTertiary} style={styles.sectionLabel}>
            SESSION
          </AppText>
          <View style={styles.sectionBody}>
            <Row
              icon="log-out-outline"
              title={signingOut ? "Signing out…" : "Sign out"}
              onPress={signingOut ? undefined : signOut}
            />
            <Row
              icon="close-circle-outline"
              title="Sign out everywhere"
              subtitle="End every active mobile session"
              onPress={() => void logoutAllDevices()}
            />
          </View>
        </View>
        <AppText variant="caption" color={color.textTertiary} style={styles.version}>
          Savvy Campus · Version {version}
        </AppText>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, paddingBottom: 120, gap: space.lg },
  eyebrow: { letterSpacing: 1.8, fontWeight: "800" },
  identity: { flexDirection: "row", alignItems: "center", gap: space.md },
  avatar: {
    width: 68,
    height: 68,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: color.primary,
  },
  identitySkeleton: { height: 72 },
  outletSkeleton: { height: 130 },
  partnerBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 4,
  },
  outletCard: {
    gap: space.sm,
    padding: space.lg,
    borderRadius: radius.lg,
    backgroundColor: color.primarySoft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(99,102,241,0.3)",
  },
  section: { gap: space.sm },
  sectionLabel: { letterSpacing: 1.2, paddingHorizontal: space.xs },
  sectionBody: { borderRadius: radius.lg, overflow: "hidden", backgroundColor: color.surface },
  row: {
    minHeight: 68,
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    padding: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.border,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: color.surfaceMuted,
  },
  rowCopy: { flex: 1, gap: 2 },
  pressed: { opacity: 0.65 },
  version: { textAlign: "center" },
});
