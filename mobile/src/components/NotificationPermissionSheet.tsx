import { Ionicons } from "@expo/vector-icons";
import { Image, Modal, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppText, Button } from "@/design-system/components";
import { color, radius, space } from "@/design-system/tokens";
import { useAuth } from "@/providers/AuthProvider";

export function NotificationPermissionSheet({
  visible,
  requiresSettings,
  working,
  onAllow,
  onDismiss,
}: {
  visible: boolean;
  requiresSettings: boolean;
  working: boolean;
  onAllow: () => void;
  onDismiss: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const isPartner = user?.role === "outlet_partner";
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss}>
      <View style={styles.backdrop}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onDismiss}
          accessibilityLabel="Dismiss notification permission message"
        />
        <View
          style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, space.md) + space.sm }]}
        >
          <View style={styles.handle} />
          <View style={styles.brandRow}>
            <View style={styles.logoWrap}>
              <Image
                source={require("../../assets/notification-icon-savvy.png")}
                style={styles.logo}
                resizeMode="contain"
              />
            </View>
            <View style={styles.bell}>
              <Ionicons name="notifications" size={21} color="#C7D2FE" />
            </View>
          </View>
          <View style={styles.copy}>
            <AppText variant="h2">
              {isPartner ? "Keep your outlet in sync." : "Never miss a deal you claimed."}
            </AppText>
            <AppText variant="body" color={color.textSecondary}>
              {isPartner
                ? "Allow Savvy to send partner announcements and important account updates."
                : "Allow Savvy to remind you before coupons, rewards and student verification expire."}{" "}
              You can change this anytime in system settings.
            </AppText>
          </View>
          <View style={styles.actions}>
            <Button
              label={requiresSettings ? "Open notification settings" : "Allow notifications"}
              onPress={onAllow}
              loading={working}
            />
            <Button label="Not now" variant="secondary" onPress={onDismiss} disabled={working} />
          </View>
          <AppText variant="caption" color={color.textTertiary} style={styles.note}>
            We never put coupon codes, verification documents or sensitive account details in
            notifications.
          </AppText>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.68)",
  },
  sheet: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderCurve: "continuous",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.borderStrong,
    backgroundColor: color.surfaceElevated,
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    gap: space.lg,
  },
  handle: {
    width: 42,
    height: 5,
    alignSelf: "center",
    borderRadius: radius.pill,
    backgroundColor: color.borderStrong,
  },
  brandRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  logoWrap: {
    width: 58,
    height: 58,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: color.primary,
  },
  logo: { width: 43, height: 43 },
  bell: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: color.primarySoft,
  },
  copy: { gap: space.sm },
  actions: { gap: space.sm },
  note: { textAlign: "center", paddingHorizontal: space.md },
});
