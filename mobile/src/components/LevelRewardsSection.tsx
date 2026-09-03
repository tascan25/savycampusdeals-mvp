import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import { FlatList, Image, Pressable, StyleSheet, View } from "react-native";

import { AppText } from "@/design-system/components";
import { color, radius, space } from "@/design-system/tokens";
import type { LevelReward, SavvyTier, SavvyTierKey } from "@/types/rewards";

const REWARD_ICONS: Record<SavvyTierKey, keyof typeof Ionicons.glyphMap> = {
  campus_starter: "star",
  deal_hunter: "cafe",
  savvy_insider: "pizza",
  campus_icon: "school",
};

function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

/**
 * Which tier to spotlight by default: the most-advanced tier with an
 * unclaimed active reward if one exists (surface it before it expires
 * unnoticed), else the next tier still locked, else the last tier (the
 * member has reached the top).
 */
export function pickDefaultRewardTier(
  rewardTiers: SavvyTier[],
  rewardsByKey: Record<string, LevelReward | undefined>,
  lifetime: number,
): string | undefined {
  const activeReward = [...rewardTiers]
    .reverse()
    .find((tier) => rewardsByKey[tier.key]?.status === "active");
  if (activeReward) return activeReward.key;
  const nextLocked = rewardTiers.find((tier) => lifetime < tier.minimum);
  return (nextLocked ?? rewardTiers[rewardTiers.length - 1])?.key;
}

export function LevelRewardsSection({
  tiers,
  levelRewards,
  lifetime,
}: {
  tiers: SavvyTier[];
  levelRewards: LevelReward[];
  lifetime: number;
}) {
  const rewardTiers = useMemo(() => tiers.filter((tier) => tier.key !== "campus_starter"), [tiers]);
  const rewardsByKey = useMemo(
    () => Object.fromEntries(levelRewards.map((reward) => [reward.tier_key, reward])),
    [levelRewards],
  );

  const defaultTierKey = useMemo(
    () => pickDefaultRewardTier(rewardTiers, rewardsByKey, lifetime),
    [rewardTiers, rewardsByKey, lifetime],
  );

  const [selectedKey, setSelectedKey] = useState<string | undefined>(defaultTierKey);
  const selectedTier = rewardTiers.find((tier) => tier.key === selectedKey) ?? rewardTiers[0];
  const reward = selectedTier ? rewardsByKey[selectedTier.key] : undefined;
  const reached = selectedTier ? lifetime >= selectedTier.minimum : false;

  if (!selectedTier) return null;

  return (
    <View style={styles.container}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleWrap}>
          <View style={styles.eyebrowRow}>
            <Ionicons name="sparkles" size={12} color="#FCD34D" />
            <AppText variant="caption" color="#FCD34D" style={styles.eyebrow}>
              REWARD COLLECTION
            </AppText>
          </View>
          <AppText variant="h3">Your next flex is waiting</AppText>
          <AppText variant="caption" color={color.textTertiary}>
            Tap a level to see what you&apos;ll unlock.
          </AppText>
        </View>
        <View style={styles.headerIcon}>
          <Ionicons name="gift" size={19} color="#C4B5FD" />
        </View>
      </View>

      <FlatList
        horizontal
        data={rewardTiers}
        keyExtractor={(item) => item.key}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.rewardTabs}
        renderItem={({ item: itemTier }) => {
          const selected = selectedKey === itemTier.key;
          const itemReward = rewardsByKey[itemTier.key];
          const itemReached = lifetime >= itemTier.minimum;
          return (
            <Pressable
              onPress={() => setSelectedKey(itemTier.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              style={({ pressed }) => [
                styles.rewardTab,
                selected && styles.rewardTabSelected,
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.rewardTabTop}>
                <View style={[styles.rewardIcon, selected && styles.rewardIconSelected]}>
                  <Ionicons
                    name={REWARD_ICONS[itemTier.key]}
                    size={17}
                    color={selected ? "#211202" : itemReached ? "#C4B5FD" : color.textTertiary}
                  />
                </View>
                <Ionicons
                  name={
                    itemReward?.status === "active" || itemReached
                      ? "checkmark-circle"
                      : "lock-closed"
                  }
                  size={14}
                  color={
                    itemReward?.status === "active"
                      ? color.success
                      : itemReached
                        ? "#A78BFA"
                        : color.textTertiary
                  }
                />
              </View>
              <AppText variant="small" numberOfLines={2} style={styles.rewardTabName}>
                {itemTier.name}
              </AppText>
              <AppText variant="caption" color={selected ? "#FDE68A" : color.textTertiary}>
                {itemTier.minimum.toLocaleString("en-IN")} PTS
              </AppText>
            </Pressable>
          );
        }}
      />

      <View style={styles.spotlight}>
        <View style={styles.spotlightHeader}>
          <View style={styles.spotlightIcon}>
            <Ionicons name={REWARD_ICONS[selectedTier.key]} size={22} color="#FDE68A" />
          </View>
          <View style={styles.spotlightTitleWrap}>
            <View style={styles.titleBadgeRow}>
              <AppText variant="h3" style={styles.spotlightTitle}>
                {selectedTier.name}
              </AppText>
              <View
                style={[
                  styles.statusBadge,
                  reward?.status === "active" && styles.statusActive,
                  reward?.status === "expired" && styles.statusExpired,
                ]}
              >
                <AppText variant="caption" style={styles.statusLabel}>
                  {reward
                    ? reward.status === "active"
                      ? "Unlocked"
                      : reward.status
                    : reached
                      ? "Unlocked"
                      : "Locked"}
                </AppText>
              </View>
            </View>
            <AppText variant="small" color="#FEF3C7" style={styles.rewardText}>
              {selectedTier.reward}
            </AppText>
          </View>
        </View>

        {!reached ? (
          <View style={styles.progressWrap}>
            <View style={styles.progressHeader}>
              <AppText variant="caption" color={color.textSecondary}>
                Your progress
              </AppText>
              <AppText variant="caption" color={color.amber}>
                {(selectedTier.minimum - lifetime).toLocaleString("en-IN")} points to go
              </AppText>
            </View>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${Math.min(100, (lifetime / selectedTier.minimum) * 100)}%` },
                ]}
              />
            </View>
            <AppText variant="caption" color={color.textTertiary}>
              Every partner deal gets you closer.
            </AppText>
          </View>
        ) : null}

        {reward?.status === "active" ? (
          <View style={styles.rewardActive}>
            <View style={styles.qrWrap}>
              <Image source={{ uri: reward.qr_data_uri }} style={styles.qr} resizeMode="contain" />
            </View>
            <View style={styles.rewardActiveInfo}>
              <View style={styles.readyBadge}>
                <Ionicons name="qr-code" size={12} color={color.success} />
                <AppText variant="caption" color={color.success}>
                  Ready to claim
                </AppText>
              </View>
              <AppText variant="bodyMedium" style={styles.code}>
                {reward.code}
              </AppText>
              <AppText variant="caption" color={color.textSecondary}>
                Use before {formatDate(reward.expires_at)}
              </AppText>
            </View>
          </View>
        ) : null}

        {reward && reward.status !== "active" ? (
          <View style={styles.rewardResolved}>
            <Ionicons
              name={reward.status === "redeemed" ? "checkmark-circle" : "time"}
              size={16}
              color={reward.status === "redeemed" ? color.success : color.destructive}
            />
            <AppText variant="small" color={color.textSecondary} style={styles.resolvedText}>
              {reward.status === "redeemed"
                ? `Claimed on ${formatDate(reward.redeemed_at)} — nice one!`
                : `This reward expired on ${formatDate(reward.expires_at)}`}
            </AppText>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: space.md,
    padding: space.md,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.border,
    backgroundColor: color.surfaceMuted,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.md,
  },
  sectionTitleWrap: { flex: 1, gap: 3 },
  eyebrowRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  eyebrow: { letterSpacing: 1.2, fontWeight: "800" },
  headerIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(124,58,237,0.16)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(167,139,250,0.24)",
  },
  rewardTabs: { gap: space.sm },
  rewardTab: {
    width: 116,
    minHeight: 112,
    padding: space.sm,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.border,
    backgroundColor: "rgba(255,255,255,0.025)",
  },
  rewardTabSelected: {
    borderColor: "rgba(253,230,138,0.42)",
    backgroundColor: "rgba(124,58,237,0.16)",
  },
  pressed: { opacity: 0.76 },
  rewardTabTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rewardIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(124,58,237,0.13)",
  },
  rewardIconSelected: { backgroundColor: "#FDE68A" },
  rewardTabName: { marginTop: space.sm, minHeight: 36, fontWeight: "700" },
  spotlight: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(167,139,250,0.18)",
    backgroundColor: "rgba(124,58,237,0.07)",
    padding: space.md,
    gap: space.md,
  },
  spotlightHeader: { flexDirection: "row", alignItems: "flex-start", gap: space.md },
  spotlightIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.25)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.border,
  },
  spotlightTitleWrap: { flex: 1, gap: 5 },
  titleBadgeRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: space.sm },
  spotlightTitle: { flexShrink: 1 },
  statusBadge: {
    paddingHorizontal: space.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: color.surfaceElevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.border,
  },
  statusActive: { backgroundColor: "rgba(34,197,94,0.12)", borderColor: "rgba(34,197,94,0.3)" },
  statusExpired: { backgroundColor: "rgba(239,68,68,0.12)", borderColor: "rgba(239,68,68,0.3)" },
  statusLabel: { textTransform: "capitalize", fontWeight: "700" },
  rewardText: { lineHeight: 20, fontWeight: "600" },
  progressWrap: {
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: "rgba(0,0,0,0.2)",
  },
  progressHeader: { flexDirection: "row", justifyContent: "space-between" },
  progressTrack: {
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: color.border,
    overflow: "hidden",
  },
  progressFill: { height: "100%", borderRadius: radius.pill, backgroundColor: "#8B5CF6" },
  rewardActive: { flexDirection: "row", gap: space.md, alignItems: "center" },
  qrWrap: {
    width: 80,
    height: 80,
    borderRadius: radius.sm,
    backgroundColor: color.textPrimary,
    padding: 6,
  },
  qr: { width: "100%", height: "100%" },
  rewardActiveInfo: { flex: 1, gap: 2 },
  readyBadge: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 2 },
  code: { letterSpacing: 0.5 },
  rewardResolved: { flexDirection: "row", alignItems: "center", gap: space.sm },
  resolvedText: { flex: 1 },
});
