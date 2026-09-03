import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { type ReactNode, useState } from "react";
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Switch, View } from "react-native";

import { env } from "@/config/env";
import { StudentAvatar } from "@/components/StudentAvatar";
import { AppText, Screen } from "@/design-system/components";
import { color, minTouchTarget, radius, space } from "@/design-system/tokens";
import { useAnnouncements } from "@/providers/AnnouncementProvider";
import { useAppLock } from "@/providers/AppLockProvider";
import { useAuth } from "@/providers/AuthProvider";
import { getVerificationHref } from "@/utils/verificationRoute";

type IconName = keyof typeof Ionicons.glyphMap;

function SettingsRow({
  icon,
  title,
  subtitle,
  onPress,
  trailing,
  destructive,
}: {
  icon: IconName;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  trailing?: ReactNode;
  destructive?: boolean;
}) {
  const content = (
    <>
      <View style={[styles.rowIcon, destructive && styles.rowIconDestructive]}>
        <Ionicons
          name={icon}
          size={19}
          color={destructive ? color.destructive : color.textSecondary}
        />
      </View>
      <View style={styles.rowCopy}>
        <AppText variant="bodyMedium" color={destructive ? color.destructive : color.textPrimary}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="caption" color={color.textTertiary} numberOfLines={2}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {trailing ??
        (onPress ? <Ionicons name="chevron-forward" size={18} color={color.textTertiary} /> : null)}
    </>
  );

  if (!onPress) return <View style={styles.settingsRow}>{content}</View>;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={({ pressed }) => [styles.settingsRow, pressed && styles.rowPressed]}
    >
      {content}
    </Pressable>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <AppText variant="caption" color={color.textTertiary} style={styles.sectionLabel}>
        {title}
      </AppText>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

export default function ProfileTab() {
  const { user, logout, logoutAllDevices } = useAuth();
  const { supported, enabled, setEnabled } = useAppLock();
  const { unreadCount, openCentre } = useAnnouncements();
  const router = useRouter();
  const [togglingLock, setTogglingLock] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  if (!user) return null;
  const verified = user.verification_status === "approved";
  const memberSince = user.created_at ? new Date(user.created_at).getFullYear().toString() : "—";
  const appVersion = Constants.nativeAppVersion ?? Constants.expoConfig?.version ?? "1.0.0";

  const onToggleLock = async (next: boolean) => {
    setTogglingLock(true);
    const applied = await setEnabled(next);
    setTogglingLock(false);
    if (next && !applied)
      Alert.alert("App lock wasn't enabled", "Biometric verification was cancelled or failed.");
  };

  const onLogout = () =>
    Alert.alert("Sign out?", "You can sign in again with the same account.", [
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

  const onLogoutAll = () =>
    Alert.alert("Sign out everywhere?", "This ends every active mobile session.", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign out everywhere", style: "destructive", onPress: logoutAllDevices },
    ]);

  const openWebPath = async (path: string) => {
    const url = `${env.WEB_URL.replace(/\/$/, "")}${path}`;
    if (await Linking.canOpenURL(url)) await Linking.openURL(url);
    else Alert.alert("Couldn't open this page", url);
  };

  return (
    <Screen edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <AppText variant="h1">Profile</AppText>

        <View style={styles.identity}>
          <StudentAvatar avatarKey={user.avatar_key} name={user.name} size={68} />
          <View style={styles.identityCopy}>
            <View style={styles.nameRow}>
              <AppText variant="h2" numberOfLines={1} style={styles.name}>
                {user.name}
              </AppText>
              {verified ? (
                <Ionicons name="checkmark-circle" size={18} color={color.success} />
              ) : null}
            </View>
            <AppText variant="small" color={color.textSecondary} numberOfLines={1}>
              {user.email}
            </AppText>
            <AppText variant="caption" color={color.textTertiary} numberOfLines={1}>
              {user.college || "Add your college to complete your profile"}
            </AppText>
          </View>
        </View>

        <View style={styles.stats}>
          <View style={styles.stat}>
            <AppText variant="h3">{user.savvy_points_balance.toLocaleString("en-IN")}</AppText>
            <AppText variant="caption" color={color.textTertiary}>
              Points
            </AppText>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <AppText variant="h3">{memberSince}</AppText>
            <AppText variant="caption" color={color.textTertiary}>
              Member since
            </AppText>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <AppText variant="h3" color={verified ? color.success : color.amber}>
              {verified ? "Active" : "Action"}
            </AppText>
            <AppText variant="caption" color={color.textTertiary}>
              Student ID
            </AppText>
          </View>
        </View>

        <Section title="Account">
          <SettingsRow
            icon="bookmark-outline"
            title="Saved offers"
            subtitle="Deals you bookmarked for later"
            onPress={() => router.push("/saved" as never)}
          />
          <SettingsRow
            icon="happy-outline"
            title="Choose your avatar"
            subtitle="Use the same Savvy character across app and website"
            onPress={() => router.push("/settings/avatar" as never)}
          />
          <SettingsRow
            icon="person-outline"
            title="Personal details"
            subtitle="Name, college, course and phone"
            onPress={() => router.push("/settings/profile-details" as never)}
          />
          <SettingsRow
            icon={verified ? "shield-checkmark-outline" : "shield-outline"}
            title={verified ? "Student verification" : "Complete verification"}
            subtitle={
              verified
                ? "Your verified membership is active"
                : "Unlock student-only offers and your digital pass"
            }
            onPress={() => router.push(verified ? "/(tabs)/card" : getVerificationHref(user))}
          />
          <SettingsRow
            icon="notifications-outline"
            title="Announcements"
            subtitle={
              unreadCount
                ? `${unreadCount} unread update${unreadCount === 1 ? "" : "s"}`
                : "Offers, rewards and account updates"
            }
            onPress={openCentre}
          />
        </Section>

        <Section title="Privacy & security">
          <SettingsRow
            icon="lock-closed-outline"
            title="App lock"
            subtitle={
              supported
                ? "Require Face ID or fingerprint when opening"
                : "Biometrics aren't available on this device"
            }
            trailing={
              <Switch
                value={enabled}
                onValueChange={onToggleLock}
                disabled={!supported || togglingLock}
                trackColor={{ true: color.primary, false: color.surfaceElevated }}
                thumbColor={color.textPrimary}
                accessibilityLabel="App lock"
              />
            }
          />
          <SettingsRow
            icon="phone-portrait-outline"
            title="Active sessions"
            subtitle="Review devices signed in to your account"
            onPress={() => router.push("/settings/sessions" as never)}
          />
          <SettingsRow
            icon="notifications-outline"
            title="Push notifications"
            subtitle="Control alerts from Savvy on this phone"
            onPress={() => router.push("/settings/notifications" as never)}
          />
        </Section>

        <Section title="Support & legal">
          <SettingsRow
            icon="help-circle-outline"
            title="Help & support"
            onPress={() => openWebPath("/support")}
          />
          <SettingsRow
            icon="document-text-outline"
            title="Terms of service"
            onPress={() => openWebPath("/terms")}
          />
          <SettingsRow
            icon="hand-left-outline"
            title="Privacy policy"
            onPress={() => openWebPath("/privacy")}
          />
        </Section>

        <Section title="Session">
          <SettingsRow
            icon="log-out-outline"
            title={signingOut ? "Signing out…" : "Sign out"}
            onPress={signingOut ? undefined : onLogout}
          />
          <SettingsRow
            icon="close-circle-outline"
            title="Sign out everywhere"
            subtitle="End every active mobile session"
            onPress={onLogoutAll}
          />
        </Section>

        <Pressable
          onPress={() => router.push("/settings/delete-account" as never)}
          accessibilityRole="button"
          accessibilityLabel="Delete account"
          style={({ pressed }) => [styles.deleteButton, pressed && styles.rowPressed]}
        >
          <AppText variant="small" color={color.destructive}>
            Delete account
          </AppText>
        </Pressable>
        <AppText variant="caption" color={color.textTertiary} style={styles.version}>
          Savvy Campus · Version {appVersion}
        </AppText>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, paddingBottom: space.xxl, gap: space.lg },
  identity: { flexDirection: "row", alignItems: "center", gap: space.md },
  identityCopy: { flex: 1, gap: 3 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: space.xs },
  name: { flexShrink: 1 },
  stats: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radius.lg,
    backgroundColor: color.surfaceMuted,
    paddingVertical: space.md,
  },
  stat: { flex: 1, alignItems: "center", gap: 2 },
  statDivider: { width: StyleSheet.hairlineWidth, height: 34, backgroundColor: color.border },
  section: { gap: space.sm },
  sectionLabel: { textTransform: "uppercase", letterSpacing: 1.3, paddingHorizontal: space.xs },
  sectionBody: { borderRadius: radius.lg, backgroundColor: color.surface, overflow: "hidden" },
  settingsRow: {
    minHeight: 66,
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.border,
  },
  rowPressed: { opacity: 0.62 },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: color.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  rowIconDestructive: { backgroundColor: "rgba(239,68,68,0.1)" },
  rowCopy: { flex: 1, gap: 2 },
  deleteButton: { minHeight: minTouchTarget, alignItems: "center", justifyContent: "center" },
  version: { textAlign: "center" },
});
