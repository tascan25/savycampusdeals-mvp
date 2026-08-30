import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";

import { toApiError } from "@/api/errors";
import { apiClaimOffer } from "@/api/offers";
import { apiGetOutlet } from "@/api/outlets";
import { queryKeys } from "@/api/queryKeys";
import { ClaimSuccessCard } from "@/components/ClaimSuccessCard";
import { AppText, Button, Screen } from "@/design-system/components";
import { color, radius, space } from "@/design-system/tokens";
import { useAuth } from "@/providers/AuthProvider";
import { isBrandOfferClaim, type CouponClaimResult } from "@/types/offer";
import { resolveMediaUrl } from "@/utils/media";

export default function OutletDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [claimedCoupons, setClaimedCoupons] = useState<Record<string, CouponClaimResult>>({});

  const outletQuery = useQuery({
    queryKey: queryKeys.outlets.detail(id),
    queryFn: () => apiGetOutlet(id),
  });
  const outlet = outletQuery.data;

  const canClaim = user?.verification_status === "approved";

  const claim = async (offerId: string) => {
    setClaimingId(offerId);
    setClaimError(null);
    try {
      const result = await apiClaimOffer(offerId);
      if (!isBrandOfferClaim(result)) {
        setClaimedCoupons((prev) => ({ ...prev, [offerId]: result }));
      }
      await queryClient.invalidateQueries({ queryKey: queryKeys.outlets.detail(id) });
    } catch (error) {
      setClaimError(toApiError(error).message);
    } finally {
      setClaimingId(null);
    }
  };

  if (outletQuery.isLoading || !outlet) {
    return (
      <Screen>
        <View style={styles.loading}>
          <ActivityIndicator color={color.primary} />
        </View>
      </Screen>
    );
  }

  const mapUrl = `https://www.google.com/maps/dir/?api=1&destination=${outlet.lat},${outlet.lng}`;

  return (
    <Screen edges={["bottom"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.heroWrap}>
          <Image
            source={{ uri: resolveMediaUrl(outlet.cover_url || outlet.image_url) }}
            style={styles.hero}
            resizeMode="cover"
          />
          <View style={styles.heroOverlay}>
            <AppText variant="caption" color="rgba(255,255,255,0.75)" style={styles.eyebrow}>
              {outlet.cuisine}
            </AppText>
            <AppText variant="h1">{outlet.name}</AppText>
            <View style={styles.chipRow}>
              <View style={styles.chip}>
                <Ionicons name="star" size={11} color={color.amber} />
                <AppText variant="caption" color={color.textPrimary}>
                  {outlet.rating.toFixed(1)}
                </AppText>
              </View>
              <View style={styles.chip}>
                <Ionicons name="location" size={11} color={color.textPrimary} />
                <AppText variant="caption" color={color.textPrimary}>
                  {outlet.city}
                </AppText>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.addressCard}>
          <View style={styles.addressRow}>
            <Ionicons name="location" size={16} color={color.success} />
            <AppText variant="body" color={color.textSecondary} style={styles.addressText}>
              {outlet.address}
            </AppText>
          </View>
          {outlet.phone ? (
            <View style={styles.addressRow}>
              <Ionicons name="call" size={14} color={color.primary} />
              <AppText variant="small" color={color.textSecondary}>
                {outlet.phone}
              </AppText>
            </View>
          ) : null}
          <View style={styles.addressRow}>
            <Ionicons name="time" size={14} color={color.primary} />
            <AppText variant="small" color={color.textSecondary}>
              {outlet.hours}
            </AppText>
          </View>
          <Button
            label="Get directions"
            variant="secondary"
            onPress={() => Linking.openURL(mapUrl)}
          />
        </View>

        <View style={styles.dealsHeader}>
          <AppText variant="h2">Available deals</AppText>
          <AppText variant="caption" color={color.textTertiary}>
            {outlet.offers.length} active
          </AppText>
        </View>

        {outlet.already_redeemed_here ? (
          <View style={styles.gateNotice}>
            <Ionicons name="shield-checkmark" size={14} color={color.amber} />
            <AppText variant="small" color={color.amber} style={styles.gateText}>
              {outlet.claim_message ||
                "You've already redeemed a deal here. You can claim a fresh one once this outlet posts a newer deal."}
            </AppText>
          </View>
        ) : null}

        {!canClaim ? (
          <Pressable
            onPress={() => router.push("/verify")}
            accessibilityRole="button"
            style={styles.gateNotice}
          >
            <Ionicons name="sparkles" size={14} color={color.primary} />
            <AppText variant="small" color={color.primary} style={styles.gateText}>
              Get verified to claim deals here. Verify now →
            </AppText>
          </Pressable>
        ) : null}

        {claimError ? (
          <AppText
            variant="small"
            color={color.destructive}
            accessibilityRole="alert"
            style={styles.claimErrorText}
          >
            {claimError}
          </AppText>
        ) : null}

        <View style={styles.dealsList}>
          {outlet.offers.length === 0 ? (
            <View style={styles.empty}>
              <AppText variant="body" color={color.textSecondary}>
                No active deals right now. Check back soon.
              </AppText>
            </View>
          ) : null}
          {outlet.offers.map((offer) => {
            const coupon = claimedCoupons[offer.id];
            const blocked = Boolean(offer.claim_blocked);
            return (
              <View key={offer.id} style={styles.dealCard}>
                <View style={styles.dealHeader}>
                  <Pressable
                    style={({ pressed }) => [styles.dealInfo, pressed && styles.dealInfoPressed]}
                    onPress={() => router.push(`/offer/${offer.id}`)}
                    accessibilityRole="button"
                    accessibilityLabel={`View ${offer.title} details`}
                  >
                    <AppText variant="caption" color={color.success} style={styles.eyebrow}>
                      {offer.category}
                    </AppText>
                    <AppText variant="bodyMedium">{offer.title}</AppText>
                    <AppText variant="small" color={color.textSecondary} numberOfLines={2}>
                      {offer.description}
                    </AppText>
                    {blocked && offer.claim_message ? (
                      <AppText variant="caption" color={color.amber} style={styles.blockedText}>
                        {offer.claim_message}
                      </AppText>
                    ) : null}
                    <View style={styles.viewDetailsRow}>
                      <AppText variant="caption" color="#A5B4FC">View deal details</AppText>
                      <Ionicons name="chevron-forward" size={13} color="#A5B4FC" />
                    </View>
                  </Pressable>
                  <View style={styles.dealAction}>
                    <AppText variant="h3">{offer.discount}</AppText>
                    {!coupon ? (
                      <Button
                        label="Claim"
                        onPress={() => claim(offer.id)}
                        loading={claimingId === offer.id}
                        disabled={claimingId === offer.id || blocked || !canClaim}
                      />
                    ) : null}
                  </View>
                </View>
                {coupon ? <ClaimSuccessCard coupon={coupon} /> : null}
              </View>
            );
          })}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { paddingBottom: space.xl },
  heroWrap: { aspectRatio: 16 / 9, backgroundColor: color.surfaceElevated },
  hero: { width: "100%", height: "100%" },
  heroOverlay: { position: "absolute", left: space.lg, right: space.lg, bottom: space.lg, gap: 4 },
  eyebrow: { textTransform: "uppercase", letterSpacing: 0.4 },
  chipRow: { flexDirection: "row", gap: space.xs, marginTop: 4 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: space.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  addressCard: {
    margin: space.lg,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.border,
    backgroundColor: color.surface,
    padding: space.md,
    gap: space.sm,
  },
  addressRow: { flexDirection: "row", alignItems: "flex-start", gap: space.sm },
  addressText: { flex: 1 },
  dealsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: space.lg,
  },
  gateNotice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space.xs,
    marginHorizontal: space.lg,
    marginTop: space.sm,
  },
  gateText: { flex: 1 },
  claimErrorText: { marginHorizontal: space.lg, marginTop: space.sm },
  dealsList: { padding: space.lg, gap: space.md },
  empty: { padding: space.xl, alignItems: "center" },
  dealCard: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.border,
    backgroundColor: color.surface,
    padding: space.md,
    gap: space.md,
  },
  dealHeader: { flexDirection: "row", gap: space.md },
  dealInfo: { flex: 1, gap: 4 },
  dealInfoPressed: { opacity: 0.72 },
  viewDetailsRow: { marginTop: space.sm, flexDirection: "row", alignItems: "center", gap: 3 },
  blockedText: { marginTop: 4 },
  dealAction: { alignItems: "flex-end", gap: space.sm, minWidth: 110 },
});
