import * as Clipboard from "expo-clipboard";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { apiGetSavvyPointsOverview } from "@/api/rewards";
import { queryKeys } from "@/api/queryKeys";
import { AppText } from "@/design-system/components";
import { color, radius, space } from "@/design-system/tokens";
import { LevelRewardsSection } from "@/components/LevelRewardsSection";
import { PointsActivityList } from "@/components/PointsActivityList";
import { TierProgressCard } from "@/components/TierProgressCard";
import { WaysToEarnList } from "@/components/WaysToEarnList";

function mapWebHref(href: string): { pathname: string; params?: object } {
  if (href.startsWith("/verify")) return { pathname: "/verify" };
  if (href.startsWith("/outlets")) {
    return { pathname: "/(tabs)/explore", params: { tab: "outlets" } };
  }
  return { pathname: "/(tabs)/explore", params: { tab: "deals" } };
}

export function RewardsPanel() {
  const router = useRouter();
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const overviewQuery = useQuery({
    queryKey: queryKeys.rewards.overview(),
    queryFn: () => apiGetSavvyPointsOverview(),
  });

  const onCopyReferral = async (code: string) => {
    await Clipboard.setStringAsync(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const onNavigate = (href: string) => {
    const route = mapWebHref(href);
    router.push(route as never);
  };

  if (overviewQuery.isLoading || !overviewQuery.data) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={color.primary} />
      </View>
    );
  }

  const overview = overviewQuery.data;

  return (
    <FlatList
      data={[]}
      renderItem={() => null}
      contentContainerStyle={styles.content}
      ListHeaderComponent={
        <>
          <View style={styles.intro}>
            <View>
              <AppText variant="caption" color="#A78BFA" style={styles.eyebrow}>
                YOUR CAMPUS REWARDS
              </AppText>
              <AppText variant="h1">Make every deal count.</AppText>
            </View>
            <View style={styles.introIcon}>
              <Ionicons name="sparkles" size={20} color="#C4B5FD" />
            </View>
          </View>
          <TierProgressCard
            balance={overview.balance}
            lifetime={overview.lifetime}
            tier={overview.tier}
            tiers={overview.tiers}
          />

          {copiedCode ? (
            <View style={styles.copiedBanner}>
              <AppText variant="small" color={color.success}>
                Referral code copied — send it to your crew!
              </AppText>
            </View>
          ) : null}

          <LevelRewardsSection
            tiers={overview.tiers}
            levelRewards={overview.level_rewards}
            lifetime={overview.lifetime}
          />

          <View style={styles.section}>
            <View style={styles.sectionHeading}>
              <View>
                <AppText variant="h3">Ways to earn</AppText>
                <AppText variant="caption" color={color.textTertiary}>
                  Small actions, more campus perks.
                </AppText>
              </View>
              <Ionicons name="flash-outline" size={20} color={color.amber} />
            </View>
            <WaysToEarnList
              ways={overview.ways_to_earn}
              pendingReferrals={overview.pending_referrals}
              onNavigate={onNavigate}
              onCopyReferral={onCopyReferral}
            />
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeading}>
              <View>
                <AppText variant="h3">Points activity</AppText>
                <AppText variant="caption" color={color.textTertiary}>
                  Your latest rewards, all in one place.
                </AppText>
              </View>
              <Ionicons name="time-outline" size={20} color="#A78BFA" />
            </View>
            <PointsActivityList activity={overview.activity} />
          </View>
        </>
      }
    />
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { padding: space.lg, gap: space.xl, paddingBottom: space.xxl },
  intro: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  eyebrow: { letterSpacing: 1.4, marginBottom: 3 },
  introIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(124,58,237,0.18)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(167,139,250,0.28)",
  },
  copiedBanner: {
    marginTop: -space.md,
    alignItems: "center",
  },
  section: {
    gap: space.md,
    padding: space.md,
    borderRadius: radius.lg,
    backgroundColor: color.surfaceMuted,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.border,
  },
  sectionHeading: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
});
