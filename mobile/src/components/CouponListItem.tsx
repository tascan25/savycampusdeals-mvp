import { Ionicons } from "@expo/vector-icons";
import { Image, Pressable, StyleSheet, View } from "react-native";

import { AppText } from "@/design-system/components";
import { color, radius, space } from "@/design-system/tokens";
import type { CouponClaimResult } from "@/types/offer";
import { resolveMediaUrl } from "@/utils/media";

const STATUS_META: Record<
  CouponClaimResult["status"],
  { label: string; icon: keyof typeof Ionicons.glyphMap; color: string }
> = {
  active: { label: "Active", icon: "pricetag", color: color.success },
  redeemed: { label: "Redeemed", icon: "checkmark-circle", color: color.textSecondary },
  expired: { label: "Expired", icon: "time", color: color.destructive },
};

export function CouponListItem({
  coupon,
  onPress,
}: {
  coupon: CouponClaimResult;
  onPress: () => void;
}) {
  const meta = STATUS_META[coupon.status];

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${coupon.brand}: ${coupon.discount}, ${meta.label}`}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.imageWrap}>
        <Image
          source={{ uri: resolveMediaUrl(coupon.image_url) }}
          style={styles.image}
          resizeMode="cover"
        />
        <View style={[styles.statusBadge, { borderColor: `${meta.color}4D` }]}>
          <Ionicons name={meta.icon} size={10} color={meta.color} />
          <AppText variant="caption" color={meta.color}>
            {meta.label}
          </AppText>
        </View>
        <AppText variant="h3" style={styles.discount} numberOfLines={1}>
          {coupon.discount}
        </AppText>
      </View>
      <View style={styles.body}>
        <AppText variant="caption" color={color.textTertiary}>
          {coupon.brand}
        </AppText>
        <AppText variant="small" numberOfLines={1}>
          {coupon.offer_title}
        </AppText>
        <AppText variant="caption" color={color.textTertiary} style={styles.code}>
          {coupon.code}
        </AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: radius.lg,
    backgroundColor: color.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.border,
    overflow: "hidden",
  },
  pressed: { opacity: 0.9 },
  imageWrap: {
    aspectRatio: 16 / 9,
    backgroundColor: color.surfaceElevated,
    justifyContent: "flex-end",
    padding: space.sm,
  },
  image: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  statusBadge: {
    position: "absolute",
    top: space.sm,
    right: space.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: space.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  discount: {
    color: color.textPrimary,
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowRadius: 8,
  },
  body: { padding: space.md, gap: 2 },
  code: { fontVariant: ["tabular-nums"], marginTop: 2 },
});
