import { zodResolver } from "@hookform/resolvers/zod";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Link, useRouter } from "expo-router";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";

import { apiAccountExists } from "@/api/auth";
import { toApiError } from "@/api/errors";
import {
  LoginBackdrop,
  LoginField,
  LoginPrimaryButton,
  SavvyWordmark,
} from "@/components/LoginChrome";
import { AppText, Screen } from "@/design-system/components";
import { color, radius, space, type } from "@/design-system/tokens";
import { forgotPasswordSchema, type ForgotPasswordFormValues } from "@/validation/auth";

export default function LoginScreen() {
  const router = useRouter();
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [serverWaking, setServerWaking] = useState(false);
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  const onContinue = handleSubmit(async ({ email }) => {
    setLookupError(null);
    setServerWaking(false);
    const normalizedEmail = email.trim().toLowerCase();
    const wakingTimer = setTimeout(() => setServerWaking(true), 8_000);
    try {
      const exists = await apiAccountExists(normalizedEmail);
      if (!exists) {
        setLookupError("We couldn't find a Savvy account with that email.");
        return;
      }
      router.push({ pathname: "/(auth)/login-password", params: { email: normalizedEmail } });
    } catch (error) {
      setLookupError(toApiError(error).message);
    } finally {
      clearTimeout(wakingTimer);
      setServerWaking(false);
    }
  });

  return (
    <Screen>
      <LoginBackdrop />
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
          <View style={styles.brandRow}>
            <SavvyWordmark />
          </View>

          <View style={styles.hero}>
            <LinearGradient
              colors={["rgba(126,34,206,0.82)", "rgba(49,46,129,0.92)"]}
              style={styles.ticketTile}
            >
              <View style={styles.ticketInner}>
                <Ionicons name="school-outline" size={34} color="#D8B4FE" />
              </View>
            </LinearGradient>
            <AppText style={styles.tagline}>
              Every student deserves <AppText style={styles.taglineAccent}>more.</AppText>
            </AppText>
            <AppText variant="small" color={color.textTertiary} style={styles.taglineSupport}>
              Student deals, rewards and campus benefits—together.
            </AppText>
          </View>

          <View style={styles.sheet}>
            <View style={styles.sheetIntro}>
              <AppText style={styles.sheetTitle}>Continue with email</AppText>
              <AppText variant="small" color={color.textSecondary}>
                Enter the email linked to your Savvy account.
              </AppText>
            </View>

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
                  returnKeyType="go"
                  onSubmitEditing={() => void onContinue()}
                  value={field.value}
                  onChangeText={(value) => {
                    setLookupError(null);
                    field.onChange(value);
                  }}
                  onBlur={field.onBlur}
                  error={errors.email?.message}
                  testID="login-email-input"
                />
              )}
            />

            {lookupError ? (
              <View style={styles.lookupError} accessibilityRole="alert">
                <Ionicons name="person-remove-outline" size={17} color="#FCA5A5" />
                <AppText variant="small" color="#FCA5A5" style={styles.lookupErrorText}>
                  {lookupError}
                </AppText>
              </View>
            ) : null}

            {serverWaking ? (
              <View style={styles.wakingNotice} accessibilityLiveRegion="polite">
                <ActivityIndicator size="small" color="#C4B5FD" />
                <View style={styles.wakingCopy}>
                  <AppText variant="small" color="#DDD6FE">
                    Savvy&apos;s server is waking up
                  </AppText>
                  <AppText variant="caption" color={color.textTertiary}>
                    This can take a minute on the first request. Keep this screen open.
                  </AppText>
                </View>
              </View>
            ) : null}

            <LoginPrimaryButton label="Continue" onPress={onContinue} loading={isSubmitting} />

            <View style={styles.footerRow}>
              <AppText variant="small" color={color.textSecondary}>
                New to Savvy?
              </AppText>
              <Link href="/(auth)/register" style={styles.footerLink}>
                Create account
              </Link>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { flexGrow: 1 },
  brandRow: { minHeight: 62, paddingTop: space.md, alignItems: "center", justifyContent: "center" },
  hero: {
    flex: 1,
    minHeight: 330,
    paddingHorizontal: space.lg,
    paddingVertical: space.xl,
    alignItems: "center",
    justifyContent: "center",
  },
  ticketTile: {
    width: 82,
    height: 82,
    marginBottom: space.xl,
    padding: 1,
    borderRadius: 25,
    transform: [{ rotate: "-7deg" }],
    shadowColor: "#9333EA",
    shadowOpacity: 0.62,
    shadowRadius: 25,
    shadowOffset: { width: 0, height: 7 },
    elevation: 9,
  },
  ticketInner: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 24,
    backgroundColor: "rgba(10,8,20,0.62)",
  },
  tagline: {
    maxWidth: 330,
    textAlign: "center",
    fontSize: 34,
    lineHeight: 42,
    fontWeight: "600",
    fontFamily: Platform.select({ ios: "Snell Roundhand", android: "cursive" }),
    letterSpacing: 0.1,
    textShadowColor: "rgba(255,255,255,0.16)",
    textShadowRadius: 8,
  },
  taglineAccent: {
    color: "#B794F6",
    fontSize: 34,
    lineHeight: 42,
    fontFamily: Platform.select({ ios: "Snell Roundhand", android: "cursive" }),
    fontWeight: "700",
    textShadowColor: "rgba(139,92,246,0.85)",
    textShadowRadius: 14,
  },
  taglineSupport: { maxWidth: 310, marginTop: space.sm, textAlign: "center", lineHeight: 18 },
  sheet: {
    paddingHorizontal: space.lg,
    paddingTop: space.xl,
    paddingBottom: space.lg,
    gap: space.md,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: color.borderStrong,
    backgroundColor: "rgba(8,8,11,0.97)",
  },
  sheetIntro: { gap: space.xs, marginBottom: space.xs },
  sheetTitle: { fontSize: 22, lineHeight: 28, fontWeight: "700", letterSpacing: -0.35 },
  lookupError: {
    padding: space.md,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space.sm,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(239,68,68,0.28)",
    backgroundColor: "rgba(239,68,68,0.09)",
  },
  lookupErrorText: { flex: 1 },
  wakingNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(167,139,250,0.2)",
    backgroundColor: "rgba(124,58,237,0.09)",
  },
  wakingCopy: { flex: 1, gap: 2 },
  footerRow: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  footerLink: { ...type.small, color: color.textPrimary, fontWeight: "800" },
});
