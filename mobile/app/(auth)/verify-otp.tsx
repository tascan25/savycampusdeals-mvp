import { zodResolver } from "@hookform/resolvers/zod";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
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

import { apiSendOtp, apiVerifyOtp } from "@/api/auth";
import { toApiError } from "@/api/errors";
import { LoginBackdrop, LoginPrimaryButton, SavvyWordmark } from "@/components/LoginChrome";
import { AppText, Screen } from "@/design-system/components";
import { color, radius, space } from "@/design-system/tokens";
import { useAuth } from "@/providers/AuthProvider";
import { otpSchema, type OtpFormValues } from "@/validation/auth";

const RESEND_COOLDOWN_SECONDS = 60;

export default function VerifyOtpScreen() {
  const {
    email: emailParam,
    email_sent: emailSentParam,
    dev_otp: devOtp,
    signup_flow: signupFlow,
  } = useLocalSearchParams<{
    email?: string;
    email_sent?: string;
    dev_otp?: string;
    signup_flow?: string;
  }>();
  const { user, refreshUser, logout } = useAuth();
  const router = useRouter();
  const email = emailParam ?? user?.email ?? "";
  const [formError, setFormError] = useState<string | null>(null);
  const [deliveryDelayed, setDeliveryDelayed] = useState(emailSentParam === "0");
  const [developmentOtp, setDevelopmentOtp] = useState(devOtp ?? "");
  const [resendState, setResendState] = useState<
    { status: "idle" } | { status: "sent" } | { status: "cooldown"; secondsLeft: number }
  >({ status: "idle" });
  const cooldownTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const otpInput = useRef<TextInput>(null);
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<OtpFormValues>({
    resolver: zodResolver(otpSchema),
    defaultValues: { otp: "" },
  });

  useEffect(() => {
    return () => {
      if (cooldownTimer.current) clearInterval(cooldownTimer.current);
    };
  }, []);

  const startCooldown = useCallback(() => {
    setResendState({ status: "cooldown", secondsLeft: RESEND_COOLDOWN_SECONDS });
    cooldownTimer.current = setInterval(() => {
      setResendState((current) => {
        if (current.status !== "cooldown") return current;
        if (current.secondsLeft <= 1) {
          if (cooldownTimer.current) clearInterval(cooldownTimer.current);
          return { status: "idle" };
        }
        return { status: "cooldown", secondsLeft: current.secondsLeft - 1 };
      });
    }, 1000);
  }, []);

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await apiVerifyOtp(email, values.otp);
      await refreshUser();
      router.replace("/verify");
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Something went wrong.");
    }
  });

  const onResend = async () => {
    if (resendState.status === "cooldown") return;
    setFormError(null);
    try {
      const response = await apiSendOtp(email);
      setDeliveryDelayed(response.email_sent === false);
      if (response.dev_otp) setDevelopmentOtp(response.dev_otp);
      setResendState({ status: "sent" });
      startCooldown();
    } catch (error) {
      const apiError = toApiError(error);
      if (apiError.status === 429) startCooldown();
      else setFormError(apiError.message);
    }
  };

  const handleDifferentAccount = async () => {
    await logout();
    router.replace("/(auth)/login");
  };

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
              onPress={() => router.replace("/(tabs)")}
              accessibilityRole="button"
              accessibilityLabel="Continue without verifying email"
              style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
            >
              <Ionicons name="arrow-back" size={20} color={color.textPrimary} />
            </Pressable>
            <SavvyWordmark />
            <View style={styles.topSpacer} />
          </View>

          {signupFlow === "1" ? (
            <View style={styles.progress} accessibilityLabel="Step 3 of 3">
              {[1, 2, 3].map((item) => (
                <View key={item} style={[styles.progressBar, styles.progressActive]} />
              ))}
            </View>
          ) : null}

          <View style={styles.heroMark}>
            <View style={styles.markAura} />
            <View style={styles.markRing}>
              <Ionicons name="mail-unread-outline" size={28} color="#E9D5FF" />
            </View>
          </View>

          <View style={styles.intro}>
            <AppText variant="caption" color="#B9B2FF" style={styles.eyebrow}>
              EMAIL VERIFICATION
            </AppText>
            <AppText style={styles.title}>One quick check.</AppText>
            <AppText variant="body" color={color.textSecondary} style={styles.subtitle}>
              Enter the six-digit code we sent to your inbox.
            </AppText>
            <View style={styles.emailPill}>
              <Ionicons name="mail-outline" size={15} color="#A78BFA" />
              <AppText variant="small" color="#DDD6FE" numberOfLines={1} style={styles.emailText}>
                {email || "Your email address"}
              </AppText>
            </View>
          </View>

          <View style={styles.formSurface}>
            {deliveryDelayed ? (
              <Notice
                icon="warning-outline"
                tint="#FCD34D"
                text="Delivery is taking longer than usual. You can request a fresh code below."
              />
            ) : null}
            {developmentOtp ? (
              <Notice
                icon="construct-outline"
                tint="#C4B5FD"
                text={`Development code: ${developmentOtp}`}
              />
            ) : null}

            <Controller
              control={control}
              name="otp"
              render={({ field }) => (
                <View>
                  <AppText variant="small" color={color.textSecondary} style={styles.codeLabel}>
                    Verification code
                  </AppText>
                  <Pressable
                    style={styles.codeRow}
                    onPress={() => otpInput.current?.focus()}
                    accessibilityRole="button"
                    accessibilityLabel="Enter verification code"
                  >
                    {Array.from({ length: 6 }, (_, index) => {
                      const digit = field.value[index] ?? "";
                      const active = index === field.value.length && field.value.length < 6;
                      return (
                        <View
                          key={index}
                          style={[
                            styles.codeCell,
                            active && styles.codeCellActive,
                            Boolean(digit) && styles.codeCellFilled,
                          ]}
                        >
                          <AppText style={styles.codeDigit}>{digit}</AppText>
                        </View>
                      );
                    })}
                  </Pressable>
                  <TextInput
                    ref={otpInput}
                    autoFocus
                    value={field.value}
                    onChangeText={(value) => field.onChange(value.replace(/\D/g, "").slice(0, 6))}
                    onBlur={field.onBlur}
                    keyboardType="number-pad"
                    maxLength={6}
                    textContentType="oneTimeCode"
                    autoComplete="sms-otp"
                    style={styles.hiddenInput}
                    testID="otp-input"
                    accessibilityLabel="Verification code"
                  />
                  {errors.otp?.message ? (
                    <View style={styles.errorRow} accessibilityRole="alert">
                      <Ionicons name="alert-circle-outline" size={14} color="#FCA5A5" />
                      <AppText variant="caption" color="#FCA5A5" style={styles.errorCopy}>
                        {errors.otp.message}
                      </AppText>
                    </View>
                  ) : null}
                </View>
              )}
            />

            {formError ? (
              <Notice icon="alert-circle-outline" tint="#FCA5A5" text={formError} error />
            ) : null}
            {resendState.status === "sent" ? (
              <Notice
                icon="checkmark-circle-outline"
                tint="#86EFAC"
                text="A new code is on its way."
              />
            ) : null}

            <LoginPrimaryButton label="Verify email" onPress={onSubmit} loading={isSubmitting} />
            <Pressable
              onPress={() => void onResend()}
              disabled={resendState.status === "cooldown"}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.secondaryButton,
                pressed && resendState.status !== "cooldown" && styles.pressed,
              ]}
            >
              <Ionicons name="refresh-outline" size={17} color="#B9B2FF" />
              <AppText variant="small" color="#DDD6FE" style={styles.secondaryLabel}>
                {resendState.status === "cooldown"
                  ? `Send again in ${resendState.secondsLeft}s`
                  : "Resend code"}
              </AppText>
            </Pressable>
          </View>

          <Pressable
            onPress={() => void handleDifferentAccount()}
            style={styles.differentAccount}
            accessibilityRole="button"
          >
            <AppText variant="small" color={color.textSecondary}>
              Wrong email?{" "}
              <AppText variant="small" color="#A78BFA" style={styles.link}>
                Use another account
              </AppText>
            </AppText>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function Notice({
  icon,
  tint,
  text,
  error = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
  text: string;
  error?: boolean;
}) {
  return (
    <View
      style={[styles.notice, error && styles.errorNotice]}
      accessibilityRole={error ? "alert" : undefined}
    >
      <Ionicons name={icon} size={17} color={tint} />
      <AppText variant="small" color={tint} style={styles.noticeCopy}>
        {text}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    flexGrow: 1,
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    paddingBottom: space.xl,
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
  progress: { marginTop: space.md, flexDirection: "row", gap: space.sm },
  progressBar: { flex: 1, height: 3, borderRadius: 2, backgroundColor: color.surfaceElevated },
  progressActive: { backgroundColor: "#7C6CFF" },
  heroMark: { height: 108, alignItems: "center", justifyContent: "center", marginTop: space.lg },
  markAura: {
    position: "absolute",
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: "rgba(124,58,237,0.18)",
    shadowColor: "#8B5CF6",
    shadowOpacity: 0.65,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  markRing: {
    width: 64,
    height: 64,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(196,181,253,0.38)",
    backgroundColor: "rgba(40,25,72,0.90)",
  },
  intro: { alignItems: "center", marginTop: space.sm, marginBottom: space.lg },
  eyebrow: { fontWeight: "800", letterSpacing: 1.7 },
  title: {
    marginTop: space.sm,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "800",
    letterSpacing: -0.65,
  },
  subtitle: { marginTop: space.sm, textAlign: "center", lineHeight: 22 },
  emailPill: {
    maxWidth: "100%",
    marginTop: space.md,
    paddingVertical: 9,
    paddingHorizontal: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(167,139,250,0.25)",
    backgroundColor: "rgba(124,58,237,0.10)",
  },
  emailText: { flexShrink: 1 },
  formSurface: {
    padding: space.md,
    gap: space.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(167,139,250,0.16)",
    backgroundColor: "rgba(9,9,13,0.94)",
  },
  codeLabel: { marginBottom: space.sm, fontWeight: "700" },
  codeRow: { flexDirection: "row", justifyContent: "space-between", gap: 7 },
  codeCell: {
    flex: 1,
    aspectRatio: 0.84,
    maxHeight: 58,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: color.borderStrong,
    backgroundColor: "rgba(16,16,22,0.96)",
  },
  codeCellActive: { borderColor: "#8B7CFF", backgroundColor: "rgba(124,58,237,0.15)" },
  codeCellFilled: { borderColor: "rgba(196,181,253,0.42)" },
  codeDigit: { fontSize: 23, lineHeight: 28, fontWeight: "800" },
  hiddenInput: { position: "absolute", width: 1, height: 1, opacity: 0.01 },
  errorRow: { marginTop: space.sm, flexDirection: "row", alignItems: "flex-start", gap: 5 },
  errorCopy: { flex: 1 },
  notice: {
    padding: space.md,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space.sm,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(167,139,250,0.16)",
    backgroundColor: "rgba(124,58,237,0.08)",
  },
  errorNotice: { borderColor: "rgba(239,68,68,0.30)", backgroundColor: "rgba(239,68,68,0.08)" },
  noticeCopy: { flex: 1 },
  secondaryButton: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.borderStrong,
    backgroundColor: "rgba(255,255,255,0.035)",
  },
  secondaryLabel: { fontWeight: "800" },
  differentAccount: { minHeight: 52, alignItems: "center", justifyContent: "center" },
  link: { fontWeight: "800" },
});
