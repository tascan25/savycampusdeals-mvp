import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { forwardRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";

import { AppText } from "@/design-system/components";
import { color, radius, space, type } from "@/design-system/tokens";

export function LoginBackdrop({ quiet = false }: { quiet?: boolean }) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} accessibilityElementsHidden>
      <LinearGradient
        colors={["rgba(76,29,149,0)", "rgba(109,40,217,0.34)", "rgba(76,29,149,0)"]}
        style={[styles.ray, styles.rayOne, quiet && styles.rayQuiet]}
      />
      <LinearGradient
        colors={["rgba(49,46,129,0)", "rgba(79,70,229,0.24)", "rgba(49,46,129,0)"]}
        style={[styles.ray, styles.rayTwo, quiet && styles.rayQuiet]}
      />
      <View style={[styles.glow, styles.glowTop, quiet && styles.glowQuiet]} />
      <View style={[styles.glow, styles.glowBottom, quiet && styles.glowQuiet]} />
    </View>
  );
}

export function SavvyWordmark() {
  return (
    <View
      style={styles.wordmark}
      accessibilityRole="header"
      accessibilityLabel="Savvy Campus Deals"
    >
      <LinearGradient
        pointerEvents="none"
        colors={["transparent", "rgba(124,58,237,0.36)", "transparent"]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={styles.wordmarkAuraWide}
      />
      <LinearGradient
        pointerEvents="none"
        colors={["transparent", "rgba(139,92,246,0.24)", "transparent"]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.wordmarkAuraTall}
      />
      <AppText style={styles.wordmarkSavvy}>SAVVY</AppText>
      <AppText style={styles.wordmarkCampus}>CAMPUS</AppText>
    </View>
  );
}

type LoginFieldProps = TextInputProps & {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  error?: string;
  secureToggle?: boolean;
};

export const LoginField = forwardRef<TextInput, LoginFieldProps>(function LoginField(
  {
    label,
    icon,
    error,
    secureToggle,
    secureTextEntry,
    autoCapitalize = "none",
    autoCorrect = false,
    ...rest
  },
  ref,
) {
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const isSecure = Boolean(secureTextEntry);

  return (
    <View style={styles.fieldContainer}>
      <AppText variant="small" color={color.textSecondary} style={styles.fieldLabel}>
        {label}
      </AppText>
      <View
        style={[styles.inputRow, focused && styles.inputRowFocused, error && styles.inputRowError]}
      >
        <Ionicons name={icon} size={20} color={focused ? "#A78BFA" : color.textTertiary} />
        <TextInput
          ref={ref}
          {...rest}
          secureTextEntry={isSecure && !revealed}
          autoCapitalize={autoCapitalize}
          autoCorrect={autoCorrect}
          allowFontScaling
          accessibilityLabel={label}
          placeholderTextColor={color.textTertiary}
          style={styles.input}
          onFocus={(event) => {
            setFocused(true);
            rest.onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            rest.onBlur?.(event);
          }}
        />
        {secureToggle && isSecure ? (
          <Pressable
            onPress={() => setRevealed((value) => !value)}
            accessibilityRole="button"
            accessibilityLabel={revealed ? "Hide password" : "Show password"}
            hitSlop={8}
            style={styles.secureToggle}
          >
            <AppText variant="small" color="#9B87F5" style={styles.secureToggleLabel}>
              {revealed ? "Hide" : "Show"}
            </AppText>
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <View style={styles.fieldErrorRow} accessibilityRole="alert">
          <Ionicons name="alert-circle-outline" size={14} color="#FCA5A5" />
          <AppText variant="caption" color="#FCA5A5" style={styles.fieldErrorText}>
            {error}
          </AppText>
        </View>
      ) : null}
    </View>
  );
});

export function LoginPrimaryButton({
  label,
  onPress,
  loading,
  disabled,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
}) {
  const inactive = Boolean(loading || disabled);

  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive, busy: Boolean(loading) }}
      style={({ pressed }) => [styles.buttonPressable, pressed && !inactive && styles.pressed]}
    >
      <LinearGradient
        colors={inactive ? ["#29282F", "#29282F"] : ["#A855F7", "#4F46E5"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.buttonGradient}
      >
        {loading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={[styles.buttonLabel, inactive && styles.buttonLabelInactive]}>{label}</Text>
        )}
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  ray: { position: "absolute", width: 580, height: 116, opacity: 0.72 },
  rayOne: { left: -230, top: 150, transform: [{ rotate: "-35deg" }] },
  rayTwo: { right: -255, top: 335, transform: [{ rotate: "32deg" }] },
  rayQuiet: { opacity: 0.38 },
  glow: { position: "absolute", borderRadius: 999 },
  glowTop: {
    width: 280,
    height: 280,
    right: -180,
    top: -80,
    backgroundColor: "rgba(91,33,182,0.22)",
  },
  glowBottom: {
    width: 310,
    height: 310,
    left: -230,
    bottom: -115,
    backgroundColor: "rgba(79,70,229,0.18)",
  },
  glowQuiet: { opacity: 0.58 },
  wordmark: {
    paddingHorizontal: 13,
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  wordmarkAuraWide: {
    position: "absolute",
    left: -34,
    right: -34,
    height: 54,
    opacity: 0.9,
  },
  wordmarkAuraTall: {
    position: "absolute",
    width: 190,
    top: -26,
    bottom: -26,
    opacity: 0.72,
  },
  wordmarkSavvy: {
    fontSize: 18,
    lineHeight: 23,
    fontWeight: "900",
    letterSpacing: 3.7,
    textShadowColor: "rgba(255,255,255,0.30)",
    textShadowRadius: 8,
  },
  wordmarkCampus: {
    fontSize: 18,
    lineHeight: 23,
    fontWeight: "800",
    letterSpacing: 2.3,
    color: "#A78BFA",
    textShadowColor: "rgba(139,92,246,0.90)",
    textShadowRadius: 13,
  },
  fieldContainer: { gap: space.sm },
  fieldLabel: { fontWeight: "600" },
  inputRow: {
    minHeight: 56,
    paddingHorizontal: space.md,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: color.borderStrong,
    backgroundColor: "rgba(16,16,22,0.92)",
  },
  inputRowFocused: { borderColor: "#7C6CFF", backgroundColor: "rgba(19,18,29,0.98)" },
  inputRowError: { borderColor: "rgba(239,68,68,0.72)" },
  input: { flex: 1, minHeight: 54, paddingVertical: 0, color: color.textPrimary, fontSize: 16 },
  secureToggle: { minHeight: 44, paddingLeft: space.sm, justifyContent: "center" },
  secureToggleLabel: { fontWeight: "800" },
  fieldErrorRow: { flexDirection: "row", alignItems: "flex-start", gap: 5 },
  fieldErrorText: { flex: 1 },
  buttonPressable: {
    minHeight: 56,
    borderRadius: radius.lg,
    shadowColor: "#6D4AFF",
    shadowOpacity: 0.28,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  buttonGradient: {
    minHeight: 56,
    paddingHorizontal: space.lg,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.lg,
  },
  buttonLabel: { ...type.bodyMedium, color: "#FFFFFF", fontWeight: "800" },
  buttonLabelInactive: { color: color.textTertiary },
  pressed: { opacity: 0.86 },
});
