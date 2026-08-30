import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import type { PropsWithChildren, ReactNode } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";

import { AppText, Screen } from "@/design-system/components";
import { color, radius, space } from "@/design-system/tokens";

export function AuthScaffold({
  eyebrow,
  title,
  subtitle,
  icon,
  step,
  onBack,
  footer,
  children,
}: PropsWithChildren<{
  eyebrow: string;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  step?: number;
  onBack?: () => void;
  footer?: ReactNode;
}>) {
  return (
    <Screen>
      <View pointerEvents="none" style={styles.ambientOne} />
      <View pointerEvents="none" style={styles.ambientTwo} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.topRow}>
            {onBack ? (
              <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel="Go back" style={styles.backButton}>
                <Ionicons name="arrow-back" size={20} color={color.textPrimary} />
              </Pressable>
            ) : <View />}
            <View style={styles.securePill}>
              <Ionicons name="lock-closed" size={11} color="#86EFAC" />
              <AppText variant="caption" color="#86EFAC">Secure access</AppText>
            </View>
          </View>

          {step ? (
            <View style={styles.steps} accessibilityLabel={`Step ${step} of 3`}>
              {[1, 2, 3].map((item) => <View key={item} style={[styles.step, item <= step && styles.stepActive]} />)}
            </View>
          ) : null}

          <LinearGradient colors={["#4F46E5", "#7C3AED"]} style={styles.iconWrap}>
            <Ionicons name={icon} size={23} color="#FFFFFF" />
          </LinearGradient>
          <View style={styles.intro}>
            <AppText variant="caption" color="#A5B4FC" style={styles.eyebrow}>{eyebrow}</AppText>
            <AppText style={styles.title}>{title}</AppText>
            <AppText variant="body" color={color.textSecondary} style={styles.subtitle}>{subtitle}</AppText>
          </View>

          <View style={styles.panel}>{children}</View>
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.xxl },
  ambientOne: { position: "absolute", width: 280, height: 280, borderRadius: 140, top: -150, right: -100, backgroundColor: "rgba(79,70,229,0.18)" },
  ambientTwo: { position: "absolute", width: 220, height: 220, borderRadius: 110, bottom: -130, left: -100, backgroundColor: "rgba(124,58,237,0.10)" },
  topRow: { minHeight: 46, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  backButton: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", backgroundColor: color.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: color.borderStrong },
  securePill: { minHeight: 30, paddingHorizontal: space.sm, flexDirection: "row", alignItems: "center", gap: 5, borderRadius: radius.pill, backgroundColor: "rgba(34,197,94,0.08)", borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(34,197,94,0.2)" },
  steps: { marginTop: space.md, flexDirection: "row", gap: space.sm },
  step: { flex: 1, height: 3, borderRadius: 2, backgroundColor: color.surfaceElevated },
  stepActive: { backgroundColor: "#7C6CFF" },
  iconWrap: { width: 48, height: 48, marginTop: space.xl, borderRadius: 16, alignItems: "center", justifyContent: "center", shadowColor: "#6D5CF6", shadowOpacity: 0.35, shadowRadius: 16, shadowOffset: { width: 0, height: 6 } },
  intro: { marginTop: space.md, gap: space.xs },
  eyebrow: { letterSpacing: 1.7, fontWeight: "800" },
  title: { fontSize: 35, lineHeight: 41, fontWeight: "800", letterSpacing: -1 },
  subtitle: { maxWidth: 360, lineHeight: 23 },
  panel: { marginTop: space.xl, padding: space.md, gap: space.md, borderRadius: radius.lg, backgroundColor: "rgba(15,15,19,0.92)", borderWidth: StyleSheet.hairlineWidth, borderColor: color.borderStrong },
  footer: { marginTop: space.lg, alignItems: "center" },
});
