import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";

import { apiGetPartnerDashboard } from "@/api/partner";
import { queryKeys } from "@/api/queryKeys";
import { LoadingShimmer } from "@/components/LoadingShimmer";
import { PartnerActivityRow } from "@/components/PartnerActivityRow";
import { AppText, Chip, Screen } from "@/design-system/components";
import { color, radius, space } from "@/design-system/tokens";
import { useAuth } from "@/providers/AuthProvider";
import type { PartnerPeriod } from "@/types/partner";
import { useState } from "react";

const periods: { value: PartnerPeriod; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
];

function DashboardSkeleton() {
  return (
    <View style={styles.skeleton}>
      <LoadingShimmer style={styles.heroSkeleton} />
      <View style={styles.metricGrid}>
        {[0, 1, 2, 3].map((item) => (
          <LoadingShimmer key={item} style={styles.metricSkeleton} />
        ))}
      </View>
      <LoadingShimmer style={styles.chartSkeleton} />
      <LoadingShimmer style={styles.rowSkeleton} />
      <LoadingShimmer style={styles.rowSkeleton} />
    </View>
  );
}

export default function PartnerDashboardScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [period, setPeriod] = useState<PartnerPeriod>("today");
  const dashboard = useQuery({
    queryKey: queryKeys.partner.dashboard(period),
    queryFn: () => apiGetPartnerDashboard(period),
  });
  const data = dashboard.data;
  const maxTrend = Math.max(1, ...(data?.trend.map((item) => item.claimed) ?? [1]));

  return (
    <Screen edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={dashboard.isRefetching}
            onRefresh={() => void dashboard.refetch()}
            tintColor={color.success}
          />
        }
      >
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <AppText variant="caption" color={color.success} style={styles.eyebrow}>
              PARTNER DASHBOARD
            </AppText>
            <AppText variant="h1" numberOfLines={1}>
              Hello, {user?.name?.split(" ")[0] || "Partner"}
            </AppText>
            <AppText variant="small" color={color.textSecondary} numberOfLines={1}>
              {data?.outlet.name || "Your outlet performance"}
            </AppText>
          </View>
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <AppText variant="caption" color={color.success}>
              LIVE
            </AppText>
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.periods}
        >
          {periods.map((item) => (
            <Chip
              key={item.value}
              label={item.label}
              active={period === item.value}
              onPress={() => setPeriod(item.value)}
            />
          ))}
        </ScrollView>

        {dashboard.isLoading ? (
          <DashboardSkeleton />
        ) : dashboard.isError || !data ? (
          <View style={styles.errorCard}>
            <Ionicons name="cloud-offline-outline" size={28} color={color.amber} />
            <AppText variant="bodyMedium">Couldn&apos;t load outlet data</AppText>
            <AppText variant="small" color={color.textSecondary}>
              Pull down or reopen this tab to try again.
            </AppText>
          </View>
        ) : (
          <>
            <View style={styles.metricGrid}>
              {[
                ["Claims", data.summary.claimed, "ticket-outline", color.primary],
                ["Active", data.summary.active, "time-outline", color.amber],
                ["Redeemed", data.summary.redeemed, "checkmark-circle-outline", color.success],
                ["Expired", data.summary.expired, "close-circle-outline", color.textTertiary],
              ].map(([label, value, icon, tint]) => (
                <View key={String(label)} style={styles.metricCard}>
                  <Ionicons
                    name={icon as keyof typeof Ionicons.glyphMap}
                    size={20}
                    color={String(tint)}
                  />
                  <AppText variant="h2">{Number(value).toLocaleString("en-IN")}</AppText>
                  <AppText variant="caption" color={color.textTertiary}>
                    {String(label)}
                  </AppText>
                </View>
              ))}
            </View>

            <View style={styles.insightRow}>
              <View>
                <AppText variant="h2">{data.summary.unique_students}</AppText>
                <AppText variant="caption" color={color.textTertiary}>
                  Unique students
                </AppText>
              </View>
              <View style={styles.insightDivider} />
              <View>
                <AppText variant="h2">{data.summary.redemption_rate}%</AppText>
                <AppText variant="caption" color={color.textTertiary}>
                  Redemption rate
                </AppText>
              </View>
            </View>

            {data.trend.length > 1 ? (
              <View style={styles.sectionCard}>
                <AppText variant="h3">Claims trend</AppText>
                <View style={styles.chart}>
                  {data.trend.map((item) => (
                    <View key={item.date} style={styles.barSlot}>
                      <View
                        style={[
                          styles.bar,
                          { height: Math.max(4, (item.claimed / maxTrend) * 82) },
                        ]}
                      />
                    </View>
                  ))}
                </View>
                <View style={styles.chartLegend}>
                  <AppText variant="caption" color={color.textTertiary}>
                    {data.trend[0]?.date.slice(5)}
                  </AppText>
                  <AppText variant="caption" color={color.textTertiary}>
                    {data.trend.at(-1)?.date.slice(5)}
                  </AppText>
                </View>
              </View>
            ) : null}

            <View style={styles.sectionHeading}>
              <AppText variant="h3">Your offers</AppText>
              <AppText variant="caption" color={color.textTertiary}>
                Admin managed
              </AppText>
            </View>
            {data.offers.length ? (
              data.offers.map((item) => (
                <View key={item.offer.id} style={styles.offerRow}>
                  <View style={styles.offerCopy}>
                    <AppText variant="bodyMedium" numberOfLines={1}>
                      {item.offer.title}
                    </AppText>
                    <AppText variant="caption" color={color.textSecondary}>
                      {item.offer.discount}
                    </AppText>
                  </View>
                  <View style={styles.offerStat}>
                    <AppText variant="bodyMedium">
                      {item.redeemed}/{item.claimed}
                    </AppText>
                    <AppText variant="caption" color={color.textTertiary}>
                      redeemed
                    </AppText>
                  </View>
                </View>
              ))
            ) : (
              <AppText variant="small" color={color.textTertiary}>
                No offers are currently assigned to this outlet.
              </AppText>
            )}

            <View style={styles.sectionHeading}>
              <AppText variant="h3">Recent activity</AppText>
              <AppText
                variant="caption"
                color={color.primary}
                onPress={() => router.push("/(partner)/activity" as never)}
              >
                View all
              </AppText>
            </View>
            {data.recent.length ? (
              data.recent.map((item) => <PartnerActivityRow key={item.id} item={item} />)
            ) : (
              <View style={styles.empty}>
                <Ionicons name="receipt-outline" size={24} color={color.textTertiary} />
                <AppText variant="small" color={color.textTertiary}>
                  Claims will appear here as students use your offers.
                </AppText>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, paddingBottom: 120, gap: space.md },
  header: { flexDirection: "row", alignItems: "center", gap: space.md },
  headerCopy: { flex: 1, gap: 2 },
  eyebrow: { letterSpacing: 1.8, fontWeight: "800" },
  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: radius.pill,
    backgroundColor: "rgba(34,197,94,0.1)",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: color.success },
  periods: { gap: space.sm },
  skeleton: { gap: space.md },
  heroSkeleton: { height: 28, width: "58%" },
  metricGrid: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  metricCard: {
    width: "48.5%",
    minHeight: 116,
    borderRadius: radius.lg,
    padding: space.md,
    gap: 5,
    backgroundColor: color.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.border,
  },
  metricSkeleton: { width: "48.5%", height: 116, borderRadius: radius.lg },
  chartSkeleton: { height: 150, borderRadius: radius.lg },
  rowSkeleton: { height: 82, borderRadius: radius.lg },
  insightRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    padding: space.lg,
    borderRadius: radius.lg,
    backgroundColor: color.primarySoft,
  },
  insightDivider: {
    width: StyleSheet.hairlineWidth,
    height: 40,
    backgroundColor: color.borderStrong,
  },
  sectionCard: {
    padding: space.md,
    borderRadius: radius.lg,
    backgroundColor: color.surface,
    gap: space.md,
  },
  chart: { height: 90, flexDirection: "row", alignItems: "flex-end", gap: 3 },
  barSlot: { flex: 1, height: 84, justifyContent: "flex-end" },
  bar: { minHeight: 4, borderRadius: 4, backgroundColor: color.primary },
  chartLegend: { flexDirection: "row", justifyContent: "space-between" },
  sectionHeading: {
    marginTop: space.sm,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  offerRow: {
    flexDirection: "row",
    gap: space.md,
    alignItems: "center",
    padding: space.md,
    borderRadius: radius.lg,
    backgroundColor: color.surface,
  },
  offerCopy: { flex: 1, gap: 3 },
  offerStat: { alignItems: "flex-end" },
  empty: {
    minHeight: 100,
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
    borderRadius: radius.lg,
    backgroundColor: color.surface,
  },
  errorCard: {
    alignItems: "center",
    padding: space.xl,
    gap: space.sm,
    borderRadius: radius.lg,
    backgroundColor: color.surface,
  },
});
