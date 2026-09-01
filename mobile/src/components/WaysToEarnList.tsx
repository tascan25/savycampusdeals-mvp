import { Ionicons } from "@expo/vector-icons";
import { FlatList, Pressable, StyleSheet, View } from "react-native";

import { AppText } from "@/design-system/components";
import { color, minTouchTarget, radius, space } from "@/design-system/tokens";
import type { WayToEarn } from "@/types/rewards";

const WAY_ICONS: Record<WayToEarn["type"], keyof typeof Ionicons.glyphMap> = {
  redeem: "location",
  verify: "checkmark-circle",
  refer: "person-add",
};

export function WaysToEarnList({
  ways,
  pendingReferrals,
  onNavigate,
  onCopyReferral,
}: {
  ways: WayToEarn[];
  pendingReferrals: number;
  onNavigate: (href: string) => void;
  onCopyReferral: (code: string) => void;
}) {
  return (
    <FlatList
      data={ways}
      keyExtractor={(item) => item.type}
      scrollEnabled={false}
      renderItem={({ item: way }) => (
        <Pressable
          onPress={() =>
            way.type === "refer" ? onCopyReferral(way.referral_code) : onNavigate(way.href)
          }
          accessibilityRole="button"
          style={({ pressed }) => [styles.row, pressed && styles.pressed]}
        >
          <View style={styles.icon}>
            <Ionicons name={WAY_ICONS[way.type]} size={18} color={color.primary} />
          </View>
          <View style={styles.info}>
            <View style={styles.titleRow}>
              <AppText variant="bodyMedium">{way.title}</AppText>
              {way.type !== "refer" && way.completed ? (
                <Ionicons name="checkmark-circle" size={14} color={color.success} />
              ) : null}
            </View>
            <AppText variant="caption" color={color.textSecondary}>
              {way.description}
            </AppText>
            {way.type === "refer" && pendingReferrals > 0 ? (
              <AppText variant="caption" color={color.amber} style={styles.pending}>
                {pendingReferrals} {pendingReferrals === 1 ? "reward" : "rewards"} pending
                verification
              </AppText>
            ) : null}
          </View>
          <View style={styles.pointsWrap}>
            <AppText variant="bodyMedium" color={color.amber}>
              +{way.points}
            </AppText>
            <AppText variant="caption" color={color.textTertiary}>
              points
            </AppText>
          </View>
        </Pressable>
      )}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
    />
  );
}

const styles = StyleSheet.create({
  separator: { height: space.sm },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    minHeight: minTouchTarget,
    padding: space.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.border,
    backgroundColor: color.surface,
  },
  pressed: { opacity: 0.85 },
  icon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: "rgba(79,70,229,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  info: { flex: 1, gap: 2 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  pending: { marginTop: 2 },
  pointsWrap: { alignItems: "flex-end" },
});
