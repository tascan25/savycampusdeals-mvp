import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useState, type PropsWithChildren, type ReactNode } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";

import { AppText, Screen } from "@/design-system/components";
import { color, space } from "@/design-system/tokens";

type AuthScaffoldProps = PropsWithChildren<{
  eyebrow: string;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  step?: number;
  onBack?: () => void;
  footer?: ReactNode;
  variant?: "compact" | "hero";
}>;

function HeroArtwork({ icon }: { icon: keyof typeof Ionicons.glyphMap }) {
  return (
    <View style={styles.artwork} pointerEvents="none" accessibilityElementsHidden>
      <View style={styles.orbit} />
      <LinearGradient colors={["#7C3AED", "#4F46E5"]} style={styles.heroPin}>
        <View style={styles.heroPinInner}>
          <Ionicons name={icon} size={34} color="#FFFFFF" />
        </View>
      </LinearGradient>
      <LinearGradient
        colors={["#312E81", "#7C3AED"]}
        style={[styles.floatingDeal, styles.floatingDealLeft]}
      >
        <Ionicons name="fast-food-outline" size={19} color="#FFFFFF" />
      </LinearGradient>
      <LinearGradient
        colors={["#4F46E5", "#9333EA"]}
        style={[styles.floatingDeal, styles.floatingDealRight]}
      >
        <Ionicons name="pricetag-outline" size={19} color="#FFFFFF" />
      </LinearGradient>
      <View style={styles.sparkleOne} />
      <View style={styles.sparkleTwo} />
    </View>
  );
}

export function AuthScaffold({
  eyebrow,
  title,
  subtitle,
  icon,
  step,
  onBack,
  footer,
  variant = "compact",
  children,
}: AuthScaffoldProps) {
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const showHero = variant === "hero";

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const showSubscription = Keyboard.addListener(showEvent, () => setKeyboardVisible(true));
    const hideSubscription = Keyboard.addListener(hideEvent, () => setKeyboardVisible(false));
    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  return (
    <Screen>
      <View pointerEvents="none" style={styles.ambientOne} />
      <View pointerEvents="none" style={styles.ambientTwo} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={[styles.content, showHero && styles.heroContent]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <View style={[styles.topRow, showHero && styles.heroTopRow]}>
            {onBack ? (
              <Pressable
                onPress={onBack}
                accessibilityRole="button"
                accessibilityLabel="Go back"
                style={styles.backButton}
              >
                <Ionicons name="arrow-back" size={20} color={color.textPrimary} />
              </Pressable>
            ) : (
              <View style={styles.topSpacer} />
            )}
            <View
              style={styles.brandLockup}
              accessibilityRole="header"
              accessibilityLabel="Savvy Campus Deals"
            >
              <AppText style={styles.brandName}>SAVVY</AppText>
              <View style={styles.brandDot} />
            </View>
            <View style={styles.topSpacer} />
          </View>

          {showHero && !keyboardVisible ? (
            <View style={styles.hero}>
              <View style={styles.promise}>
                <AppText style={styles.promiseLead}>Every student deserves</AppText>
                <AppText style={styles.promiseAccent}>more.</AppText>
              </View>
              <HeroArtwork icon={icon} />
            </View>
          ) : null}

          <View
            style={[
              styles.sheet,
              !showHero && styles.compactSheet,
              keyboardVisible && showHero && styles.keyboardSheet,
            ]}
          >
            {step ? (
              <View style={styles.steps} accessibilityLabel={`Step ${step} of 3`}>
                {[1, 2, 3].map((item) => (
                  <View key={item} style={[styles.step, item <= step && styles.stepActive]} />
                ))}
              </View>
            ) : null}

            {!showHero ? (
              <LinearGradient colors={["#4F46E5", "#7C3AED"]} style={styles.iconWrap}>
                <Ionicons name={icon} size={23} color="#FFFFFF" />
              </LinearGradient>
            ) : null}

            <View style={styles.intro}>
              <AppText variant="caption" color="#A5B4FC" style={styles.eyebrow}>
                {eyebrow}
              </AppText>
              <AppText style={[styles.title, showHero && styles.heroTitle]}>{title}</AppText>
              <AppText variant="body" color={color.textSecondary} style={styles.subtitle}>
                {subtitle}
              </AppText>
            </View>

            <View style={styles.panel}>{children}</View>
            {footer ? <View style={styles.footer}>{footer}</View> : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    flexGrow: 1,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    paddingBottom: space.xxl,
  },
  heroContent: { paddingHorizontal: 0, paddingTop: 0, paddingBottom: 0 },
  ambientOne: {
    position: "absolute",
    width: 300,
    height: 300,
    borderRadius: 150,
    top: -170,
    right: -95,
    backgroundColor: "rgba(79,70,229,0.20)",
  },
  ambientTwo: {
    position: "absolute",
    width: 240,
    height: 240,
    borderRadius: 120,
    bottom: -140,
    left: -110,
    backgroundColor: "rgba(124,58,237,0.11)",
  },
  topRow: {
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  heroTopRow: { paddingHorizontal: space.lg, paddingTop: space.sm },
  topSpacer: { width: 42 },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.borderStrong,
  },
  brandLockup: { flexDirection: "row", alignItems: "center" },
  brandName: { fontSize: 19, lineHeight: 23, fontWeight: "900", letterSpacing: 3.6 },
  brandDot: {
    width: 6,
    height: 6,
    marginLeft: 1,
    marginTop: 7,
    borderRadius: 3,
    backgroundColor: "#8B5CF6",
  },
  hero: {
    minHeight: 310,
    paddingTop: space.md,
    alignItems: "center",
    justifyContent: "space-between",
    overflow: "hidden",
  },
  promise: { alignItems: "center", zIndex: 2 },
  promiseLead: { fontSize: 20, lineHeight: 25, fontWeight: "600", letterSpacing: -0.35 },
  promiseAccent: {
    marginTop: -2,
    fontSize: 34,
    lineHeight: 39,
    fontWeight: "900",
    fontStyle: "italic",
    letterSpacing: -1.2,
    color: "#A78BFA",
  },
  artwork: { width: "100%", height: 210, alignItems: "center", justifyContent: "center" },
  orbit: {
    position: "absolute",
    bottom: 17,
    width: 280,
    height: 74,
    borderRadius: 140,
    borderWidth: 1,
    borderColor: "rgba(167,139,250,0.30)",
    transform: [{ scaleY: 0.35 }],
  },
  heroPin: {
    width: 112,
    height: 142,
    borderTopLeftRadius: 58,
    borderTopRightRadius: 58,
    borderBottomRightRadius: 58,
    transform: [{ rotate: "45deg" }],
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#8B5CF6",
    shadowOpacity: 0.7,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  heroPinInner: {
    width: 66,
    height: 66,
    borderRadius: 33,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
    transform: [{ rotate: "-45deg" }],
  },
  floatingDeal: {
    position: "absolute",
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.20)",
    shadowColor: "#7C3AED",
    shadowOpacity: 0.45,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 },
    elevation: 6,
  },
  floatingDealLeft: { left: "18%", top: 92 },
  floatingDealRight: { right: "17%", top: 54 },
  sparkleOne: {
    position: "absolute",
    width: 5,
    height: 5,
    borderRadius: 3,
    left: "27%",
    top: 50,
    backgroundColor: "#C4B5FD",
  },
  sparkleTwo: {
    position: "absolute",
    width: 4,
    height: 4,
    borderRadius: 2,
    right: "29%",
    top: 135,
    backgroundColor: "#818CF8",
  },
  sheet: {
    flex: 1,
    paddingHorizontal: space.lg,
    paddingTop: space.xl,
    paddingBottom: space.xxl,
    borderTopLeftRadius: 34,
    borderTopRightRadius: 34,
    backgroundColor: "#09090C",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: color.borderStrong,
  },
  compactSheet: {
    marginTop: space.xl,
    paddingHorizontal: 0,
    paddingTop: 0,
    borderRadius: 0,
    backgroundColor: "transparent",
    borderTopWidth: 0,
  },
  keyboardSheet: { minHeight: 520, marginTop: space.md },
  steps: { marginBottom: space.lg, flexDirection: "row", gap: space.sm },
  step: { flex: 1, height: 3, borderRadius: 2, backgroundColor: color.surfaceElevated },
  stepActive: { backgroundColor: "#7C6CFF" },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#6D5CF6",
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
  },
  intro: { gap: space.xs },
  eyebrow: { letterSpacing: 1.7, fontWeight: "800" },
  title: { fontSize: 35, lineHeight: 41, fontWeight: "800", letterSpacing: -1 },
  heroTitle: { fontSize: 29, lineHeight: 35 },
  subtitle: { maxWidth: 360, lineHeight: 23 },
  panel: { marginTop: space.lg, gap: space.md },
  footer: { marginTop: space.lg, alignItems: "center" },
});
