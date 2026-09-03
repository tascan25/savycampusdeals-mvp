import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, View } from "react-native";

import { AppText } from "@/design-system/components";
import { color, radius, space } from "@/design-system/tokens";
import type { PartnerActivityItem } from "@/types/partner";

const statusColor = {
  active: color.amber,
  redeemed: color.success,
  expired: color.textTertiary,
} as const;

function eventTime(item: PartnerActivityItem): string {
  const value = item.redeemed_at || item.claimed_at;
  return value
    ? new Date(value).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })
    : "Time unavailable";
}

export function PartnerActivityRow({ item }: { item: PartnerActivityItem }) {
  return (
    <View style={styles.row}>
      <View style={[styles.icon, { backgroundColor: `${statusColor[item.status]}18` }]}>
        <Ionicons
          name={
            item.status === "redeemed" ? "checkmark" : item.status === "active" ? "time" : "close"
          }
          size={18}
          color={statusColor[item.status]}
        />
      </View>
      <View style={styles.copy}>
        <View style={styles.topLine}>
          <AppText variant="bodyMedium" numberOfLines={1} style={styles.name}>
            {item.student_name || "Savvy student"}
          </AppText>
          <AppText variant="caption" color={statusColor[item.status]} style={styles.status}>
            {item.status.toUpperCase()}
          </AppText>
        </View>
        <AppText variant="small" color={color.textSecondary} numberOfLines={1}>
          {item.offer_title} {item.discount ? `· ${item.discount}` : ""}
        </AppText>
        <View style={styles.meta}>
          <AppText variant="caption" color={color.textTertiary}>
            {item.student_number || item.code}
          </AppText>
          <AppText variant="caption" color={color.textTertiary}>
            {eventTime(item)}
          </AppText>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: space.md,
    padding: space.md,
    borderRadius: radius.lg,
    backgroundColor: color.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.border,
  },
  icon: { width: 38, height: 38, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  copy: { flex: 1, gap: 3 },
  topLine: { flexDirection: "row", alignItems: "center", gap: space.sm },
  name: { flex: 1 },
  status: { fontSize: 10, fontWeight: "800", letterSpacing: 0.7 },
  meta: { marginTop: 2, flexDirection: "row", justifyContent: "space-between", gap: space.sm },
});
