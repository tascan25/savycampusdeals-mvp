import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { FlatList, Pressable, ScrollView, StyleSheet, View } from "react-native";

import { apiGetPartnerActivity } from "@/api/partner";
import { queryKeys } from "@/api/queryKeys";
import { LoadingShimmer } from "@/components/LoadingShimmer";
import { PartnerActivityRow } from "@/components/PartnerActivityRow";
import { AppText, Chip, Screen, SearchField } from "@/design-system/components";
import { color, space } from "@/design-system/tokens";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import type { PartnerCouponStatus, PartnerPeriod } from "@/types/partner";

const statuses: { label: string; value?: PartnerCouponStatus }[] = [
  { label: "All" },
  { label: "Active", value: "active" },
  { label: "Redeemed", value: "redeemed" },
  { label: "Expired", value: "expired" },
];

export default function PartnerActivityScreen() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<PartnerCouponStatus | undefined>();
  const [period, setPeriod] = useState<PartnerPeriod>("30d");
  const [page, setPage] = useState(1);
  const debouncedQuery = useDebouncedValue(query, 350);
  const filters = { period, status, q: debouncedQuery.trim() || undefined, page };
  const activity = useQuery({
    queryKey: queryKeys.partner.activity(filters),
    queryFn: () => apiGetPartnerActivity(filters),
  });

  return (
    <Screen edges={["top"]}>
      <FlatList
        data={activity.data?.items ?? []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <PartnerActivityRow item={item} />}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshing={activity.isRefetching}
        onRefresh={() => void activity.refetch()}
        ListHeaderComponent={
          <View style={styles.header}>
            <View>
              <AppText variant="caption" color={color.success} style={styles.eyebrow}>
                OUTLET RECORDS
              </AppText>
              <AppText variant="h1">Activity</AppText>
              <AppText variant="small" color={color.textSecondary}>
                Private to your assigned outlet
              </AppText>
            </View>
            <SearchField
              value={query}
              onChangeText={(value) => {
                setQuery(value);
                setPage(1);
              }}
              placeholder="Student, coupon or offer"
              testID="partner-activity-search"
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chips}
            >
              {(["today", "7d", "30d", "all"] as PartnerPeriod[]).map((value) => (
                <Chip
                  key={value}
                  label={value === "today" ? "Today" : value === "all" ? "All time" : value}
                  active={period === value}
                  onPress={() => {
                    setPeriod(value);
                    setPage(1);
                  }}
                />
              ))}
            </ScrollView>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chips}
            >
              {statuses.map((item) => (
                <Chip
                  key={item.label}
                  label={item.label}
                  active={status === item.value}
                  onPress={() => {
                    setStatus(item.value);
                    setPage(1);
                  }}
                />
              ))}
            </ScrollView>
            {activity.data ? (
              <AppText variant="caption" color={color.textTertiary}>
                {activity.data.total.toLocaleString("en-IN")} matching records
              </AppText>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          activity.isLoading ? (
            <View style={styles.loading}>
              {[0, 1, 2, 3, 4].map((item) => (
                <LoadingShimmer key={item} style={styles.shimmer} />
              ))}
            </View>
          ) : activity.isError ? (
            <View style={styles.empty}>
              <Ionicons name="cloud-offline-outline" size={28} color={color.amber} />
              <AppText variant="bodyMedium">Activity couldn&apos;t be loaded</AppText>
            </View>
          ) : (
            <View style={styles.empty}>
              <Ionicons name="search-outline" size={28} color={color.textTertiary} />
              <AppText variant="bodyMedium">No matching activity</AppText>
              <AppText variant="small" color={color.textTertiary}>
                Try another date range or status.
              </AppText>
            </View>
          )
        }
        ListFooterComponent={
          activity.data && activity.data.total > activity.data.page_size ? (
            <View style={styles.pagination}>
              <Pressable
                disabled={page === 1}
                onPress={() => setPage((value) => Math.max(1, value - 1))}
                style={[styles.pageButton, page === 1 && styles.disabled]}
              >
                <Ionicons name="chevron-back" size={17} color={color.textPrimary} />
                <AppText variant="small">Previous</AppText>
              </Pressable>
              <AppText variant="caption" color={color.textTertiary}>
                Page {page} of {Math.ceil(activity.data.total / activity.data.page_size)}
              </AppText>
              <Pressable
                disabled={page * activity.data.page_size >= activity.data.total}
                onPress={() => setPage((value) => value + 1)}
                style={[
                  styles.pageButton,
                  page * activity.data.page_size >= activity.data.total && styles.disabled,
                ]}
              >
                <AppText variant="small">Next</AppText>
                <Ionicons name="chevron-forward" size={17} color={color.textPrimary} />
              </Pressable>
            </View>
          ) : null
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, paddingBottom: 120 },
  header: { gap: space.md, marginBottom: space.lg },
  eyebrow: { letterSpacing: 1.8, fontWeight: "800" },
  chips: { gap: space.sm },
  separator: { height: space.sm },
  loading: { gap: space.sm },
  shimmer: { height: 96 },
  empty: { minHeight: 240, alignItems: "center", justifyContent: "center", gap: space.sm },
  pagination: {
    marginTop: space.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  pageButton: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: space.sm,
  },
  disabled: { opacity: 0.3 },
});
