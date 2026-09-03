import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, View } from "react-native";

import { AppText } from "@/design-system/components";
import { radius, space } from "@/design-system/tokens";

export function CampusIconCardPreview({
  unlocked,
  threshold,
}: {
  unlocked: boolean;
  threshold: number;
}) {
  const thresholdLabel =
    threshold >= 1000 && threshold % 1000 === 0
      ? `${threshold / 1000}K`
      : threshold.toLocaleString("en-IN");

  return (
    <View
      style={styles.container}
      accessibilityLabel={`Campus Icon card ${unlocked ? "unlocked" : "preview"}`}
    >
      <View style={styles.headingRow}>
        <View style={styles.headingCopy}>
          <AppText variant="caption" color="#FCD34D" style={styles.eyebrow}>
            THE FINAL FORM
          </AppText>
          <AppText variant="small" color="#D4D4D8">
            Your Campus Icon edition
          </AppText>
        </View>
        <View style={styles.previewBadge}>
          <AppText variant="caption" color="#FDE68A" style={styles.previewBadgeText}>
            {unlocked ? "UNLOCKED" : "PREVIEW"}
          </AppText>
        </View>
      </View>

      <LinearGradient
        colors={["#FFF2A1", "#7D5010", "#F6CE63"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.goldFrame}
      >
        <LinearGradient
          colors={["#090806", "#211707", "#070604"]}
          locations={[0.04, 0.46, 0.78]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.card}
        >
          <View style={styles.goldGlow} />
          <View style={styles.largeRing} />
          <View style={styles.smallRing} />
          <LinearGradient
            colors={["transparent", "rgba(255,224,130,0.08)", "transparent"]}
            start={{ x: 0, y: 1 }}
            end={{ x: 1, y: 0 }}
            style={styles.sheen}
          />

          <View style={styles.cardContent}>
            <View style={styles.brandRow}>
              <View style={styles.brandLockup}>
                <LinearGradient colors={["#FFE991", "#BD7D16", "#6C4008"]} style={styles.crownTile}>
                  <Ionicons name="ribbon" size={18} color="#150D02" />
                </LinearGradient>
                <View>
                  <AppText style={styles.brandName}>SAVVY CAMPUS</AppText>
                  <AppText style={styles.society}>ICON SOCIETY</AppText>
                </View>
              </View>
              <Ionicons name="diamond" size={18} color="rgba(253,230,138,0.72)" />
            </View>

            <View>
              <View style={styles.statusRow}>
                <View style={styles.statusCopy}>
                  <AppText style={styles.ultimate}>ULTIMATE STATUS</AppText>
                  <AppText style={styles.iconTitle}>CAMPUS ICON</AppText>
                </View>
                <View style={styles.clubWrap}>
                  <AppText style={styles.clubValue}>{thresholdLabel}</AppText>
                  <AppText style={styles.clubLabel}>CLUB</AppText>
                </View>
              </View>

              <View style={styles.cardFooter}>
                <AppText style={styles.tagline}>EARNED. RARE. RECOGNISED.</AppText>
                <View style={[styles.lockBadge, unlocked && styles.unlockedBadge]}>
                  <Ionicons
                    name={unlocked ? "checkmark" : "lock-closed"}
                    size={9}
                    color={unlocked ? "#A7F3D0" : "rgba(254,243,199,0.8)"}
                  />
                  <AppText style={[styles.lockLabel, unlocked && styles.unlockedLabel]}>
                    {unlocked ? "ICON STATUS" : `${threshold.toLocaleString("en-IN")} POINTS`}
                  </AppText>
                </View>
              </View>
            </View>
          </View>
        </LinearGradient>
      </LinearGradient>

      <AppText variant="caption" color="#71717A" style={styles.supportingCopy}>
        {unlocked
          ? "You made it. Your Campus Icon identity is now unlocked."
          : `Reach ${threshold.toLocaleString("en-IN")} lifetime Savvy Points to unlock Icon status.`}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12 },
  headingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.md,
  },
  headingCopy: { flex: 1, gap: 3 },
  eyebrow: { fontSize: 10, fontWeight: "800", letterSpacing: 2 },
  previewBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(253,230,138,0.18)",
    backgroundColor: "rgba(253,230,138,0.07)",
  },
  previewBadgeText: { fontSize: 9, fontWeight: "800", letterSpacing: 1.2 },
  goldFrame: {
    aspectRatio: 1.586,
    width: "100%",
    padding: 1,
    borderRadius: 26,
  },
  card: {
    flex: 1,
    borderRadius: 25,
    padding: 20,
    overflow: "hidden",
  },
  goldGlow: {
    position: "absolute",
    width: 155,
    height: 155,
    borderRadius: 78,
    top: -80,
    right: -35,
    backgroundColor: "rgba(255,224,130,0.13)",
  },
  largeRing: {
    position: "absolute",
    width: 145,
    height: 145,
    borderRadius: 73,
    right: -44,
    top: -50,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(253,230,138,0.11)",
  },
  smallRing: {
    position: "absolute",
    width: 86,
    height: 86,
    borderRadius: 43,
    right: -8,
    top: 28,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(253,230,138,0.08)",
  },
  sheen: {
    position: "absolute",
    width: 54,
    top: -30,
    bottom: -30,
    left: "42%",
    transform: [{ rotate: "12deg" }],
  },
  cardContent: { flex: 1, justifyContent: "space-between" },
  brandRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: space.sm,
  },
  brandLockup: { flexDirection: "row", alignItems: "center", gap: 10 },
  crownTile: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,249,196,0.35)",
  },
  brandName: {
    color: "#FFF8DC",
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "900",
    letterSpacing: 1.6,
  },
  society: {
    marginTop: 2,
    color: "rgba(252,211,77,0.58)",
    fontSize: 7,
    lineHeight: 10,
    fontWeight: "800",
    letterSpacing: 2,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: space.md,
  },
  statusCopy: { flex: 1 },
  ultimate: {
    color: "rgba(252,211,77,0.58)",
    fontSize: 7,
    lineHeight: 10,
    fontWeight: "800",
    letterSpacing: 2.2,
  },
  iconTitle: {
    marginTop: 2,
    color: "#F6D469",
    fontSize: 25,
    lineHeight: 29,
    fontWeight: "900",
    letterSpacing: -0.8,
  },
  clubWrap: { alignItems: "flex-end" },
  clubValue: { color: "#FEF3C7", fontSize: 23, lineHeight: 26, fontWeight: "900" },
  clubLabel: {
    marginTop: 1,
    color: "rgba(252,211,77,0.58)",
    fontSize: 7,
    fontWeight: "800",
    letterSpacing: 1.6,
  },
  cardFooter: {
    marginTop: 12,
    paddingTop: 11,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(253,230,138,0.12)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.sm,
  },
  tagline: {
    flex: 1,
    color: "rgba(255,251,235,0.54)",
    fontSize: 7,
    lineHeight: 10,
    fontWeight: "800",
    letterSpacing: 1.1,
  },
  lockBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(253,230,138,0.18)",
    backgroundColor: "rgba(0,0,0,0.24)",
  },
  unlockedBadge: {
    borderColor: "rgba(110,231,183,0.25)",
    backgroundColor: "rgba(16,185,129,0.1)",
  },
  lockLabel: {
    color: "rgba(254,243,199,0.78)",
    fontSize: 7,
    fontWeight: "800",
    letterSpacing: 0.7,
  },
  unlockedLabel: { color: "#A7F3D0" },
  supportingCopy: { textAlign: "center", lineHeight: 17, paddingHorizontal: space.sm },
});
