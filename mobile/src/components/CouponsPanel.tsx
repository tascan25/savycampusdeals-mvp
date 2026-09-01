import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, FlatList, Linking, StyleSheet, View } from "react-native";

import { apiListBrandOfferClaims, apiListCoupons } from "@/api/coupons";
import { apiClaimOffer } from "@/api/offers";
import { queryKeys } from "@/api/queryKeys";
import { BrandClaimListItem } from "@/components/BrandClaimListItem";
import { CouponDetailModal } from "@/components/CouponDetailModal";
import { CouponListItem } from "@/components/CouponListItem";
import { AppText, SegmentedControl } from "@/design-system/components";
import { color, space } from "@/design-system/tokens";
import {
  isBrandOfferClaim,
  type BrandOfferClaimResult,
  type CouponClaimResult,
} from "@/types/offer";

function EmptyState({ message, onPress }: { message: string; onPress: () => void }) {
  return (
    <View style={styles.empty}>
      <AppText variant="body" color={color.textSecondary} style={styles.emptyText}>
        {message}
      </AppText>
      <AppText variant="small" color={color.primary} onPress={onPress}>
        Explore offers →
      </AppText>
    </View>
  );
}

function PartnerCoupons({
  coupons,
  isLoading,
  onOpen,
  onExplore,
}: {
  coupons: CouponClaimResult[];
  isLoading: boolean;
  onOpen: (coupon: CouponClaimResult) => void;
  onExplore: () => void;
}) {
  return (
    <FlatList
      data={coupons}
      keyExtractor={(item) => item.id}
      numColumns={2}
      contentContainerStyle={styles.grid}
      renderItem={({ item }) => (
        <View style={styles.gridItem}>
          <CouponListItem coupon={item} onPress={() => onOpen(item)} />
        </View>
      )}
      ListEmptyComponent={
        isLoading ? (
          <ActivityIndicator color={color.primary} style={styles.loading} />
        ) : (
          <EmptyState message="No partner coupons yet." onPress={onExplore} />
        )
      }
    />
  );
}

function BrandOffers({
  claims,
  isLoading,
  continuingId,
  onContinue,
  onExplore,
}: {
  claims: BrandOfferClaimResult[];
  isLoading: boolean;
  continuingId: string | null;
  onContinue: (offerId: string, fallbackUrl: string) => void;
  onExplore: () => void;
}) {
  return (
    <FlatList
      data={claims}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.list}
      renderItem={({ item: claim }) => (
        <BrandClaimListItem
          claim={claim}
          continuing={continuingId === claim.offer_id}
          onContinue={() => onContinue(claim.offer_id, claim.official_url)}
        />
      )}
      ItemSeparatorComponent={() => <View style={styles.listSeparator} />}
      ListEmptyComponent={
        isLoading ? (
          <ActivityIndicator color={color.primary} style={styles.loading} />
        ) : (
          <EmptyState message="No listed brand offers claimed yet." onPress={onExplore} />
        )
      }
    />
  );
}

export function CouponsPanel() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [segment, setSegment] = useState<"partner" | "brand">("partner");
  const [activeCoupon, setActiveCoupon] = useState<CouponClaimResult | null>(null);
  const [continuingId, setContinuingId] = useState<string | null>(null);

  const couponsQuery = useQuery({
    queryKey: queryKeys.coupons.mine(),
    queryFn: apiListCoupons,
  });
  const brandClaimsQuery = useQuery({
    queryKey: queryKeys.coupons.brandClaims(),
    queryFn: apiListBrandOfferClaims,
  });

  const goExplore = () => router.push("/(tabs)/explore");

  const continueToBrand = async (offerId: string, fallbackUrl: string) => {
    setContinuingId(offerId);
    try {
      const result = await apiClaimOffer(offerId);
      const url = isBrandOfferClaim(result) ? result.official_url : fallbackUrl;
      if (url) await Linking.openURL(url);
    } catch {
      // Best-effort: the offer was already claimed once to get here, so a
      // transient failure here just means the browser hop didn't happen —
      // nothing to roll back.
    } finally {
      setContinuingId(null);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.segmentWrap}>
        <SegmentedControl
          options={[
            { value: "partner", label: `Coupons (${couponsQuery.data?.length ?? 0})` },
            { value: "brand", label: `Brand links (${brandClaimsQuery.data?.length ?? 0})` },
          ]}
          value={segment}
          onChange={setSegment}
        />
      </View>

      {segment === "partner" ? (
        <PartnerCoupons
          coupons={couponsQuery.data ?? []}
          isLoading={couponsQuery.isLoading}
          onOpen={setActiveCoupon}
          onExplore={goExplore}
        />
      ) : (
        <BrandOffers
          claims={brandClaimsQuery.data ?? []}
          isLoading={brandClaimsQuery.isLoading}
          continuingId={continuingId}
          onContinue={continueToBrand}
          onExplore={goExplore}
        />
      )}

      <CouponDetailModal
        coupon={activeCoupon}
        onClose={() => {
          setActiveCoupon(null);
          queryClient.invalidateQueries({ queryKey: queryKeys.coupons.mine() });
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  segmentWrap: { paddingHorizontal: space.lg, paddingVertical: space.md },
  loading: { marginTop: space.xl },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: space.md,
    paddingBottom: space.xl,
  },
  gridItem: { width: "50%", padding: space.xs },
  list: { flexGrow: 1, paddingHorizontal: space.lg, paddingBottom: space.xl },
  listSeparator: { height: space.md },
  empty: { alignItems: "center", padding: space.xl, gap: space.sm },
  emptyText: { textAlign: "center" },
});
