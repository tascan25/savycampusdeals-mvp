import { Ionicons } from "@expo/vector-icons";
import { forwardRef, useState, type PropsWithChildren } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";

import { color, minTouchTarget, radius, space, type } from "./tokens";

export function Screen({
  children,
  edges = ["top", "bottom"],
  style,
}: PropsWithChildren<{ edges?: Edge[]; style?: StyleProp<ViewStyle> }>) {
  return (
    <SafeAreaView edges={edges} style={[styles.screen, style]}>
      {children}
    </SafeAreaView>
  );
}

type TextVariant = keyof typeof type;

export function AppText({
  variant = "body",
  color: textColor = color.textPrimary,
  style,
  children,
  ...rest
}: PropsWithChildren<
  Omit<TextProps, "style" | "color"> & {
    variant?: TextVariant;
    color?: string;
    style?: StyleProp<TextStyle>;
  }
>) {
  return (
    <Text allowFontScaling style={[type[variant], { color: textColor }, style]} {...rest}>
      {children}
    </Text>
  );
}

type ButtonVariant = "primary" | "secondary" | "destructive";

export function Button({
  label,
  onPress,
  variant = "primary",
  disabled,
  loading,
  accessibilityHint,
}: {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  accessibilityHint?: string;
}) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      accessibilityHint={accessibilityHint}
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        buttonStyles.base,
        buttonStyles[variant],
        isDisabled && buttonStyles.disabled,
        pressed && !isDisabled && buttonStyles.pressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === "secondary" ? color.textPrimary : color.onPrimary} />
      ) : (
        <Text style={[buttonStyles.label, buttonStyles[`${variant}Label`]]}>{label}</Text>
      )}
    </Pressable>
  );
}

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.divider, style]} />;
}

type TextFieldProps = TextInputProps & {
  label: string;
  error?: string;
  secureToggle?: boolean;
};

export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  {
    label,
    error,
    secureToggle,
    secureTextEntry,
    style,
    autoCapitalize = "none",
    autoCorrect = false,
    ...rest
  },
  ref,
) {
  const [revealed, setRevealed] = useState(false);
  const [focused, setFocused] = useState(false);
  const isSecureField = Boolean(secureTextEntry);

  return (
    <View style={fieldStyles.container}>
      <Text style={fieldStyles.label}>{label}</Text>
      <View
        style={[
          fieldStyles.inputRow,
          focused && fieldStyles.inputRowFocused,
          error && fieldStyles.inputRowError,
        ]}
      >
        <TextInput
          ref={ref}
          {...rest}
          style={[fieldStyles.input, style]}
          placeholderTextColor={color.textTertiary}
          secureTextEntry={isSecureField && !revealed}
          autoCapitalize={autoCapitalize}
          autoCorrect={autoCorrect}
          allowFontScaling
          accessibilityLabel={label}
          onFocus={(event) => {
            setFocused(true);
            rest.onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            rest.onBlur?.(event);
          }}
        />
        {secureToggle && isSecureField && (
          <Pressable
            onPress={() => setRevealed((value) => !value)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={revealed ? "Hide password" : "Show password"}
            style={fieldStyles.toggle}
          >
            <Text style={fieldStyles.toggleLabel}>{revealed ? "Hide" : "Show"}</Text>
          </Pressable>
        )}
      </View>
      {error ? (
        <Text style={fieldStyles.error} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
    </View>
  );
});

export function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityState={{ selected: Boolean(active) }}
      style={({ pressed }) => [
        chipStyles.base,
        active && chipStyles.active,
        pressed && chipStyles.pressed,
      ]}
    >
      <Text style={[chipStyles.label, active && chipStyles.activeLabel]}>{label}</Text>
    </Pressable>
  );
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (next: T) => void;
}) {
  return (
    <View style={segmentStyles.container} accessibilityRole="tablist">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={[segmentStyles.segment, active && segmentStyles.segmentActive]}
          >
            <Text style={[segmentStyles.label, active && segmentStyles.labelActive]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function SearchField({
  value,
  onChangeText,
  placeholder,
  testID,
}: {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  testID?: string;
}) {
  return (
    <View style={searchStyles.container}>
      <Ionicons name="search" size={16} color={color.textTertiary} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={color.textTertiary}
        style={searchStyles.input}
        autoCapitalize="none"
        autoCorrect={false}
        allowFontScaling
        accessibilityLabel={placeholder}
        testID={testID}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: color.background,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: color.border,
  },
});

const chipStyles = StyleSheet.create({
  base: {
    minHeight: 36,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.border,
    backgroundColor: color.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  active: { backgroundColor: color.primarySoft, borderColor: "rgba(99,102,241,0.45)" },
  pressed: { opacity: 0.85 },
  label: { ...type.small, color: color.textSecondary },
  activeLabel: { color: "#C7D2FE", fontWeight: "700" },
});

const segmentStyles = StyleSheet.create({
  container: {
    flexDirection: "row",
    backgroundColor: color.surfaceMuted,
    borderRadius: radius.pill,
    padding: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.border,
  },
  segment: {
    flex: 1,
    minHeight: minTouchTarget - 8,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentActive: {
    backgroundColor: color.surfaceElevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.borderStrong,
  },
  label: { ...type.small, color: color.textSecondary, fontWeight: "600" },
  labelActive: { color: color.textPrimary },
});

const searchStyles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    minHeight: minTouchTarget,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.border,
    backgroundColor: color.surfaceMuted,
    paddingHorizontal: space.md,
  },
  input: { flex: 1, color: color.textPrimary, fontSize: 15, paddingVertical: space.sm },
});

const fieldStyles = StyleSheet.create({
  container: { gap: space.xs },
  label: {
    ...type.small,
    color: color.textSecondary,
    letterSpacing: 0.1,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: minTouchTarget,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.border,
    backgroundColor: color.surfaceMuted,
    paddingHorizontal: space.md,
  },
  input: {
    flex: 1,
    color: color.textPrimary,
    fontSize: 16,
    paddingVertical: space.sm,
  },
  inputRowError: { borderColor: color.destructive },
  inputRowFocused: {
    borderColor: color.borderFocus,
    backgroundColor: color.surfaceElevated,
  },
  toggle: { paddingLeft: space.sm, minHeight: minTouchTarget, justifyContent: "center" },
  toggleLabel: { ...type.small, color: color.primary },
  error: { ...type.caption, color: color.destructive },
});

const buttonStyles = StyleSheet.create({
  base: {
    minHeight: 52,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  primary: {
    backgroundColor: color.primary,
    shadowColor: color.primary,
    shadowOpacity: 0.22,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  secondary: {
    backgroundColor: "transparent",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.border,
  },
  destructive: { backgroundColor: color.destructive },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.85 },
  label: { fontSize: 16, fontWeight: "700" },
  primaryLabel: { color: color.onPrimary },
  secondaryLabel: { color: color.textPrimary },
  destructiveLabel: { color: color.onPrimary },
});
