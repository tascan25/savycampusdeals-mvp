import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import { FlatList, Image, StyleSheet, View } from "react-native";

import { AppText, Chip } from "@/design-system/components";
import { color, radius, space } from "@/design-system/tokens";
import type { LevelReward, SavvyTier } from "@/types/rewards";

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
      <AppText variant="h3">Reward collection</AppText>
      <FlatList
        horizontal
        data={rewardTiers}
        keyExtractor={(item) => item.key}
        showsHorizontalScrollIndicator={false}
        style={styles.chipRow}
        renderItem={({ item: tier }) => (
          <View key={tier.key} style={styles.chipGap}>
            <Chip
              label={tier.name}
              active={selectedKey === tier.key}
              onPress={() => setSelectedKey(tier.key)}
            />
          </View>
        )}
      />

      <View style={styles.spotlight}>
        <View style={styles.spotlightHeader}>
          <AppText variant="bodyMedium">{selectedTier.name}</AppText>
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
        <AppText variant="small" color={color.textSecondary} style={styles.rewardText}>
          {selectedTier.reward}
        </AppText>

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
  container: { gap: space.sm },
  chipRow: { flexGrow: 0 },
  chipGap: { marginRight: space.sm },
  spotlight: {
    marginTop: space.xs,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.border,
    backgroundColor: color.surface,
    padding: space.md,
    gap: space.sm,
  },
  spotlightHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
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
  rewardText: { lineHeight: 20 },
  progressWrap: { gap: space.xs },
  progressHeader: { flexDirection: "row", justifyContent: "space-between" },
  progressTrack: {
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: color.border,
    overflow: "hidden",
  },
  progressFill: { height: "100%", borderRadius: radius.pill, backgroundColor: color.primary },
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
