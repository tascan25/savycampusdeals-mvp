import { zodResolver } from "@hookform/resolvers/zod";
import { Ionicons } from "@expo/vector-icons";
import { Link, useRouter } from "expo-router";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { StyleSheet, View } from "react-native";

import { AuthScaffold } from "@/components/AuthScaffold";
import { AppText, Button, TextField } from "@/design-system/components";
import { color, radius, space, type } from "@/design-system/tokens";
import { useAuth } from "@/providers/AuthProvider";
import { loginSchema, type LoginFormValues } from "@/validation/auth";

export default function LoginScreen() {
  const { login } = useAuth();
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const { control, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginFormValues>({ resolver: zodResolver(loginSchema), defaultValues: { email: "", password: "" } });

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
    <AuthScaffold eyebrow="WELCOME BACK" title="Your campus perks are waiting." subtitle="Sign in once and pick up exactly where you left off." icon="sparkles" footer={<View style={styles.footerRow}><AppText variant="small" color={color.textSecondary}>New to Savvy Campus?</AppText><Link href="/(auth)/register" style={styles.footerLink}>Create account</Link></View>}>
      <Controller control={control} name="email" render={({ field }) => <TextField label="Email address" placeholder="you@college.edu" keyboardType="email-address" textContentType="emailAddress" autoComplete="email" returnKeyType="next" value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={errors.email?.message} testID="login-email-input" />} />
      <Controller control={control} name="password" render={({ field }) => <TextField label="Password" placeholder="Enter your password" secureTextEntry secureToggle textContentType="password" autoComplete="password" returnKeyType="done" onSubmitEditing={() => void onSubmit()} value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={errors.password?.message} testID="login-password-input" />} />
      <Link href="/(auth)/forgot-password" style={styles.forgotLink}>Forgot password?</Link>
      {formError ? <View style={styles.errorBox}><Ionicons name="alert-circle" size={18} color="#FCA5A5" /><AppText variant="small" color="#FCA5A5" style={styles.errorText} accessibilityRole="alert">{formError}</AppText></View> : null}
      <Button label="Sign in securely" onPress={onSubmit} loading={isSubmitting} accessibilityHint="Signs you in with your email and password" />
      <View style={styles.trustRow}><Ionicons name="shield-checkmark-outline" size={15} color={color.textTertiary} /><AppText variant="caption" color={color.textTertiary}>Protected with encrypted session storage</AppText></View>
    </AuthScaffold>
  );
}

const styles = StyleSheet.create({
  forgotLink: { alignSelf: "flex-end", ...type.small, color: "#A5B4FC", marginTop: -space.xs },
  errorBox: { padding: space.md, flexDirection: "row", alignItems: "flex-start", gap: space.sm, borderRadius: radius.md, backgroundColor: "rgba(239,68,68,0.09)", borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(239,68,68,0.28)" },
  errorText: { flex: 1 },
  trustRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  footerRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  footerLink: { ...type.small, color: color.textPrimary, fontWeight: "800" },
});
