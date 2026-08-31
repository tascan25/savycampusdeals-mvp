import { zodResolver } from "@hookform/resolvers/zod";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";

import {
  LoginBackdrop,
  LoginField,
  LoginPrimaryButton,
  SavvyWordmark,
} from "@/components/LoginChrome";
import { AppText, Screen } from "@/design-system/components";
import { color, radius, space } from "@/design-system/tokens";
import { useAuth } from "@/providers/AuthProvider";
import { loginSchema, type LoginFormValues } from "@/validation/auth";

export default function LoginPasswordScreen() {
  const { email: emailParam } = useLocalSearchParams<{ email?: string }>();
  const { login } = useAuth();
  const router = useRouter();
  const passwordInput = useRef<TextInput>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: emailParam ?? "", password: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const signedInUser = await login(values.email.trim().toLowerCase(), values.password);
      if (signedInUser.role === "student" && !signedInUser.email_verified) {
        router.replace({ pathname: "/(auth)/verify-otp", params: { email: signedInUser.email } });
      } else {
        router.replace("/(tabs)");
      }
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "We couldn't sign you in. Try again.");
    }
  });

  return (
    <Screen>
      <LoginBackdrop quiet />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <View style={styles.topRow}>
            <Pressable
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel="Back to email"
              style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
            >
              <Ionicons name="arrow-back" size={20} color={color.textPrimary} />
            </Pressable>
            <SavvyWordmark />
            <View style={styles.topSpacer} />
          </View>

          <View style={styles.main}>
            <View style={styles.intro}>
              <View
                style={styles.smileMark}
                accessibilityLabel="Smiling face"
                accessibilityRole="image"
              >
                <View pointerEvents="none" style={styles.smileAuraOuter} />
                <View pointerEvents="none" style={styles.smileAuraInner} />
                <View style={styles.smileCore}>
                  <Ionicons name="happy-outline" size={27} color="#F3E8FF" />
                </View>
              </View>
              <AppText style={styles.title}>Welcome back.</AppText>
              <AppText variant="body" color={color.textSecondary} style={styles.subtitle}>
                Sign in and get back to your campus perks.
              </AppText>
            </View>

            <View style={styles.formSurface}>
              <Controller
                control={control}
                name="email"
                render={({ field }) => (
                  <LoginField
                    label="Email address"
                    icon="mail-outline"
                    placeholder="you@college.edu"
                    keyboardType="email-address"
                    textContentType="emailAddress"
                    autoComplete="email"
                    returnKeyType="next"
                    onSubmitEditing={() => passwordInput.current?.focus()}
                    blurOnSubmit={false}
                    value={field.value}
                    onChangeText={(value) => {
                      setFormError(null);
                      field.onChange(value);
                    }}
                    onBlur={field.onBlur}
                    error={errors.email?.message}
                    testID="login-email-input"
                  />
                )}
              />
              <Controller
                control={control}
                name="password"
                render={({ field }) => (
                  <LoginField
                    ref={passwordInput}
                    label="Password"
                    icon="lock-closed-outline"
                    placeholder="Enter your password"
                    secureTextEntry
                    secureToggle
                    textContentType="password"
                    autoComplete="password"
                    returnKeyType="done"
                    onSubmitEditing={() => void onSubmit()}
                    value={field.value}
                    onChangeText={(value) => {
                      setFormError(null);
                      field.onChange(value);
                    }}
                    onBlur={field.onBlur}
                    error={errors.password?.message}
                    testID="login-password-input"
                  />
                )}
              />

              <Pressable
                onPress={() => router.push("/(auth)/forgot-password")}
                accessibilityRole="link"
                style={styles.forgotButton}
              >
                <AppText variant="small" color="#A5B4FC" style={styles.forgotLabel}>
                  Forgot password?
                </AppText>
              </Pressable>

              {formError ? (
                <View style={styles.errorBox} accessibilityRole="alert">
                  <Ionicons name="alert-circle-outline" size={18} color="#FCA5A5" />
                  <AppText variant="small" color="#FCA5A5" style={styles.errorText}>
                    {formError}
                  </AppText>
                </View>
              ) : null}

              <LoginPrimaryButton label="Sign in" onPress={onSubmit} loading={isSubmitting} />
            </View>
          </View>

          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            style={styles.changeEmailButton}
          >
            <AppText variant="small" color={color.textSecondary}>
              Not your email?{" "}
              <AppText variant="small" color="#A5B4FC" style={styles.changeEmailLabel}>
                Go back
              </AppText>
            </AppText>
          </Pressable>
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
    paddingTop: space.sm,
    paddingBottom: space.lg,
  },
  topRow: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  topSpacer: { width: 44 },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.borderStrong,
    backgroundColor: "rgba(15,15,20,0.76)",
  },
  pressed: { opacity: 0.72 },
  main: { flex: 1, justifyContent: "center", paddingVertical: space.xl },
  intro: { marginBottom: space.xl },
  smileMark: {
    width: 62,
    height: 62,
    marginBottom: space.md,
    alignItems: "center",
    justifyContent: "center",
  },
  smileAuraOuter: {
    position: "absolute",
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: "rgba(109,40,217,0.08)",
    borderWidth: 1,
    borderColor: "rgba(167,139,250,0.18)",
    shadowColor: "#7C3AED",
    shadowOpacity: 0.72,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 0 },
    elevation: 7,
  },
  smileAuraInner: {
    position: "absolute",
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "rgba(124,58,237,0.14)",
    shadowColor: "#8B5CF6",
    shadowOpacity: 0.8,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  smileCore: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(233,213,255,0.62)",
    backgroundColor: "#211238",
  },
  title: { fontSize: 29, lineHeight: 35, fontWeight: "800", letterSpacing: -0.7 },
  subtitle: { marginTop: space.sm, lineHeight: 23 },
  formSurface: {
    padding: space.md,
    gap: space.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.border,
    backgroundColor: "rgba(9,9,13,0.90)",
  },
  forgotButton: {
    minHeight: 36,
    marginTop: -space.xs,
    alignSelf: "flex-end",
    justifyContent: "center",
  },
  forgotLabel: { fontWeight: "700" },
  errorBox: {
    padding: space.md,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space.sm,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(239,68,68,0.28)",
    backgroundColor: "rgba(239,68,68,0.09)",
  },
  errorText: { flex: 1 },
  changeEmailButton: { minHeight: 44, alignItems: "center", justifyContent: "center" },
  changeEmailLabel: { fontWeight: "800" },
});
