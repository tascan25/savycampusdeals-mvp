import { zodResolver } from "@hookform/resolvers/zod";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Pressable, StyleSheet, TextInput, View } from "react-native";

import { apiSendOtp, apiVerifyOtp } from "@/api/auth";
import { toApiError } from "@/api/errors";
import { AuthScaffold } from "@/components/AuthScaffold";
import { AppText, Button } from "@/design-system/components";
import { color, radius, space } from "@/design-system/tokens";
import { useAuth } from "@/providers/AuthProvider";
import { otpSchema, type OtpFormValues } from "@/validation/auth";

const RESEND_COOLDOWN_SECONDS = 60;

export default function VerifyOtpScreen() {
  const { email: emailParam, email_sent: emailSentParam, dev_otp: devOtp } = useLocalSearchParams<{ email?: string; email_sent?: string; dev_otp?: string }>();
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
      // A 429 here just means the cooldown was already running server-side
      // (e.g. after a resend from the website) — start the client timer
      // instead of surfacing it as a hard failure.
      if (apiError.status === 429) {
        startCooldown();
      } else {
        setFormError(apiError.message);
      }
    }
  };

  return (
    <AuthScaffold eyebrow="VERIFY YOUR EMAIL" title="Check your inbox." subtitle={`We sent a six-digit code to ${email || "your email"}.`} icon="mail-unread-outline" step={2} onBack={() => void logout()}>
        <View style={styles.form}>
          {deliveryDelayed ? <View style={styles.deliveryNotice}><Ionicons name="warning-outline" size={17} color={color.amber} /><AppText variant="small" color="#FCD34D" style={styles.deliveryCopy}>The first email was delayed. Tap “Resend code” below to try again.</AppText></View> : null}
          {developmentOtp ? <View style={styles.devNotice}><Ionicons name="construct-outline" size={17} color="#A5B4FC" /><AppText variant="small" color="#C7D2FE" style={styles.deliveryCopy}>Development code: {developmentOtp}</AppText></View> : null}
          <Controller
            control={control}
            name="otp"
            render={({ field }) => (
              <View>
                <AppText variant="caption" color={color.textSecondary} style={styles.codeLabel}>VERIFICATION CODE</AppText>
                <Pressable style={styles.codeRow} onPress={() => otpInput.current?.focus()} accessibilityRole="button" accessibilityLabel="Enter verification code">
                  {Array.from({ length: 6 }, (_, index) => {
                    const digit = field.value[index] ?? "";
                    const active = index === field.value.length && field.value.length < 6;
                    return <View key={index} style={[styles.codeCell, active && styles.codeCellActive, digit && styles.codeCellFilled]}><AppText style={styles.codeDigit}>{digit || "·"}</AppText></View>;
                  })}
                </Pressable>
                <TextInput ref={otpInput} autoFocus value={field.value} onChangeText={(value) => field.onChange(value.replace(/\D/g, "").slice(0, 6))} onBlur={field.onBlur} keyboardType="number-pad" maxLength={6} textContentType="oneTimeCode" autoComplete="sms-otp" style={styles.hiddenInput} testID="otp-input" accessibilityLabel="Verification code" />
                {errors.otp?.message ? <AppText variant="caption" color={color.destructive} style={styles.fieldError}>{errors.otp.message}</AppText> : null}
              </View>
            )}
          />

          {formError ? (
            <AppText variant="small" color="#EF4444" accessibilityRole="alert">
              {formError}
            </AppText>
          ) : null}
          {resendState.status === "sent" ? (
            <AppText variant="small" color="#22C55E">
              A new code is on its way.
            </AppText>
          ) : null}

          <Button label="Verify and continue" onPress={onSubmit} loading={isSubmitting} />
          <Button
            label={
              resendState.status === "cooldown"
                ? `Resend code (${resendState.secondsLeft}s)`
                : "Resend code"
            }
            variant="secondary"
            onPress={onResend}
            disabled={resendState.status === "cooldown"}
          />
          <Pressable onPress={() => void logout()} style={styles.differentAccount} accessibilityRole="button"><AppText variant="small" color={color.textSecondary}>Wrong email? <AppText variant="small" color="#A5B4FC">Use a different account</AppText></AppText></Pressable>
        </View>
    </AuthScaffold>
  );
}

const styles = StyleSheet.create({
  form: { gap: space.md },
  codeLabel: { letterSpacing: 1.3, marginBottom: space.sm },
  codeRow: { flexDirection: "row", justifyContent: "space-between", gap: 7 },
  codeCell: { flex: 1, aspectRatio: 0.82, maxHeight: 62, alignItems: "center", justifyContent: "center", borderRadius: radius.md, backgroundColor: color.surfaceElevated, borderWidth: 1, borderColor: color.borderStrong },
  codeCellActive: { borderColor: "#8175FF", backgroundColor: "rgba(79,70,229,0.15)" },
  codeCellFilled: { borderColor: "rgba(165,180,252,0.36)" },
  codeDigit: { fontSize: 24, lineHeight: 29, fontWeight: "800" },
  hiddenInput: { position: "absolute", width: 1, height: 1, opacity: 0.01 },
  fieldError: { marginTop: space.sm },
  differentAccount: { minHeight: 44, alignItems: "center", justifyContent: "center" },
  deliveryNotice: { padding: space.md, flexDirection: "row", alignItems: "flex-start", gap: space.sm, borderRadius: radius.md, backgroundColor: "rgba(245,158,11,0.09)", borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(245,158,11,0.24)" },
  devNotice: { padding: space.md, flexDirection: "row", alignItems: "flex-start", gap: space.sm, borderRadius: radius.md, backgroundColor: color.primarySoft },
  deliveryCopy: { flex: 1 },
});
