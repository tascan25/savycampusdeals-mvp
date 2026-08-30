import { Ionicons } from "@expo/vector-icons";
import { Image, StyleSheet, View } from "react-native";

import { AppText, Button } from "@/design-system/components";
import { color, radius, space } from "@/design-system/tokens";
import type { BrandOfferClaimResult } from "@/types/offer";
import { resolveMediaUrl } from "@/utils/media";

export function BrandClaimListItem({
  claim,
  onContinue,
  continuing,
}: {
  claim: BrandOfferClaimResult;
  onContinue: () => void;
  continuing: boolean;
}) {
  const claimedLabel = claim.claimed_at
    ? new Date(claim.claimed_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })
    : "previously";

  return (
    <View style={styles.card}>
      <View style={styles.imageWrap}>
        <Image
          source={{ uri: resolveMediaUrl(claim.image_url) }}
          style={styles.image}
          resizeMode="cover"
        />
        <View style={styles.badge}>
          <Ionicons name="globe" size={10} color={color.primary} />
          <AppText variant="caption" color={color.primary}>
            Listed offer
          </AppText>
        </View>
        <AppText variant="h3" style={styles.discount} numberOfLines={1}>
          {claim.discount}
        </AppText>
      </View>
      <View style={styles.body}>
        <AppText variant="caption" color={color.textTertiary}>
          {claim.brand}
        </AppText>
        <AppText variant="small" numberOfLines={2}>
          {claim.offer_title}
        </AppText>
        <AppText variant="caption" color={color.textTertiary}>
          Claimed {claimedLabel}
        </AppText>
        <View style={styles.action}>
          <Button
            label="Continue to official website"
            variant="secondary"
            onPress={onContinue}
            loading={continuing}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    backgroundColor: color.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.border,
    overflow: "hidden",
  },
  imageWrap: {
    aspectRatio: 16 / 9,
    backgroundColor: color.surfaceElevated,
    justifyContent: "flex-end",
    padding: space.sm,
  },
  image: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  badge: {
    position: "absolute",
    top: space.sm,
    right: space.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: space.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  discount: {
    color: color.textPrimary,
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowRadius: 8,
  },
  body: { padding: space.md, gap: 4 },
  action: { marginTop: space.sm },
});
