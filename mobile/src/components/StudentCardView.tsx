import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Image, StyleSheet, View } from "react-native";

import { AppText } from "@/design-system/components";
import { radius, space } from "@/design-system/tokens";
import type { StudentCard } from "@/types/verification";

export function StudentCardView({ card }: { card: StudentCard }) {
  const expiryLabel = card.expiry
    ? new Date(card.expiry).toLocaleDateString("en-IN", { month: "short", year: "numeric" })
    : "—";

  return (
    <LinearGradient
      colors={["#0B595D", "#073D45", "#061D27"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.card}
      testID="student-card"
    >
      <View style={styles.glow} />
      <View style={styles.orbitLarge} />
      <View style={styles.orbitSmall} />
      <AppText style={styles.watermark}>S</AppText>
      {[24, 49, 74].map((left) => <View key={`v-${left}`} style={[styles.gridVertical, { left: `${left}%` }]} />)}
      {[33, 66].map((top) => <View key={`h-${top}`} style={[styles.gridHorizontal, { top: `${top}%` }]} />)}

      <View style={styles.headerRow}>
        <View style={styles.brandRow}>
          <View style={styles.brandMark}><AppText style={styles.brandLetter}>S</AppText></View>
          <View>
            <AppText style={styles.brandName}>SAVVY CAMPUS</AppText>
            <AppText style={styles.brandSub}>STUDENT MEMBERSHIP</AppText>
          </View>
        </View>
        <View style={styles.verifiedBadge} testID="student-card-verified-badge">
          <Ionicons name="shield-checkmark" size={13} color="#063F3C" />
          <AppText style={styles.verifiedLabel}>Verified</AppText>
        </View>
      </View>

      <View style={styles.bodyRow}>
        <View style={styles.identity}>
          <LinearGradient colors={["#99F6E4", "rgba(103,232,249,0)"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.accentLine} />
          <AppText style={styles.fieldLabel}>MEMBER</AppText>
          <AppText style={styles.memberName} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72} testID="student-card-name">{card.name}</AppText>
          <AppText style={styles.college} numberOfLines={1} testID="student-card-college">{card.college || "—"}</AppText>
        </View>
        <View style={styles.qrWrap}>
          {card.qr_data_uri ? <Image source={{ uri: card.qr_data_uri }} style={styles.qr} resizeMode="contain" testID="student-card-qr" /> : <Ionicons name="qr-code" size={52} color="#052E2B" />}
        </View>
      </View>

      <View style={styles.footerRow}>
        <View style={styles.footerField}>
          <AppText style={styles.fieldLabel}>MEMBER ID</AppText>
          <AppText style={styles.memberNumber} numberOfLines={1} testID="student-card-number">{card.student_number}</AppText>
        </View>
        <View style={[styles.footerField, styles.footerRight]}>
          <AppText style={styles.fieldLabel}>VALID THROUGH</AppText>
          <AppText style={styles.footerValue} testID="student-card-expiry">{expiryLabel}</AppText>
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: { aspectRatio: 1.586, borderRadius: 26, borderCurve: "continuous", borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(204,251,241,0.30)", padding: space.lg, justifyContent: "space-between", overflow: "hidden", shadowColor: "#14B8A6", shadowOpacity: 0.30, shadowRadius: 30, shadowOffset: { width: 0, height: 14 }, elevation: 7 },
  glow: { position: "absolute", right: -80, top: -85, width: 230, height: 230, borderRadius: 115, backgroundColor: "rgba(94,234,212,0.13)" },
  orbitLarge: { position: "absolute", right: -47, top: -62, width: 190, height: 190, borderRadius: 95, borderWidth: 1, borderColor: "rgba(204,251,241,0.10)" },
  orbitSmall: { position: "absolute", right: 0, top: -13, width: 96, height: 96, borderRadius: 48, borderWidth: 1, borderColor: "rgba(204,251,241,0.08)" },
  watermark: { position: "absolute", right: -11, top: -30, fontSize: 175, lineHeight: 190, fontWeight: "900", color: "rgba(240,253,250,0.035)", letterSpacing: -15 },
  gridVertical: { position: "absolute", top: 0, bottom: 0, width: StyleSheet.hairlineWidth, backgroundColor: "rgba(204,251,241,0.035)" },
  gridHorizontal: { position: "absolute", left: 0, right: 0, height: StyleSheet.hairlineWidth, backgroundColor: "rgba(204,251,241,0.035)" },
  headerRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", zIndex: 1 },
  brandRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  brandMark: { width: 30, height: 30, borderRadius: 9, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.96)", borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(255,255,255,0.85)" },
  brandLetter: { fontSize: 16, lineHeight: 19, fontStyle: "italic", fontWeight: "900", color: "#064E4B" },
  brandName: { fontSize: 9, lineHeight: 12, fontWeight: "900", letterSpacing: 2.1, color: "rgba(240,253,250,0.94)" },
  brandSub: { marginTop: 1, fontSize: 7, lineHeight: 9, fontWeight: "700", letterSpacing: 1.45, color: "rgba(204,251,241,0.45)" },
  verifiedBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 9, paddingVertical: 5, borderRadius: radius.pill, backgroundColor: "rgba(241,255,251,0.96)", borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(255,255,255,0.8)" },
  verifiedLabel: { fontSize: 10, lineHeight: 13, fontWeight: "800", color: "#063F3C" },
  bodyRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", zIndex: 1 },
  identity: { flex: 1, paddingRight: space.md },
  accentLine: { width: 44, height: 2, marginBottom: 9 },
  fieldLabel: { fontSize: 7, lineHeight: 9, fontWeight: "800", letterSpacing: 1.75, color: "rgba(204,251,241,0.46)" },
  memberName: { marginTop: 4, fontSize: 21, lineHeight: 24, fontWeight: "900", letterSpacing: -0.5, color: "#FFFFFF" },
  college: { marginTop: 6, fontSize: 11, lineHeight: 14, fontWeight: "600", color: "rgba(204,251,241,0.72)" },
  qrWrap: { width: 78, height: 78, padding: 6, borderRadius: 14, alignItems: "center", justifyContent: "center", borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(255,255,255,0.55)", backgroundColor: "#FFFFFF", shadowColor: "#000000", shadowOpacity: 0.35, shadowRadius: 16, shadowOffset: { width: 0, height: 8 } },
  qr: { width: "100%", height: "100%" },
  footerRow: { flexDirection: "row", justifyContent: "space-between", paddingTop: 9, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "rgba(204,251,241,0.16)", zIndex: 1 },
  footerField: { maxWidth: "64%" },
  memberNumber: { marginTop: 2, fontSize: 9, lineHeight: 12, fontWeight: "800", letterSpacing: 0.8, color: "rgba(240,253,250,0.88)", fontVariant: ["tabular-nums"] },
  footerRight: { alignItems: "flex-end" },
  footerValue: { marginTop: 2, fontSize: 9, lineHeight: 12, fontWeight: "800", color: "rgba(240,253,250,0.88)" },
});
