import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, View } from "react-native";

import { AppText } from "@/design-system/components";
import { radius, space } from "@/design-system/tokens";
import type { CurrentSavvyTier, SavvyTier } from "@/types/rewards";

export function TierProgressCard({
  balance,
  lifetime,
  tier,
  tiers,
}: {
  balance: number;
  lifetime: number;
  tier: CurrentSavvyTier;
  tiers: SavvyTier[];
}) {
  return (
    <LinearGradient colors={["#201052", "#35137A", "#111119"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
      <View style={styles.glow} />
      <View style={styles.topRow}>
        <View style={styles.tierBadge}>
          <Ionicons name="star" size={12} color="#FCD34D" />
          <AppText variant="caption" color="#FCD34D" style={styles.tierBadgeLabel}>{tier.name}</AppText>
        </View>
        <Ionicons name="sparkles" size={22} color="rgba(255,255,255,0.55)" />
      </View>

      <AppText variant="caption" color="rgba(255,255,255,0.65)" style={styles.label}>AVAILABLE BALANCE</AppText>
      <View style={styles.balanceRow}>
        <AppText style={styles.balance}>{balance.toLocaleString("en-IN")}</AppText>
        <AppText variant="small" color="rgba(255,255,255,0.68)" style={styles.pointsLabel}>Savvy Points</AppText>
      </View>
      <AppText variant="small" color="rgba(255,255,255,0.76)" style={styles.benefit}>{tier.benefit}</AppText>

      <View style={styles.progressHeader}>
        <AppText variant="small" color="rgba(255,255,255,0.8)">
          {tier.next_tier
            ? `${tier.points_to_next.toLocaleString("en-IN")} points to ${tier.next_tier.name}`
            : "You've reached the top tier"}
        </AppText>
        <AppText variant="caption" color="rgba(255,255,255,0.52)">
          {lifetime.toLocaleString("en-IN")} lifetime
        </AppText>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${tier.progress_percent}%` }]} />
      </View>
      <View style={styles.tierJourney}>
        {tiers.map((item, index) => {
          const reached = lifetime >= item.minimum;
          return (
            <View key={item.key} style={styles.tierStep}>
              <View style={[styles.tierDot, reached && styles.tierDotReached]}>{reached ? <Ionicons name="checkmark" size={10} color="#1A1038" /> : null}</View>
              <AppText variant="caption" color={reached ? "#FFFFFF" : "rgba(255,255,255,0.42)"} numberOfLines={1}>{index === 0 ? "Starter" : item.name.replace("Savvy ", "")}</AppText>
            </View>
          );
        })}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(167,139,250,0.34)",
    padding: space.lg,
    gap: 2,
    overflow: "hidden",
  },
  glow: { position: "absolute", width: 180, height: 180, borderRadius: 90, top: -100, right: -50, backgroundColor: "rgba(245,158,11,0.15)" },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: space.lg },
  tierBadge: {
    flexDirection: "row",
    alignSelf: "flex-start",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: space.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(245,158,11,0.3)",
    backgroundColor: "rgba(245,158,11,0.14)",
  },
  tierBadgeLabel: { textTransform: "uppercase", fontWeight: "700", letterSpacing: 0.4 },
  label: { textTransform: "uppercase", letterSpacing: 0.5 },
  balanceRow: { flexDirection: "row", alignItems: "flex-end", gap: space.sm, marginTop: 2 },
  balance: { fontSize: 48, lineHeight: 54, fontWeight: "900", letterSpacing: -1.8 },
  pointsLabel: { paddingBottom: 7 },
  benefit: { marginTop: space.sm },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: space.lg,
  },
  progressTrack: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: "rgba(255,255,255,0.13)",
    marginTop: space.sm,
    overflow: "hidden",
  },
  progressFill: { height: "100%", borderRadius: radius.pill, backgroundColor: "#FBBF24" },
  tierJourney: { marginTop: space.md, flexDirection: "row", justifyContent: "space-between" },
  tierStep: { width: "24%", gap: 5, alignItems: "center" },
  tierDot: { width: 18, height: 18, borderRadius: 9, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.24)", backgroundColor: "rgba(255,255,255,0.08)" },
  tierDotReached: { borderColor: "#FCD34D", backgroundColor: "#FCD34D" },
});
