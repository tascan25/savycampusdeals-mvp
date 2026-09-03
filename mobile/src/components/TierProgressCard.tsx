import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { FlatList, StyleSheet, View } from "react-native";

import { AppText } from "@/design-system/components";
import { color, radius, space } from "@/design-system/tokens";
import type { CurrentSavvyTier, SavvyTier, SavvyTierKey } from "@/types/rewards";

const TIER_ICONS: Record<SavvyTierKey, keyof typeof Ionicons.glyphMap> = {
  campus_starter: "star",
  deal_hunter: "compass",
  savvy_insider: "diamond",
  campus_icon: "trophy",
};

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
  const journeyTitle = tier.next_tier
    ? `${tier.points_to_next.toLocaleString("en-IN")} points to ${tier.next_tier.name}`
    : "You've reached Campus Icon status";

  return (
    <LinearGradient
      colors={["#17102D", "#24104D", "#0D0C13"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.card}
    >
      <View style={styles.amberGlow} />
      <View style={styles.violetGlow} />

      <View style={styles.topRow}>
        <View style={styles.tierBadge}>
          <Ionicons name={TIER_ICONS[tier.key]} size={13} color="#FCD34D" />
          <AppText variant="caption" color="#FDE68A" style={styles.tierBadgeLabel}>
            {tier.name}
          </AppText>
        </View>
        <View style={styles.lifetimeBadge}>
          <Ionicons name="sparkles" size={12} color="#C4B5FD" />
          <AppText variant="caption" color="#C4B5FD">
            {lifetime.toLocaleString("en-IN")} lifetime
          </AppText>
        </View>
      </View>

      <AppText variant="caption" color="#A78BFA" style={styles.label}>
        YOUR BALANCE
      </AppText>
      <View style={styles.balanceRow}>
        <AppText style={styles.balance}>{balance.toLocaleString("en-IN")}</AppText>
        <AppText variant="small" color="rgba(255,255,255,0.68)" style={styles.pointsLabel}>
          Savvy Points
        </AppText>
      </View>
      <AppText variant="small" color="rgba(255,255,255,0.72)" style={styles.benefit}>
        {tier.benefit}
      </AppText>

      <View style={styles.journeyPanel}>
        <View style={styles.journeyHeader}>
          <View style={styles.journeyCopy}>
            <AppText variant="caption" color="rgba(255,255,255,0.52)" style={styles.label}>
              STATUS JOURNEY
            </AppText>
            <AppText variant="bodyMedium" style={styles.journeyTitle}>
              {journeyTitle}
            </AppText>
          </View>
          <LinearGradient colors={["#FDE68A", "#F59E0B"]} style={styles.trophyIcon}>
            <Ionicons name="trophy" size={18} color="#241300" />
          </LinearGradient>
        </View>

        <View
          style={styles.progressTrack}
          accessibilityRole="progressbar"
          accessibilityLabel="Progress to next Savvy tier"
          accessibilityValue={{ min: 0, max: 100, now: Math.round(tier.progress_percent) }}
        >
          <LinearGradient
            colors={["#7C3AED", "#D946EF", "#FCD34D"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.progressFill, { width: `${tier.progress_percent}%` }]}
          />
        </View>

        <FlatList
          data={tiers}
          keyExtractor={(item) => item.key}
          scrollEnabled={false}
          style={styles.tierList}
          ItemSeparatorComponent={() => <View style={styles.tierSeparator} />}
          renderItem={({ item }) => {
            const current = item.key === tier.key;
            const reached = lifetime >= item.minimum;
            return (
              <View style={[styles.tierStep, current && styles.tierStepCurrent]}>
                <View
                  style={[
                    styles.stageIcon,
                    reached && styles.stageIconReached,
                    current && styles.stageIconCurrent,
                  ]}
                >
                  <Ionicons
                    name={reached ? "checkmark" : TIER_ICONS[item.key]}
                    size={15}
                    color={reached ? "#160C2E" : "rgba(255,255,255,0.5)"}
                  />
                </View>
                <View style={styles.stageCopy}>
                  <AppText variant="small" style={styles.stageName}>
                    {item.name}
                  </AppText>
                  <AppText variant="caption" color="rgba(255,255,255,0.46)">
                    {item.minimum.toLocaleString("en-IN")}+ lifetime points
                  </AppText>
                </View>
                <View
                  style={[
                    styles.stageStatus,
                    reached && styles.stageStatusReached,
                    current && styles.stageStatusCurrent,
                  ]}
                >
                  <AppText
                    variant="caption"
                    color={current ? "#FDE68A" : reached ? "#C4B5FD" : color.textTertiary}
                    style={styles.stageStatusLabel}
                  >
                    {current ? "Current" : reached ? "Reached" : "Locked"}
                  </AppText>
                </View>
              </View>
            );
          }}
        />
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(167,139,250,0.3)",
    padding: space.lg,
    overflow: "hidden",
  },
  amberGlow: {
    position: "absolute",
    width: 190,
    height: 190,
    borderRadius: 95,
    top: -125,
    right: -60,
    backgroundColor: "rgba(245,158,11,0.16)",
  },
  violetGlow: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 90,
    bottom: -110,
    left: -95,
    backgroundColor: "rgba(124,58,237,0.16)",
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: space.sm,
    marginBottom: space.xl,
  },
  tierBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(253,230,138,0.25)",
    backgroundColor: "rgba(245,158,11,0.12)",
  },
  tierBadgeLabel: { textTransform: "uppercase", fontWeight: "800", letterSpacing: 0.5 },
  lifetimeBadge: { flexDirection: "row", alignItems: "center", gap: 5 },
  label: { letterSpacing: 1.2, fontWeight: "700" },
  balanceRow: { flexDirection: "row", alignItems: "flex-end", gap: space.sm, marginTop: 2 },
  balance: {
    color: "#FFFFFF",
    fontSize: 50,
    lineHeight: 56,
    fontWeight: "900",
    letterSpacing: -2,
  },
  pointsLabel: { paddingBottom: 8 },
  benefit: { marginTop: space.sm, lineHeight: 20 },
  journeyPanel: {
    marginTop: space.xl,
    padding: 20,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: "rgba(0,0,0,0.22)",
  },
  journeyHeader: { flexDirection: "row", alignItems: "center", gap: space.md },
  journeyCopy: { flex: 1, gap: 4 },
  journeyTitle: { fontWeight: "700" },
  trophyIcon: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  progressTrack: {
    height: 9,
    borderRadius: radius.pill,
    backgroundColor: "rgba(255,255,255,0.1)",
    marginTop: space.xl,
    overflow: "hidden",
  },
  progressFill: { height: "100%", borderRadius: radius.pill },
  tierList: { marginTop: space.lg },
  tierSeparator: { height: 10 },
  tierStep: {
    minHeight: 70,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.06)",
    backgroundColor: "rgba(255,255,255,0.035)",
  },
  tierStepCurrent: {
    borderColor: "rgba(196,181,253,0.36)",
    backgroundColor: "rgba(124,58,237,0.15)",
  },
  stageIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.07)",
  },
  stageIconReached: { backgroundColor: "#A78BFA" },
  stageIconCurrent: { backgroundColor: "#FDE68A" },
  stageCopy: { flex: 1, gap: 3 },
  stageName: { fontWeight: "700" },
  stageStatus: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.09)",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  stageStatusReached: {
    borderColor: "rgba(167,139,250,0.25)",
    backgroundColor: "rgba(124,58,237,0.1)",
  },
  stageStatusCurrent: {
    borderColor: "rgba(253,230,138,0.28)",
    backgroundColor: "rgba(245,158,11,0.1)",
  },
  stageStatusLabel: { fontSize: 10, fontWeight: "800" },
});
