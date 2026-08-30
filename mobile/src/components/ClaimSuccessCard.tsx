import { Image, StyleSheet, View } from "react-native";

import { AppText } from "@/design-system/components";
import { color, radius, space } from "@/design-system/tokens";
import type { CouponClaimResult } from "@/types/offer";

/**
 * Shown inline right after a partner-outlet claim succeeds. There's no
 * Wallet screen yet (Phase 5), so this is the only place the coupon is
 * visible today — not a placeholder for a future screen, a real one.
 */
export function ClaimSuccessCard({ coupon }: { coupon: CouponClaimResult }) {
  const expiresLabel = coupon.expires_at
    ? new Date(coupon.expires_at).toLocaleDateString(undefined, {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <View style={styles.card}>
      <AppText variant="small" color={color.success} style={styles.eyebrow}>
        Coupon ready
      </AppText>
      {coupon.qr_data_uri ? (
        <View style={styles.qrWrap}>
          <Image source={{ uri: coupon.qr_data_uri }} style={styles.qr} resizeMode="contain" />
        </View>
      ) : null}
      <AppText variant="h3" style={styles.code}>
        {coupon.code}
      </AppText>
      {expiresLabel ? (
        <AppText variant="caption" color={color.textSecondary}>
          Valid until {expiresLabel}
        </AppText>
      ) : null}
      <AppText variant="caption" color={color.textTertiary} style={styles.hint}>
        Show this QR code to outlet staff to redeem.
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(34,197,94,0.3)",
    backgroundColor: "rgba(34,197,94,0.08)",
    padding: space.lg,
    alignItems: "center",
    gap: space.xs,
  },
  eyebrow: { textTransform: "uppercase", letterSpacing: 0.4 },
  qrWrap: {
    marginTop: space.sm,
    marginBottom: space.xs,
    padding: space.sm,
    borderRadius: radius.md,
    backgroundColor: color.textPrimary,
  },
  qr: { width: 140, height: 140 },
  code: { letterSpacing: 1 },
  hint: { textAlign: "center", marginTop: space.xs },
});
