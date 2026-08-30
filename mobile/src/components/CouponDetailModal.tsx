import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { useState } from "react";
import { Image, Modal, Pressable, StyleSheet, View } from "react-native";

import { AppText } from "@/design-system/components";
import { color, radius, space } from "@/design-system/tokens";
import type { CouponClaimResult } from "@/types/offer";

export function CouponDetailModal({
  coupon,
  onClose,
}: {
  coupon: CouponClaimResult | null;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    if (!coupon) return;
    await Clipboard.setStringAsync(coupon.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Modal
      visible={Boolean(coupon)}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      onDismiss={() => setCopied(false)}
    >
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
        {coupon ? (
          <View style={styles.card}>
            <Pressable
              onPress={onClose}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Close"
              style={styles.closeButton}
            >
              <Ionicons name="close" size={18} color={color.textSecondary} />
            </Pressable>

            <AppText variant="caption" color={color.primary} style={styles.eyebrow}>
              Partner coupon
            </AppText>
            <AppText variant="h2">{coupon.brand}</AppText>
            <AppText variant="small" color={color.textSecondary}>
              {coupon.offer_title}
            </AppText>

            <View style={styles.qrWrap}>
              {coupon.qr_data_uri ? (
                <Image
                  source={{ uri: coupon.qr_data_uri }}
                  style={styles.qr}
                  resizeMode="contain"
                />
              ) : null}
            </View>

            <Pressable onPress={onCopy} accessibilityRole="button" style={styles.codeRow}>
              <AppText variant="bodyMedium" style={styles.code}>
                {coupon.code}
              </AppText>
              <View style={styles.copyButton}>
                <Ionicons
                  name={copied ? "checkmark" : "copy-outline"}
                  size={14}
                  color={color.textPrimary}
                />
                <AppText variant="caption">{copied ? "Copied" : "Copy"}</AppText>
              </View>
            </Pressable>

            <View style={[styles.notice, coupon.status !== "active" && styles.noticeInactive]}>
              <AppText
                variant="caption"
                color={coupon.status === "active" ? color.amber : color.textSecondary}
                style={styles.noticeText}
              >
                {coupon.status === "active"
                  ? "Ask outlet staff to scan and approve this QR before your bill is closed. Your discount is confirmed only when this coupon shows Redeemed."
                  : coupon.status === "redeemed"
                    ? "This coupon has already been used and is kept here for your history."
                    : "This coupon has expired and can no longer be redeemed."}
              </AppText>
            </View>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    alignItems: "center",
    justifyContent: "center",
    padding: space.lg,
  },
  card: {
    width: "100%",
    maxWidth: 420,
    borderRadius: radius.lg,
    backgroundColor: color.surfaceElevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.border,
    padding: space.lg,
    gap: space.xs,
  },
  closeButton: { position: "absolute", top: space.md, right: space.md, zIndex: 1 },
  eyebrow: { textTransform: "uppercase", letterSpacing: 0.5 },
  qrWrap: {
    marginTop: space.md,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: color.textPrimary,
    alignItems: "center",
  },
  qr: { width: 180, height: 180 },
  codeRow: {
    marginTop: space.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.border,
    backgroundColor: color.surface,
    padding: space.sm,
  },
  code: { letterSpacing: 1 },
  copyButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: space.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: color.surfaceElevated,
  },
  notice: {
    marginTop: space.sm,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(245,158,11,0.3)",
    backgroundColor: "rgba(245,158,11,0.1)",
    padding: space.sm,
  },
  noticeInactive: {
    borderColor: color.border,
    backgroundColor: color.surface,
  },
  noticeText: { textAlign: "center", lineHeight: 17 },
});
