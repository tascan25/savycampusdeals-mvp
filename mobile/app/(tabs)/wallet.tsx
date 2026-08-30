import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";

import { apiListCoupons } from "@/api/coupons";
import { queryKeys } from "@/api/queryKeys";
import { CouponCompactRow, CouponTicket } from "@/components/CouponTicket";
import { CouponDetailModal } from "@/components/CouponDetailModal";
import { AppText, Screen, SegmentedControl } from "@/design-system/components";
import { color, radius, space } from "@/design-system/tokens";
import { useAnnouncements } from "@/providers/AnnouncementProvider";
import { useAuth } from "@/providers/AuthProvider";
import type { CouponClaimResult } from "@/types/offer";

type WalletStatus = CouponClaimResult["status"];

export default function WalletTab() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { unreadCount, openCentre } = useAnnouncements();
  const [status, setStatus] = useState<WalletStatus>("active");
  const [selected, setSelected] = useState<CouponClaimResult | null>(null);
  const couponsQuery = useQuery({ queryKey: queryKeys.coupons.mine(), queryFn: apiListCoupons });

  const groups = useMemo(() => {
    const result: Record<WalletStatus, CouponClaimResult[]> = { active: [], redeemed: [], expired: [] };
    for (const coupon of couponsQuery.data ?? []) result[coupon.status].push(coupon);
    return result;
  }, [couponsQuery.data]);
  const visible = groups[status];
  const primaryCoupon = visible[0];

  return (
    <Screen edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={couponsQuery.isRefetching} onRefresh={() => void couponsQuery.refetch()} tintColor={color.textSecondary} />}>
        <View style={styles.header}>
          <View>
            <AppText variant="caption" color={color.textTertiary} style={styles.eyebrow}>YOUR PASSES</AppText>
            <AppText variant="h1">Wallet</AppText>
          </View>
          <View style={styles.headerActions}>
            <Pressable style={styles.pointsButton} onPress={() => router.push("/rewards" as never)} accessibilityRole="button" accessibilityLabel="Open Savvy Points">
              <Ionicons name="sparkles" size={14} color="#C7D2FE" />
              <AppText variant="small">{(user?.savvy_points_balance ?? 0).toLocaleString("en-IN")}</AppText>
            </Pressable>
            <Pressable style={styles.iconButton} onPress={openCentre} accessibilityRole="button" accessibilityLabel="Announcements">
              <Ionicons name="notifications-outline" size={20} color={color.textPrimary} />
              {unreadCount > 0 ? <View style={styles.unreadDot} /> : null}
            </Pressable>
          </View>
        </View>

        <View style={styles.segments}>
          <SegmentedControl
            options={[
              { value: "active", label: `Active  ${groups.active.length}` },
              { value: "redeemed", label: `Used  ${groups.redeemed.length}` },
              { value: "expired", label: `Expired  ${groups.expired.length}` },
            ]}
            value={status}
            onChange={setStatus}
          />
        </View>

        {couponsQuery.isLoading ? (
          <ActivityIndicator color={color.primary} style={styles.loader} />
        ) : primaryCoupon ? (
          <View style={styles.coupons}>
            <CouponTicket coupon={primaryCoupon} onPress={() => setSelected(primaryCoupon)} />
            {visible.length > 1 ? (
              <View style={styles.moreCoupons}>
                {visible.slice(1).map((coupon) => <CouponCompactRow key={coupon.id} coupon={coupon} onPress={() => setSelected(coupon)} />)}
              </View>
            ) : null}
          </View>
        ) : (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}><Ionicons name="ticket-outline" size={28} color="#A5B4FC" /></View>
            <AppText variant="h3">No {status === "redeemed" ? "used" : status} coupons</AppText>
            <AppText variant="small" color={color.textTertiary} style={styles.emptyCopy}>
              {status === "active" ? "Claim a student deal and it will appear here, ready at the counter." : "Your coupon history will stay organised here."}
            </AppText>
            {status === "active" ? <Pressable onPress={() => router.push("/(tabs)/explore")} style={styles.exploreButton}><AppText variant="small" style={styles.exploreLabel}>Explore deals</AppText></Pressable> : null}
          </View>
        )}

        <Pressable style={styles.brandLink} onPress={() => router.push("/brand-claims" as never)} accessibilityRole="button">
          <View style={styles.brandLinkIcon}><Ionicons name="open-outline" size={18} color="#C7D2FE" /></View>
          <View style={styles.brandLinkCopy}>
            <AppText variant="bodyMedium">Claimed online offers</AppText>
            <AppText variant="caption" color={color.textTertiary}>Reopen deals fulfilled on brand websites</AppText>
          </View>
          <Ionicons name="chevron-forward" size={17} color={color.textTertiary} />
        </Pressable>
      </ScrollView>

      <CouponDetailModal coupon={selected} onClose={() => { setSelected(null); void queryClient.invalidateQueries({ queryKey: queryKeys.coupons.mine() }); }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: space.xxl },
  header: { paddingHorizontal: space.lg, paddingTop: space.lg, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  eyebrow: { letterSpacing: 2 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: space.sm },
  pointsButton: { minHeight: 40, paddingHorizontal: space.md, flexDirection: "row", alignItems: "center", gap: 6, borderRadius: radius.pill, backgroundColor: color.primarySoft },
  iconButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 20, backgroundColor: color.surfaceMuted },
  unreadDot: { position: "absolute", top: 8, right: 8, width: 6, height: 6, borderRadius: 3, backgroundColor: color.destructive },
  segments: { paddingHorizontal: space.lg, marginTop: space.xl },
  loader: { marginTop: space.xxl },
  coupons: { paddingHorizontal: space.lg, marginTop: space.lg },
  moreCoupons: { marginTop: space.lg, gap: space.md },
  empty: { marginHorizontal: space.lg, marginTop: space.lg, minHeight: 306, padding: space.xl, alignItems: "center", justifyContent: "center", borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: color.border, backgroundColor: color.surfaceMuted },
  emptyIcon: { width: 58, height: 58, marginBottom: space.md, borderRadius: 29, alignItems: "center", justifyContent: "center", backgroundColor: color.primarySoft },
  emptyCopy: { maxWidth: 260, marginTop: space.sm, textAlign: "center", lineHeight: 19 },
  exploreButton: { marginTop: space.lg, minHeight: 42, paddingHorizontal: space.lg, alignItems: "center", justifyContent: "center", borderRadius: radius.pill, backgroundColor: "#FFFFFF" },
  exploreLabel: { color: "#111114", fontWeight: "800" },
  brandLink: { marginHorizontal: space.lg, marginTop: space.lg, paddingVertical: space.md, flexDirection: "row", alignItems: "center", gap: space.md },
  brandLinkIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: color.primarySoft },
  brandLinkCopy: { flex: 1 },
});
