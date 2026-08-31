import { zodResolver } from "@hookform/resolvers/zod";
import { Ionicons } from "@expo/vector-icons";
import { Link, useRouter } from "expo-router";
import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";

import {
  LoginBackdrop,
  LoginField,
  LoginPrimaryButton,
  SavvyWordmark,
} from "@/components/LoginChrome";
import { AppText, Screen } from "@/design-system/components";
import { color, radius, space, type } from "@/design-system/tokens";
import { useAuth } from "@/providers/AuthProvider";
import { registerSchema, type RegisterFormValues } from "@/validation/auth";

const passwordRules = [
  { label: "At least 8 characters", test: (value: string) => value.length >= 8 },
  { label: "One uppercase letter", test: (value: string) => /[A-Z]/.test(value) },
  { label: "One digit", test: (value: string) => /[0-9]/.test(value) },
  { label: "One special character", test: (value: string) => /[^A-Za-z0-9\s]/.test(value) },
  { label: "No spaces", test: (value: string) => value.length > 0 && !/\s/.test(value) },
];

function PasswordFeedback({ password }: { password: string }) {
  if (!password) return null;
  const passed = passwordRules.filter((rule) => rule.test(password)).length;
  const strength =
    passed <= 1
      ? "Too weak"
      : passed === 2
        ? "Weak"
        : passed === 3
          ? "Fair"
          : passed === 4
            ? "Good"
            : "Strong";
  const tint =
    passed <= 1
      ? color.destructive
      : passed <= 3
        ? color.amber
        : passed === 4
          ? "#60A5FA"
          : color.success;

  return (
    <View style={styles.passwordFeedback}>
      <View style={styles.strengthBars}>
        {passwordRules.map((rule, index) => (
          <View
            key={rule.label}
            style={[styles.strengthBar, index < passed && { backgroundColor: tint }]}
          />
        ))}
      </View>
      <View style={styles.strengthMeta}>
        <AppText variant="caption" color={tint} style={styles.strengthLabel}>
          {strength}
        </AppText>
        <AppText variant="caption" color={color.textTertiary}>
          Password strength
        </AppText>
      </View>
      <View style={styles.ruleList}>
        {passwordRules.map((rule) => {
          const valid = rule.test(password);
          return (
            <View key={rule.label} style={styles.ruleRow}>
              <Ionicons
                name={valid ? "checkmark-circle" : "close-circle-outline"}
                size={15}
                color={valid ? color.success : color.textTertiary}
              />
              <AppText variant="caption" color={valid ? "#86EFAC" : color.textTertiary}>
                {rule.label}
              </AppText>
            </View>
          );
        })}
      </View>
    </View>
  );
}

export default function RegisterScreen() {
  const { register } = useAuth();
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [stage, setStage] = useState<1 | 2>(1);
  const [showReferral, setShowReferral] = useState(false);
  const {
    control,
    handleSubmit,
    trigger,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    mode: "onChange",
    defaultValues: {
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
      college: "",
      course: "",
      year: "",
      referralCode: "",
    },
  });
  const password = useWatch({ control, name: "password" });
  const confirmPassword = useWatch({ control, name: "confirmPassword" });

  const continueToCampus = async () => {
    const valid = await trigger(["name", "email", "password", "confirmPassword"]);
    if (valid) {
      setFormError(null);
      setStage(2);
    }
  };

  const goBack = () => {
    if (stage === 2) setStage(1);
    else router.back();
  };

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const result = await register({
        name: values.name.trim(),
        email: values.email.trim().toLowerCase(),
        password: values.password,
        college: values.college.trim(),
        course: values.course.trim(),
        year: values.year.trim(),
        referral_code: values.referralCode || undefined,
      });
      router.replace({
        pathname: "/(auth)/verify-otp",
        params: {
          email: result.user.email,
          email_sent: result.emailSent ? "1" : "0",
          signup_flow: "1",
          ...(result.devOtp ? { dev_otp: result.devOtp } : {}),
        },
      });
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Something went wrong.");
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
              onPress={goBack}
              accessibilityRole="button"
              accessibilityLabel={stage === 2 ? "Back to account details" : "Go back"}
              style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
            >
              <Ionicons name="arrow-back" size={20} color={color.textPrimary} />
            </Pressable>
            <SavvyWordmark />
            <View style={styles.topSpacer} />
          </View>

          <View style={styles.progress} accessibilityLabel={`Step ${stage} of 3`}>
            {[1, 2, 3].map((item) => (
              <View
                key={item}
                style={[styles.progressBar, item <= stage && styles.progressActive]}
              />
            ))}
          </View>

          <View style={styles.intro}>
            <View style={styles.introMark}>
              <Ionicons
                name={stage === 1 ? "person-add-outline" : "school-outline"}
                size={22}
                color="#E9D5FF"
              />
            </View>
            <AppText style={styles.title}>
              {stage === 1 ? "Create your account." : "Your campus details."}
            </AppText>
            <AppText variant="body" color={color.textSecondary} style={styles.subtitle}>
              {stage === 1
                ? "Start with the essentials. It only takes a minute."
                : "College, course and year are required to create your student account."}
            </AppText>
          </View>

          <View style={styles.formSurface}>
            {stage === 1 ? (
              <>
                <Controller
                  control={control}
                  name="name"
                  render={({ field }) => (
                    <LoginField
                      label="Full name"
                      icon="person-outline"
                      placeholder="Your full name"
                      autoComplete="name"
                      textContentType="name"
                      autoCapitalize="words"
                      value={field.value}
                      onChangeText={field.onChange}
                      onBlur={field.onBlur}
                      error={errors.name?.message}
                      testID="register-name-input"
                    />
                  )}
                />
                <Controller
                  control={control}
                  name="email"
                  render={({ field }) => (
                    <LoginField
                      label="Email address"
                      icon="mail-outline"
                      placeholder="Primary or college email"
                      keyboardType="email-address"
                      textContentType="emailAddress"
                      autoComplete="email"
                      value={field.value}
                      onChangeText={field.onChange}
                      onBlur={field.onBlur}
                      error={errors.email?.message}
                      testID="register-email-input"
                    />
                  )}
                />
                <Controller
                  control={control}
                  name="password"
                  render={({ field }) => (
                    <View>
                      <LoginField
                        label="Password"
                        icon="lock-closed-outline"
                        placeholder="Create a password"
                        secureTextEntry
                        secureToggle
                        textContentType="newPassword"
                        autoComplete="password-new"
                        value={field.value}
                        onChangeText={field.onChange}
                        onBlur={field.onBlur}
                        error={errors.password?.message}
                        testID="register-password-input"
                      />
                      <PasswordFeedback password={password} />
                    </View>
                  )}
                />
                <Controller
                  control={control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <View>
                      <LoginField
                        label="Confirm password"
                        icon="shield-checkmark-outline"
                        placeholder="Enter it once more"
                        secureTextEntry
                        secureToggle
                        textContentType="newPassword"
                        autoComplete="password-new"
                        returnKeyType="done"
                        onSubmitEditing={() => void continueToCampus()}
                        value={field.value}
                        onChangeText={field.onChange}
                        onBlur={field.onBlur}
                        error={errors.confirmPassword?.message}
                        testID="register-confirm-password-input"
                      />
                      {confirmPassword && confirmPassword === password ? (
                        <View style={styles.matchRow}>
                          <Ionicons name="checkmark-circle" size={15} color={color.success} />
                          <AppText variant="caption" color="#86EFAC">
                            Passwords match
                          </AppText>
                        </View>
                      ) : null}
                    </View>
                  )}
                />
                <LoginPrimaryButton label="Continue" onPress={() => void continueToCampus()} />
              </>
            ) : (
              <>
                <View style={styles.requiredNotice}>
                  <Ionicons name="information-circle-outline" size={17} color="#C4B5FD" />
                  <AppText variant="small" color="#DDD6FE" style={styles.noticeText}>
                    Complete all three academic fields. Only the referral code is optional.
                  </AppText>
                </View>
                <Controller
                  control={control}
                  name="college"
                  render={({ field }) => (
                    <LoginField
                      label="College"
                      icon="school-outline"
                      placeholder="Your college or university"
                      autoCapitalize="words"
                      value={field.value}
                      onChangeText={field.onChange}
                      onBlur={field.onBlur}
                      error={errors.college?.message}
                      testID="register-college-input"
                    />
                  )}
                />
                <Controller
                  control={control}
                  name="course"
                  render={({ field }) => (
                    <LoginField
                      label="Course"
                      icon="book-outline"
                      placeholder="e.g. Computer Science"
                      autoCapitalize="words"
                      value={field.value}
                      onChangeText={field.onChange}
                      onBlur={field.onBlur}
                      error={errors.course?.message}
                      testID="register-course-input"
                    />
                  )}
                />
                <Controller
                  control={control}
                  name="year"
                  render={({ field }) => (
                    <LoginField
                      label="Year of study"
                      icon="calendar-outline"
                      placeholder="e.g. 2nd year"
                      autoCapitalize="sentences"
                      value={field.value}
                      onChangeText={field.onChange}
                      onBlur={field.onBlur}
                      error={errors.year?.message}
                      testID="register-year-input"
                    />
                  )}
                />

                {showReferral ? (
                  <Controller
                    control={control}
                    name="referralCode"
                    render={({ field }) => (
                      <LoginField
                        label="Referral code (optional)"
                        icon="gift-outline"
                        placeholder="Enter your code"
                        autoCapitalize="characters"
                        value={field.value}
                        onChangeText={field.onChange}
                        onBlur={field.onBlur}
                        testID="register-referral-input"
                      />
                    )}
                  />
                ) : (
                  <Pressable
                    onPress={() => setShowReferral(true)}
                    style={styles.referralButton}
                    accessibilityRole="button"
                  >
                    <Ionicons name="gift-outline" size={17} color="#A5B4FC" />
                    <AppText variant="small" color="#A5B4FC" style={styles.referralLabel}>
                      Have a referral code?
                    </AppText>
                    <Ionicons name="chevron-forward" size={16} color={color.textTertiary} />
                  </Pressable>
                )}

                {formError ? (
                  <View style={styles.errorBox} accessibilityRole="alert">
                    <Ionicons name="alert-circle-outline" size={17} color="#FCA5A5" />
                    <AppText variant="small" color="#FCA5A5" style={styles.errorCopy}>
                      {formError}
                    </AppText>
                  </View>
                ) : null}

                <LoginPrimaryButton
                  label="Create account"
                  onPress={onSubmit}
                  loading={isSubmitting}
                />
                <View style={styles.privacyRow}>
                  <Ionicons name="lock-closed-outline" size={14} color={color.textTertiary} />
                  <AppText variant="caption" color={color.textTertiary} style={styles.privacyText}>
                    Your details are used only for your account and student verification.
                  </AppText>
                </View>
              </>
            )}
          </View>

          {stage === 1 ? (
            <View style={styles.footer}>
              <AppText variant="small" color={color.textSecondary}>
                Already have an account?
              </AppText>
              <Link href="/(auth)/login" style={styles.inlineLink}>
                Sign in
              </Link>
            </View>
          ) : null}
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
  intro: { marginTop: space.xl, marginBottom: space.lg },
  introMark: {
    width: 46,
    height: 46,
    marginBottom: space.md,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(167,139,250,0.30)",
    backgroundColor: color.primarySoft,
    shadowColor: "#7C3AED",
    shadowOpacity: 0.32,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  title: { fontSize: 28, lineHeight: 34, fontWeight: "800", letterSpacing: -0.65 },
  subtitle: { marginTop: space.sm, maxWidth: 370, lineHeight: 22 },
  formSurface: {
    padding: space.md,
    gap: space.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.border,
    backgroundColor: "rgba(9,9,13,0.92)",
  },
  passwordFeedback: { marginTop: space.md },
  strengthBars: { flexDirection: "row", gap: 5 },
  strengthBar: { flex: 1, height: 4, borderRadius: 2, backgroundColor: color.surfaceElevated },
  strengthMeta: { marginTop: 6, flexDirection: "row", justifyContent: "space-between" },
  strengthLabel: { fontWeight: "700" },
  ruleList: {
    marginTop: space.md,
    padding: space.md,
    gap: space.sm,
    borderRadius: radius.md,
    backgroundColor: "rgba(255,255,255,0.025)",
  },
  ruleRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  matchRow: { marginTop: space.sm, flexDirection: "row", alignItems: "center", gap: 5 },
  requiredNotice: {
    padding: space.md,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space.sm,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(167,139,250,0.18)",
    backgroundColor: color.primarySoft,
  },
  noticeText: { flex: 1 },
  referralButton: {
    minHeight: 52,
    paddingHorizontal: space.md,
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.borderStrong,
    backgroundColor: "rgba(16,16,22,0.92)",
  },
  referralLabel: { flex: 1, fontWeight: "700" },
  errorBox: {
    padding: space.md,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space.sm,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(239,68,68,0.35)",
    backgroundColor: "rgba(239,68,68,0.10)",
  },
  errorCopy: { flex: 1 },
  privacyRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "center", gap: 6 },
  privacyText: { flex: 1, lineHeight: 17 },
  footer: {
    minHeight: 52,
    marginTop: space.md,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
  },
  inlineLink: { ...type.small, color: color.textPrimary, fontWeight: "800" },
});
