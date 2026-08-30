import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { StyleSheet, View } from "react-native";

import { apiForgotPassword } from "@/api/auth";
import { toApiError } from "@/api/errors";
import { AppText, Button, Screen, TextField } from "@/design-system/components";
import { space } from "@/design-system/tokens";
import { forgotPasswordSchema, type ForgotPasswordFormValues } from "@/validation/auth";

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [sent, setSent] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await apiForgotPassword(values.email);
      // Backend never reveals whether the account exists — always show the
      // same confirmation regardless, to avoid user enumeration.
      setSent(true);
    } catch (error) {
      setFormError(toApiError(error).message);
    }
  });

  if (sent) {
    return (
      <Screen>
        <View style={styles.content}>
          <AppText variant="h1">Check your inbox</AppText>
          <AppText variant="body" color="#A1A1AA" style={styles.subtitle}>
            If an account exists for that email, we&apos;ve sent a link to reset your password.
          </AppText>
          <Button
            label="Back to sign in"
            onPress={() => router.replace("/(auth)/login")}
            variant="secondary"
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.content}>
        <AppText variant="h1">Forgot password</AppText>
        <AppText variant="body" color="#A1A1AA" style={styles.subtitle}>
          Enter your email and we&apos;ll send you a reset link.
        </AppText>

        <View style={styles.form}>
          <Controller
            control={control}
            name="email"
            render={({ field }) => (
              <TextField
                label="Email"
                keyboardType="email-address"
                textContentType="emailAddress"
                autoComplete="email"
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                error={errors.email?.message}
                testID="forgot-password-email-input"
              />
            )}
          />

          {formError ? (
            <AppText variant="small" color="#EF4444" accessibilityRole="alert">
              {formError}
            </AppText>
          ) : null}

          <Button label="Send reset link" onPress={onSubmit} loading={isSubmitting} />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, justifyContent: "center", padding: space.lg, gap: space.lg },
  subtitle: { marginTop: -space.sm },
  form: { gap: space.md },
});
