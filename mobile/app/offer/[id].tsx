import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ActivityIndicator,
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";

import { apiClaimOffer, apiGetOffer } from "@/api/offers";
import { toApiError } from "@/api/errors";
import { queryKeys } from "@/api/queryKeys";
import { ClaimSuccessCard } from "@/components/ClaimSuccessCard";
import { SaveOfferFeedback } from "@/components/SaveOfferFeedback";
import { AppText, Button, Screen } from "@/design-system/components";
import { color, radius, space } from "@/design-system/tokens";
import { useSaveOfferToggle } from "@/hooks/useSaveOfferToggle";
import { useAuth } from "@/providers/AuthProvider";
import { usePushNotifications } from "@/providers/PushNotificationProvider";
import { presentClaimReadyNotification } from "@/services/localNotifications";
import { isBrandOfferClaim, type ClaimResult } from "@/types/offer";
import { resolveMediaUrl } from "@/utils/media";
import { getVerificationHref } from "@/utils/verificationRoute";

export default function OfferDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { reconcileReminders } = usePushNotifications();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { feedback, toggleSave } = useSaveOfferToggle();
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [claimResult, setClaimResult] = useState<ClaimResult | null>(null);
  const [brandModalOpen, setBrandModalOpen] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const insets = useSafeAreaInsets();

  const offerQuery = useQuery({
    queryKey: queryKeys.offers.detail(id),
    queryFn: () => apiGetOffer(id),
  });
  const offer = offerQuery.data;

  const invalidateOffers = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.offers.all() });

  const canClaim = user?.verification_status === "approved";
  const isListedBrand = Boolean(offer?.brand_url && !offer?.outlet_id);

  const runClaim = async (): Promise<ClaimResult | null> => {
    if (!offer) return null;
    setClaiming(true);
    setClaimError(null);
    try {
      const result = await apiClaimOffer(offer.id);
      await invalidateOffers();
      if (isBrandOfferClaim(result) || !result.already_active) {
        void presentClaimReadyNotification(result).catch(() => undefined);
      }
      void reconcileReminders().catch(() => undefined);
      return result;
    } catch (error) {
      setClaimError(toApiError(error).message);
      return null;
    } finally {
      setClaiming(false);
    }
  };

  const onPressClaim = async () => {
    if (isListedBrand) {
      setBrandModalOpen(true);
      return;
    }
    const result = await runClaim();
    if (result) setClaimResult(result);
  };

  const onContinueToBrand = async () => {
    const result = await runClaim();
    setBrandModalOpen(false);
    if (!result || !offer) return;
    const url = isBrandOfferClaim(result) ? result.official_url : offer.brand_url;
    if (url) Linking.openURL(url).catch(() => setClaimError("Couldn't open the official website."));
  };

  if (offerQuery.isLoading || !offer) {
    return (
      <Screen>
        <View style={styles.loading}>
          <ActivityIndicator color={color.primary} />
        </View>
      </Screen>
    );
  }

  const validity = offer.validity?.trim() || "Ongoing";
  const claimButtonLabel = isListedBrand ? "Claim & visit website" : "Claim this deal";
  const couponResult = claimResult && !isBrandOfferClaim(claimResult) ? claimResult : null;
  const newlyClaimed = Boolean(couponResult && !couponResult.already_active);
  const couponActive = Boolean(offer.active_coupon || couponResult?.already_active);

  return (
    <Screen edges={[]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.heroWrap}>
          <Image
            source={{ uri: resolveMediaUrl(offer.image_url) }}
            style={styles.hero}
            resizeMode="cover"
          />
          <LinearGradient
            colors={["rgba(0,0,0,0.5)", "transparent", "rgba(0,0,0,0.38)"]}
            locations={[0, 0.42, 1]}
            style={StyleSheet.absoluteFill}
          />
          <View style={[styles.heroControls, { top: insets.top + 8 }]}>
            <Pressable
              onPress={() => router.back()}
              style={styles.circleButton}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <Ionicons name="arrow-back" size={25} color="#FFFFFF" />
            </Pressable>
            <Pressable
              onPress={() => void toggleSave(offer)}
              style={styles.circleButton}
              accessibilityRole="button"
              accessibilityLabel={offer.saved ? "Remove from saved" : "Save deal"}
            >
              <Ionicons
                name={offer.saved ? "bookmark" : "bookmark-outline"}
                size={23}
                color="#FFFFFF"
              />
            </Pressable>
          </View>
          <View style={styles.discountPill}>
            <AppText style={styles.discountText}>{offer.discount}</AppText>
          </View>
        </View>

        <View style={styles.sheet}>
          <View style={styles.handle} />
          <AppText style={styles.brand}>{offer.brand}</AppText>
          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Ionicons name="shield-checkmark" size={16} color="#54D49B" />
              <AppText variant="small" color={color.textSecondary}>
                Verified students only
              </AppText>
            </View>
            <View style={styles.metaDot} />
            <View style={styles.metaItem}>
              <Ionicons
                name={offer.outlet_id ? "location-outline" : "people-outline"}
                size={15}
                color={color.textSecondary}
              />
              <AppText variant="small" color={color.textSecondary} numberOfLines={1}>
                {offer.location || `${offer.claims_count.toLocaleString("en-IN")} claimed`}
              </AppText>
            </View>
          </View>

          <AppText variant="body" color="#B8B8C2" style={styles.description}>
            {offer.description || offer.title}
          </AppText>

          <View style={styles.factList}>
            <FactRow
              icon="restaurant-outline"
              iconColor="#D4D4D8"
              label={offer.outlet_id ? "Redeem at the outlet" : "Redeem on official website"}
            />
            <FactRow icon="calendar-outline" iconColor="#54D49B" label={validity} />
            <FactRow
              icon="ticket-outline"
              iconColor="#8B7CFF"
              label={offer.redemption_policy || "One use per verified student"}
            />
          </View>

          <Pressable
            style={styles.termsToggle}
            onPress={() => setTermsOpen((value) => !value)}
            accessibilityRole="button"
            accessibilityState={{ expanded: termsOpen }}
          >
            <AppText variant="bodyMedium">Terms & details</AppText>
            <Ionicons
              name={termsOpen ? "chevron-up" : "chevron-down"}
              size={20}
              color={color.textSecondary}
            />
          </Pressable>
          {termsOpen ? (
            <View style={styles.termsBody}>
              <AppText variant="small" color={color.textSecondary} style={styles.termsText}>
                {offer.terms}
              </AppText>
              {isListedBrand && offer.disclaimer ? (
                <AppText variant="caption" color={color.textTertiary} style={styles.disclaimer}>
                  {offer.disclaimer}
                </AppText>
              ) : null}
            </View>
          ) : null}

          {newlyClaimed && couponResult ? (
            <View style={styles.successWrap}>
              <ClaimSuccessCard coupon={couponResult} />
            </View>
          ) : couponActive ? (
            <View style={styles.activeCouponActions}>
              <View style={styles.activeBadge}>
                <Ionicons name="checkmark-circle" size={15} color={color.success} />
                <AppText variant="small" color={color.success}>
                  Coupon active
                </AppText>
              </View>
              <Button label="View in Wallet" onPress={() => router.push("/(tabs)/wallet")} />
            </View>
          ) : (
            <>
              {!canClaim ? (
                <Pressable
                  onPress={() => router.push(getVerificationHref(user))}
                  accessibilityRole="button"
                  style={styles.verifyNotice}
                >
                  <Ionicons name="sparkles" size={14} color={color.amber} />
                  <AppText variant="small" color={color.amber} style={styles.noticeText}>
                    Get verified to claim this offer. Verify now →
                  </AppText>
                </Pressable>
              ) : null}
              {claimError ? (
                <AppText variant="small" color={color.destructive} accessibilityRole="alert">
                  {claimError}
                </AppText>
              ) : null}
              <Button
                label={claiming ? "Claiming…" : claimButtonLabel}
                onPress={onPressClaim}
                loading={claiming}
                disabled={!canClaim}
              />
            </>
          )}
          <View style={{ height: Math.max(insets.bottom, space.md) }} />
        </View>
      </ScrollView>

      <Modal
        visible={brandModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => !claiming && setBrandModalOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Ionicons name="open-outline" size={22} color={color.primary} />
            <AppText variant="h3" style={styles.modalTitle}>
              You&apos;re leaving Savvy Campus
            </AppText>
            <AppText variant="small" color={color.textSecondary} style={styles.modalBody}>
              You&apos;re continuing to {offer.brand}&apos;s official website to activate this
              offer.
            </AppText>
            <View style={styles.modalActions}>
              <View style={styles.modalButton}>
                <Button
                  label="Cancel"
                  variant="secondary"
                  onPress={() => setBrandModalOpen(false)}
                  disabled={claiming}
                />
              </View>
              <View style={styles.modalButton}>
                <Button
                  label="Continue"
                  onPress={onContinueToBrand}
                  loading={claiming}
                  disabled={claiming}
                />
              </View>
            </View>
          </View>
        </View>
      </Modal>
      <SaveOfferFeedback feedback={feedback} />
    </Screen>
  );
}

function FactRow({
  icon,
  iconColor,
  label,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  label: string;
}) {
  return (
    <View style={styles.factRow}>
      <View style={styles.factIcon}>
        <Ionicons name={icon} size={21} color={iconColor} />
      </View>
      <AppText variant="body" color="#D4D4DC" style={styles.factLabel}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { paddingBottom: 0 },
  heroWrap: { height: 430, backgroundColor: color.surfaceElevated },
  hero: { width: "100%", height: "100%" },
  heroControls: {
    position: "absolute",
    left: space.lg,
    right: space.lg,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  circleButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(6,6,8,0.72)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.24)",
  },
  discountPill: {
    position: "absolute",
    right: space.lg,
    bottom: 8,
    paddingHorizontal: space.md,
    paddingVertical: 10,
    borderRadius: radius.md,
    backgroundColor: "#4F46E5",
    shadowColor: "#4F46E5",
    shadowOpacity: 0.5,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  discountText: { fontSize: 25, lineHeight: 29, fontWeight: "800" },
  sheet: {
    marginTop: -20,
    minHeight: 500,
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    gap: space.md,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    backgroundColor: color.background,
  },
  handle: {
    alignSelf: "center",
    width: 54,
    height: 5,
    marginBottom: space.sm,
    borderRadius: 3,
    backgroundColor: "#393940",
  },
  brand: { fontSize: 30, lineHeight: 36, fontWeight: "800", letterSpacing: -0.6 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: space.sm, flexWrap: "wrap" },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 5, maxWidth: "70%" },
  metaDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: color.textTertiary },
  description: { lineHeight: 23, marginVertical: space.xs },
  factList: {
    borderRadius: radius.md,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.border,
  },
  factRow: {
    minHeight: 58,
    paddingHorizontal: space.md,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.border,
    backgroundColor: "rgba(255,255,255,0.018)",
  },
  factIcon: { width: 38 },
  factLabel: { flex: 1 },
  termsToggle: {
    minHeight: 58,
    paddingHorizontal: space.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.border,
    backgroundColor: color.surface,
  },
  termsBody: { marginTop: -space.sm, paddingHorizontal: space.md, gap: space.sm },
  disclaimer: {
    paddingTop: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.border,
  },
  verifyNotice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space.xs,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: "rgba(245,158,11,0.08)",
  },
  noticeText: { flex: 1 },
  successWrap: { marginTop: space.sm },
  activeCouponActions: { gap: space.sm, marginTop: space.xs },
  activeBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(84,212,155,0.4)",
    backgroundColor: "rgba(84,212,155,0.1)",
  },
  termsText: { lineHeight: 20 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
    padding: space.lg,
  },
  modalCard: {
    width: "100%",
    borderRadius: radius.lg,
    backgroundColor: color.surfaceElevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.border,
    padding: space.lg,
    gap: space.xs,
  },
  modalTitle: { marginTop: space.xs },
  modalBody: { lineHeight: 20 },
  modalActions: { flexDirection: "row", gap: space.sm, marginTop: space.md },
  modalButton: { flex: 1 },
});
