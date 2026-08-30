import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Image, Pressable, StyleSheet, View } from "react-native";

import { AppText } from "@/design-system/components";
import { color, radius, space } from "@/design-system/tokens";
import type { CouponClaimResult } from "@/types/offer";
import { resolveMediaUrl } from "@/utils/media";

function expiryLabel(value: string | null): string {
  if (!value) return "Check offer details";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Check offer details";
  const today = new Date();
  if (date.toDateString() === today.toDateString()) {
    return `Valid until ${date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} today`;
  }
  return `Valid until ${date.toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" })}`;
}

export function CouponTicket({ coupon, onPress }: { coupon: CouponClaimResult; onPress: () => void }) {
  const inactive = coupon.status !== "active";

  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`Open ${coupon.brand} coupon`} style={({ pressed }) => [styles.ticket, pressed && styles.pressed]}>
      <LinearGradient colors={inactive ? ["#23232B", "#17171D"] : ["#6D28D9", "#4338CA", "#312E81"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.gradient}>
        <View style={styles.details}>
          <View style={styles.brandRow}>
            {coupon.brand_logo ? (
              <Image source={{ uri: resolveMediaUrl(coupon.brand_logo) }} style={styles.logo} />
            ) : (
              <View style={styles.logoFallback}><AppText variant="bodyMedium">{coupon.brand.charAt(0)}</AppText></View>
            )}
            <View style={styles.brandCopy}>
              <AppText variant="bodyMedium" numberOfLines={1}>{coupon.brand}</AppText>
              <AppText variant="caption" color="rgba(255,255,255,0.68)" numberOfLines={1}>{coupon.offer_title}</AppText>
            </View>
          </View>

          <AppText style={styles.discount} numberOfLines={2}>{coupon.discount}</AppText>
          <View style={styles.validity}>
            <Ionicons name={inactive ? "checkmark-circle-outline" : "time-outline"} size={16} color="rgba(255,255,255,0.76)" />
            <AppText variant="caption" color="rgba(255,255,255,0.76)" numberOfLines={1}>
              {inactive ? (coupon.status === "redeemed" ? "Used coupon" : "Expired coupon") : expiryLabel(coupon.expires_at)}
            </AppText>
          </View>
          <View style={styles.codeBlock}>
            <AppText variant="caption" color="rgba(255,255,255,0.58)" style={styles.codeLabel}>COUPON CODE</AppText>
            <AppText style={styles.code} numberOfLines={1} adjustsFontSizeToFit>{coupon.code}</AppText>
          </View>
        </View>

        <View style={styles.separator} />
        <View style={styles.qrSide}>
          <View style={[styles.qrWrap, inactive && styles.qrInactive]}>
            {coupon.qr_data_uri ? <Image source={{ uri: coupon.qr_data_uri }} style={styles.qr} /> : <Ionicons name="qr-code" size={60} color="#18181B" />}
          </View>
          <AppText variant="caption" color="rgba(255,255,255,0.82)" style={styles.qrHelp}>
            {inactive ? "Coupon history" : "Show QR at counter"}
          </AppText>
        </View>

        <View style={[styles.notch, styles.notchLeft]} />
        <View style={[styles.notch, styles.notchRight]} />
        <View style={[styles.notch, styles.notchTop]} />
        <View style={[styles.notch, styles.notchBottom]} />
      </LinearGradient>
    </Pressable>
  );
}

export function CouponCompactRow({ coupon, onPress }: { coupon: CouponClaimResult; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.compact, pressed && styles.pressed]}>
      {coupon.brand_logo ? <Image source={{ uri: resolveMediaUrl(coupon.brand_logo) }} style={styles.compactLogo} /> : <View style={styles.compactLogoFallback}><AppText variant="bodyMedium">{coupon.brand.charAt(0)}</AppText></View>}
      <View style={styles.compactCopy}>
        <AppText variant="bodyMedium" numberOfLines={1}>{coupon.brand}</AppText>
        <AppText variant="h3" numberOfLines={1}>{coupon.discount}</AppText>
      </View>
      <Ionicons name="chevron-forward" size={20} color={color.textSecondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  ticket: { minHeight: 306, borderRadius: radius.lg, overflow: "hidden", shadowColor: "#6D28D9", shadowOpacity: 0.25, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 5 },
  pressed: { opacity: 0.91, transform: [{ scale: 0.995 }] },
  gradient: { flex: 1, flexDirection: "row", overflow: "hidden" },
  details: { flex: 1, padding: space.lg, paddingRight: space.md },
  brandRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  logo: { width: 48, height: 48, borderRadius: 24, backgroundColor: color.surface },
  logoFallback: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(5,5,5,0.75)" },
  brandCopy: { flex: 1, gap: 1 },
  discount: { marginTop: space.lg, fontSize: 31, lineHeight: 35, fontWeight: "900", letterSpacing: -0.8 },
  validity: { marginTop: space.md, flexDirection: "row", alignItems: "center", gap: 6 },
  codeBlock: { marginTop: "auto", paddingTop: space.md, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.26)", borderStyle: "dashed" },
  codeLabel: { letterSpacing: 1.4 },
  code: { marginTop: 3, fontSize: 24, lineHeight: 29, fontWeight: "800", letterSpacing: 0.4 },
  separator: { width: 1, marginVertical: space.lg, borderLeftWidth: 1, borderLeftColor: "rgba(255,255,255,0.34)", borderStyle: "dashed" },
  qrSide: { width: 124, alignItems: "center", justifyContent: "center", paddingHorizontal: space.md },
  qrWrap: { width: 98, height: 98, padding: 7, borderRadius: radius.md, alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFF" },
  qrInactive: { opacity: 0.48 },
  qr: { width: "100%", height: "100%" },
  qrHelp: { marginTop: space.md, textAlign: "center", lineHeight: 17 },
  notch: { position: "absolute", width: 22, height: 22, borderRadius: 11, backgroundColor: color.background },
  notchLeft: { left: -11, top: "50%", marginTop: -11 },
  notchRight: { right: -11, top: "50%", marginTop: -11 },
  notchTop: { top: -11, right: 113 },
  notchBottom: { bottom: -11, right: 113 },
  compact: { minHeight: 96, padding: space.md, flexDirection: "row", alignItems: "center", gap: space.md, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: color.borderStrong, backgroundColor: color.surfaceMuted },
  compactLogo: { width: 52, height: 52, borderRadius: 26, backgroundColor: color.surfaceElevated },
  compactLogoFallback: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center", backgroundColor: color.surfaceElevated },
  compactCopy: { flex: 1, gap: 2 },
});
