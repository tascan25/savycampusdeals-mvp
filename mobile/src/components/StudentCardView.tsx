import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Image,
  PanResponder,
  StyleSheet,
  View,
} from "react-native";

import { AppText } from "@/design-system/components";
import { radius, space } from "@/design-system/tokens";
import type { StudentCard } from "@/types/verification";

export function StudentCardView({ card }: { card: StudentCard }) {
  const [reduceMotion, setReduceMotion] = useState(false);
  const [entry] = useState(() => new Animated.Value(0));
  const [float] = useState(() => new Animated.Value(0));
  const [aura] = useState(() => new Animated.Value(0));
  const [shimmer] = useState(() => new Animated.Value(0));
  const [pressed] = useState(() => new Animated.Value(0));
  const [tilt] = useState(() => new Animated.ValueXY({ x: 0, y: 0 }));
  const expiryLabel = card.expiry
    ? new Date(card.expiry).toLocaleDateString("en-IN", { month: "short", year: "numeric" })
    : "—";

  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (active) setReduceMotion(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      entry.setValue(1);
      float.setValue(0);
      aura.setValue(0.5);
      shimmer.setValue(0);
      return;
    }

    const entrance = Animated.spring(entry, {
      toValue: 1,
      damping: 17,
      stiffness: 105,
      mass: 0.85,
      useNativeDriver: true,
    });
    const floating = Animated.loop(
      Animated.sequence([
        Animated.timing(float, {
          toValue: 1,
          duration: 2_800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(float, {
          toValue: 0,
          duration: 2_800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    const auraPulse = Animated.loop(
      Animated.sequence([
        Animated.timing(aura, {
          toValue: 1,
          duration: 2_400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(aura, {
          toValue: 0,
          duration: 2_400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    const lightSweep = Animated.loop(
      Animated.sequence([
        Animated.delay(900),
        Animated.timing(shimmer, {
          toValue: 1,
          duration: 1_650,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.delay(1_900),
        Animated.timing(shimmer, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );

    entrance.start();
    floating.start();
    auraPulse.start();
    lightSweep.start();
    return () => {
      entrance.stop();
      floating.stop();
      auraPulse.stop();
      lightSweep.stop();
    };
  }, [aura, entry, float, reduceMotion, shimmer]);

  const settleCard = useCallback(() => {
    Animated.parallel([
      Animated.spring(tilt, {
        toValue: { x: 0, y: 0 },
        damping: 16,
        stiffness: 170,
        mass: 0.7,
        useNativeDriver: true,
      }),
      Animated.spring(pressed, {
        toValue: 0,
        damping: 16,
        stiffness: 180,
        useNativeDriver: true,
      }),
    ]).start();
  }, [pressed, tilt]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          !reduceMotion && Math.abs(gesture.dx) > 6 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
        onPanResponderGrant: () => {
          Animated.spring(pressed, {
            toValue: 1,
            damping: 17,
            stiffness: 190,
            useNativeDriver: true,
          }).start();
        },
        onPanResponderMove: (_, gesture) => {
          tilt.setValue({
            x: Math.max(-65, Math.min(65, gesture.dx)),
            y: Math.max(-45, Math.min(45, gesture.dy)),
          });
        },
        onPanResponderRelease: settleCard,
        onPanResponderTerminate: settleCard,
      }),
    [pressed, reduceMotion, settleCard, tilt],
  );

  const rotateY = tilt.x.interpolate({
    inputRange: [-65, 65],
    outputRange: ["-8deg", "8deg"],
    extrapolate: "clamp",
  });
  const rotateX = tilt.y.interpolate({
    inputRange: [-45, 45],
    outputRange: ["7deg", "-7deg"],
    extrapolate: "clamp",
  });
  const touchLightX = tilt.x.interpolate({
    inputRange: [-65, 65],
    outputRange: [-72, 72],
    extrapolate: "clamp",
  });
  const touchLightY = tilt.y.interpolate({
    inputRange: [-45, 45],
    outputRange: [-42, 42],
    extrapolate: "clamp",
  });

  return (
    <View style={styles.stage}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.ambientGlowWide,
          {
            opacity: aura.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.52] }),
            transform: [
              { scale: aura.interpolate({ inputRange: [0, 1], outputRange: [0.93, 1.07] }) },
            ],
          },
        ]}
      />
      <Animated.View
        pointerEvents="none"
        style={[
          styles.ambientGlowCore,
          {
            opacity: aura.interpolate({ inputRange: [0, 1], outputRange: [0.28, 0.46] }),
            transform: [
              { scale: aura.interpolate({ inputRange: [0, 1], outputRange: [1.04, 0.96] }) },
            ],
          },
        ]}
      />

      <Animated.View
        {...panResponder.panHandlers}
        style={[
          styles.motionCard,
          {
            opacity: entry,
            transform: [
              { perspective: 1_200 },
              {
                translateY: entry.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }),
              },
              {
                translateY: float.interpolate({ inputRange: [0, 1], outputRange: [2, -4] }),
              },
              { rotateX },
              { rotateY },
              {
                scale: Animated.multiply(
                  entry.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }),
                  pressed.interpolate({ inputRange: [0, 1], outputRange: [1, 1.015] }),
                ),
              },
            ],
          },
        ]}
      >
        <LinearGradient
          colors={["#137C79", "#075565", "#073747", "#0B2837"]}
          locations={[0, 0.43, 0.72, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.card}
          testID="student-card"
        >
          <View style={styles.innerBorder} />
          <View style={styles.glow} />
          <View style={styles.bottomGlow} />
          <View style={styles.orbitLarge} />
          <View style={styles.orbitMedium} />
          <View style={styles.orbitSmall} />
          <AppText style={styles.watermark}>S</AppText>
          {[24, 49, 74].map((left) => (
            <View key={`v-${left}`} style={[styles.gridVertical, { left: `${left}%` }]} />
          ))}
          {[33, 66].map((top) => (
            <View key={`h-${top}`} style={[styles.gridHorizontal, { top: `${top}%` }]} />
          ))}
          <Animated.View
            pointerEvents="none"
            style={[
              styles.touchLight,
              { transform: [{ translateX: touchLightX }, { translateY: touchLightY }] },
            ]}
          />
          <Animated.View
            pointerEvents="none"
            style={[
              styles.shimmer,
              {
                transform: [
                  {
                    translateX: shimmer.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-210, 500],
                    }),
                  },
                  { rotate: "18deg" },
                ],
              },
            ]}
          />

          <View style={styles.headerRow}>
            <View style={styles.brandRow}>
              <View style={styles.brandMark}>
                <AppText style={styles.brandLetter}>S</AppText>
              </View>
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
              <LinearGradient
                colors={["#99F6E4", "rgba(103,232,249,0)"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.accentLine}
              />
              <AppText style={styles.fieldLabel}>MEMBER</AppText>
              <AppText
                style={styles.memberName}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.72}
                testID="student-card-name"
              >
                {card.name}
              </AppText>
              <AppText style={styles.college} numberOfLines={1} testID="student-card-college">
                {card.college || "—"}
              </AppText>
            </View>
            <View style={styles.qrWrap}>
              {card.qr_data_uri ? (
                <Image
                  source={{ uri: card.qr_data_uri }}
                  style={styles.qr}
                  resizeMode="contain"
                  testID="student-card-qr"
                />
              ) : (
                <Ionicons name="qr-code" size={52} color="#052E2B" />
              )}
            </View>
          </View>

          <View style={styles.footerRow}>
            <View style={styles.footerField}>
              <AppText style={styles.fieldLabel}>MEMBER ID</AppText>
              <AppText style={styles.memberNumber} numberOfLines={1} testID="student-card-number">
                {card.student_number}
              </AppText>
            </View>
            <View style={[styles.footerField, styles.footerRight]}>
              <AppText style={styles.fieldLabel}>VALID THROUGH</AppText>
              <AppText style={styles.footerValue} testID="student-card-expiry">
                {expiryLabel}
              </AppText>
            </View>
          </View>
        </LinearGradient>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    width: "100%",
    paddingVertical: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  ambientGlowWide: {
    position: "absolute",
    left: "2%",
    right: "2%",
    top: "6%",
    bottom: "6%",
    borderRadius: 999,
    backgroundColor: "rgba(20,184,166,0.22)",
    shadowColor: "#14B8A6",
    shadowOpacity: 0.75,
    shadowRadius: 48,
    shadowOffset: { width: 0, height: 8 },
  },
  ambientGlowCore: {
    position: "absolute",
    left: "17%",
    right: "17%",
    top: "19%",
    bottom: "19%",
    borderRadius: 999,
    backgroundColor: "rgba(34,211,238,0.19)",
    shadowColor: "#22D3EE",
    shadowOpacity: 0.5,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 2 },
  },
  motionCard: { width: "100%" },
  card: {
    aspectRatio: 1.586,
    borderRadius: 26,
    borderCurve: "continuous",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(204,251,241,0.30)",
    padding: space.lg,
    justifyContent: "space-between",
    overflow: "hidden",
    shadowColor: "#14B8A6",
    shadowOpacity: 0.3,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 14 },
    elevation: 7,
  },
  innerBorder: {
    position: "absolute",
    top: 1,
    right: 1,
    bottom: 1,
    left: 1,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: "rgba(204,251,241,0.14)",
    zIndex: 4,
  },
  glow: {
    position: "absolute",
    right: -90,
    top: -105,
    width: 270,
    height: 270,
    borderRadius: 135,
    backgroundColor: "rgba(45,212,191,0.22)",
  },
  bottomGlow: {
    position: "absolute",
    left: -90,
    bottom: -115,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: "rgba(34,211,238,0.11)",
  },
  orbitLarge: {
    position: "absolute",
    right: -61,
    top: -108,
    width: 224,
    height: 224,
    borderRadius: 112,
    borderWidth: 1,
    borderColor: "rgba(204,251,241,0.14)",
  },
  orbitMedium: {
    position: "absolute",
    right: -37,
    top: -84,
    width: 176,
    height: 176,
    borderRadius: 88,
    borderWidth: 24,
    borderColor: "rgba(204,251,241,0.022)",
  },
  orbitSmall: {
    position: "absolute",
    right: 0,
    top: -13,
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 1,
    borderColor: "rgba(204,251,241,0.08)",
  },
  watermark: {
    position: "absolute",
    right: -11,
    top: -30,
    fontSize: 175,
    lineHeight: 190,
    fontWeight: "900",
    color: "rgba(240,253,250,0.035)",
    letterSpacing: -15,
  },
  gridVertical: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(204,251,241,0.035)",
  },
  gridHorizontal: {
    position: "absolute",
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(204,251,241,0.035)",
  },
  touchLight: {
    position: "absolute",
    zIndex: 2,
    left: "30%",
    top: -68,
    width: 210,
    height: 210,
    borderRadius: 105,
    backgroundColor: "rgba(204,251,241,0.085)",
  },
  shimmer: {
    position: "absolute",
    zIndex: 3,
    top: -95,
    bottom: -95,
    width: 92,
    backgroundColor: "rgba(255,255,255,0.075)",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    zIndex: 1,
  },
  brandRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  brandMark: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.96)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.85)",
  },
  brandLetter: {
    fontSize: 16,
    lineHeight: 19,
    fontStyle: "italic",
    fontWeight: "900",
    color: "#064E4B",
  },
  brandName: {
    fontSize: 9,
    lineHeight: 12,
    fontWeight: "900",
    letterSpacing: 2.1,
    color: "rgba(240,253,250,0.94)",
  },
  brandSub: {
    marginTop: 1,
    fontSize: 7,
    lineHeight: 9,
    fontWeight: "700",
    letterSpacing: 1.45,
    color: "rgba(204,251,241,0.45)",
  },
  verifiedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: "rgba(241,255,251,0.96)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.8)",
  },
  verifiedLabel: { fontSize: 10, lineHeight: 13, fontWeight: "800", color: "#063F3C" },
  bodyRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    zIndex: 1,
  },
  identity: { flex: 1, paddingRight: space.md },
  accentLine: { width: 44, height: 2, marginBottom: 9 },
  fieldLabel: {
    fontSize: 7,
    lineHeight: 9,
    fontWeight: "800",
    letterSpacing: 1.75,
    color: "rgba(204,251,241,0.46)",
  },
  memberName: {
    marginTop: 4,
    fontSize: 21,
    lineHeight: 24,
    fontWeight: "900",
    letterSpacing: -0.5,
    color: "#FFFFFF",
  },
  college: {
    marginTop: 6,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "600",
    color: "rgba(204,251,241,0.72)",
  },
  qrWrap: {
    width: 78,
    height: 78,
    padding: 6,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.55)",
    backgroundColor: "#FFFFFF",
    shadowColor: "#000000",
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  qr: { width: "100%", height: "100%" },
  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 9,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(204,251,241,0.16)",
    zIndex: 1,
  },
  footerField: { maxWidth: "64%" },
  memberNumber: {
    marginTop: 2,
    fontSize: 9,
    lineHeight: 12,
    fontWeight: "800",
    letterSpacing: 0.8,
    color: "rgba(240,253,250,0.88)",
    fontVariant: ["tabular-nums"],
  },
  footerRight: { alignItems: "flex-end" },
  footerValue: {
    marginTop: 2,
    fontSize: 9,
    lineHeight: 12,
    fontWeight: "800",
    color: "rgba(240,253,250,0.88)",
  },
});
