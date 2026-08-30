import { zodResolver } from "@hookform/resolvers/zod";
import { Ionicons } from "@expo/vector-icons";
import { Link, useRouter } from "expo-router";
import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { StyleSheet, View } from "react-native";

import { AuthScaffold } from "@/components/AuthScaffold";
import { AppText, Button, TextField } from "@/design-system/components";
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
  const passed = passwordRules.filter((rule) => rule.test(password)).length;
  const strength = passed <= 1 ? "Too weak" : passed <= 2 ? "Weak" : passed <= 3 ? "Fair" : passed === 4 ? "Good" : "Strong";
  const tint = passed <= 1 ? color.destructive : passed <= 3 ? color.amber : passed === 4 ? "#60A5FA" : color.success;

  if (!password) return null;
  return (
    <View style={styles.passwordFeedback}>
      <View style={styles.strengthBars}>
        {passwordRules.map((rule, index) => <View key={rule.label} style={[styles.strengthBar, index < passed && { backgroundColor: tint }]} />)}
      </View>
      <View style={styles.strengthMeta}>
        <AppText variant="caption" color={tint} style={styles.strengthLabel}>{strength}</AppText>
        <AppText variant="caption" color={color.textTertiary}>Password strength</AppText>
      </View>
      <View style={styles.ruleList}>
        {passwordRules.map((rule) => {
          const valid = rule.test(password);
          return (
            <View key={rule.label} style={styles.rule}>
              <Ionicons name={valid ? "checkmark-circle" : "ellipse-outline"} size={16} color={valid ? color.success : color.textTertiary} />
              <AppText variant="caption" color={valid ? "#86EFAC" : color.textTertiary}>{rule.label}</AppText>
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
  const { control, handleSubmit, formState: { errors, isSubmitting, isValid } } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    mode: "onChange",
    defaultValues: { name: "", email: "", password: "", confirmPassword: "", college: "", course: "", year: "", referralCode: "" },
  });
  const password = useWatch({ control, name: "password" });
  const confirmPassword = useWatch({ control, name: "confirmPassword" });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const result = await register({
        name: values.name,
        email: values.email,
        password: values.password,
        college: values.college || undefined,
        course: values.course || undefined,
        year: values.year || undefined,
        referral_code: values.referralCode || undefined,
      });
      router.replace({
        pathname: "/(auth)/verify-otp",
        params: {
          email: result.user.email,
          email_sent: result.emailSent ? "1" : "0",
          ...(result.devOtp ? { dev_otp: result.devOtp } : {}),
        },
      });
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Something went wrong.");
    }
  });

  return (
    <AuthScaffold eyebrow="CREATE YOUR ACCOUNT" title="One account. Every student deal." subtitle="Set up your profile now, then verify your email in the next step." icon="person-add" step={1} onBack={() => router.back()} footer={<View style={styles.footer}><AppText variant="small" color={color.textSecondary}>Already have an account?</AppText><Link href="/(auth)/login" style={styles.inlineLink}>Sign in</Link></View>}>
          <View style={styles.form}>
            <AppText variant="caption" color={color.textTertiary} style={styles.sectionLabel}>ACCOUNT DETAILS</AppText>
            <Controller control={control} name="name" render={({ field }) => <TextField label="Full name" autoComplete="name" textContentType="name" autoCapitalize="words" value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={errors.name?.message} testID="register-name-input" />} />
            <Controller control={control} name="email" render={({ field }) => <View><TextField label="Email" placeholder="Primary or college email" keyboardType="email-address" textContentType="emailAddress" autoComplete="email" value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={errors.email?.message} testID="register-email-input" /><AppText variant="caption" color={color.textTertiary} style={styles.fieldHint}>Use an inbox you can access. A supported college email may speed up verification.</AppText></View>} />
            <Controller control={control} name="password" render={({ field }) => <View><TextField label="Password" secureTextEntry secureToggle textContentType="newPassword" autoComplete="password-new" value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={errors.password?.message} testID="register-password-input" /><PasswordFeedback password={password} /></View>} />
            <Controller control={control} name="confirmPassword" render={({ field }) => <View><TextField label="Confirm password" secureTextEntry secureToggle textContentType="newPassword" autoComplete="password-new" value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={errors.confirmPassword?.message} testID="register-confirm-password-input" />{confirmPassword && confirmPassword === password ? <View style={styles.matchRow}><Ionicons name="checkmark-circle" size={15} color={color.success} /><AppText variant="caption" color="#86EFAC">Passwords match</AppText></View> : null}</View>} />

            <AppText variant="caption" color={color.textTertiary} style={[styles.sectionLabel, styles.profileLabel]}>STUDENT PROFILE</AppText>
            <Controller control={control} name="college" render={({ field }) => <TextField label="College" autoCapitalize="words" value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} testID="register-college-input" />} />
            <Controller control={control} name="course" render={({ field }) => <TextField label="Course" autoCapitalize="words" value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} testID="register-course-input" />} />
            <Controller control={control} name="year" render={({ field }) => <View><TextField label="Year of study" placeholder="e.g. 1st year" autoCapitalize="sentences" value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} testID="register-year-input" /><AppText variant="caption" color={color.textTertiary} style={styles.fieldHint}>Enter as 1st year, 2nd year, 3rd year, etc.</AppText></View>} />
            <Controller control={control} name="referralCode" render={({ field }) => <TextField label="Referral code (optional)" autoCapitalize="characters" value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} testID="register-referral-input" />} />

            {formError ? <View style={styles.errorBox}><Ionicons name="alert-circle-outline" size={17} color={color.destructive} /><AppText variant="small" color="#FCA5A5" style={styles.errorCopy} accessibilityRole="alert">{formError}</AppText></View> : null}
            <Button label="Create account" onPress={onSubmit} loading={isSubmitting} disabled={!isValid} accessibilityHint="Creates your Savvy Campus account" />
            <View style={styles.privacyRow}><Ionicons name="lock-closed-outline" size={14} color={color.textTertiary} /><AppText variant="caption" color={color.textTertiary} style={styles.privacyText}>Your details are used only for your account and student verification.</AppText></View>
          </View>
    </AuthScaffold>
  );
}

const styles = StyleSheet.create({
  form: { gap: space.lg },
  sectionLabel: { letterSpacing: 1.8 },
  profileLabel: { marginTop: space.sm },
  fieldHint: { marginTop: space.sm, lineHeight: 17 },
  passwordFeedback: { marginTop: space.md },
  strengthBars: { flexDirection: "row", gap: 5 },
  strengthBar: { flex: 1, height: 4, borderRadius: 2, backgroundColor: color.surfaceElevated },
  strengthMeta: { marginTop: 6, flexDirection: "row", justifyContent: "space-between" },
  strengthLabel: { fontWeight: "700" },
  ruleList: { marginTop: space.md, padding: space.md, gap: space.sm, borderRadius: radius.md, backgroundColor: color.surfaceMuted },
  rule: { flexDirection: "row", alignItems: "center", gap: space.sm },
  matchRow: { marginTop: space.sm, flexDirection: "row", alignItems: "center", gap: 5 },
  errorBox: { padding: space.md, flexDirection: "row", alignItems: "flex-start", gap: space.sm, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(239,68,68,0.35)", backgroundColor: "rgba(239,68,68,0.10)" },
  errorCopy: { flex: 1 },
  footer: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6 },
  inlineLink: { ...type.small, color: color.textPrimary, fontWeight: "800" },
  privacyRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "center", gap: 6 },
  privacyText: { flex: 1, lineHeight: 17 },
});
