import { Ionicons } from "@expo/vector-icons";
import { FlatList, StyleSheet, View } from "react-native";

import { AppText } from "@/design-system/components";
import { color, radius, space } from "@/design-system/tokens";
import type { PointsActivityItem } from "@/types/rewards";

const EVENT_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  redemption: "pricetag",
  referral: "person-add",
  verification: "checkmark-circle",
  welcome: "sparkles",
  legacy_balance: "sparkles",
  bonus: "gift",
};

function formatDate(value: string | null): string {
  if (!value) return "Just now";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export function PointsActivityList({ activity }: { activity: PointsActivityItem[] }) {
  if (activity.length === 0) {
    return (
      <View style={styles.empty}>
        <Ionicons name="gift-outline" size={22} color={color.textTertiary} />
        <AppText variant="small" color={color.textSecondary} style={styles.emptyTitle}>
          Your first win is waiting
        </AppText>
        <AppText variant="caption" color={color.textTertiary}>
          Use a partner deal to start your activity feed.
        </AppText>
      </View>
    );
  }

  return (
    <FlatList
      data={activity}
      keyExtractor={(item) => item.id}
      scrollEnabled={false}
      renderItem={({ item }) => (
        <View style={styles.row}>
          <View style={styles.icon}>
            <Ionicons
              name={EVENT_ICONS[item.event_type] ?? "sparkles"}
              size={16}
              color={color.primary}
            />
          </View>
          <View style={styles.info}>
            <AppText variant="small" numberOfLines={1}>
              {item.title}
            </AppText>
            <AppText variant="caption" color={color.textTertiary} numberOfLines={1}>
              {item.description || formatDate(item.created_at)}
            </AppText>
          </View>
          <View style={styles.amountWrap}>
            <AppText variant="small" color={color.success}>
              +{item.amount}
            </AppText>
            <AppText variant="caption" color={color.textTertiary}>
              {formatDate(item.created_at)}
            </AppText>
          </View>
        </View>
      )}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
    />
  );
}

const styles = StyleSheet.create({
  separator: { height: space.xs },
  row: { flexDirection: "row", alignItems: "center", gap: space.sm, paddingVertical: space.xs },
  icon: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    backgroundColor: "rgba(79,70,229,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  info: { flex: 1, gap: 2 },
  amountWrap: { alignItems: "flex-end" },
  empty: {
    alignItems: "center",
    gap: space.xs,
    paddingVertical: space.xl,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderStyle: "dashed",
    borderColor: color.border,
  },
  emptyTitle: { marginTop: space.xs },
});
