import { zodResolver } from "@hookform/resolvers/zod";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { StyleSheet, View } from "react-native";

import { apiResetPassword } from "@/api/auth";
import { toApiError } from "@/api/errors";
import { AppText, Button, Screen, TextField } from "@/design-system/components";
import { space } from "@/design-system/tokens";
import { resetPasswordSchema, type ResetPasswordFormValues } from "@/validation/auth";

export default function ResetPasswordScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const router = useRouter();
  const [done, setDone] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    if (!token) {
      setFormError("This reset link is invalid or has expired.");
      return;
    }
    try {
      await apiResetPassword(token, values.password);
      setDone(true);
    } catch (error) {
      setFormError(toApiError(error).message);
    }
  });

  if (done) {
    return (
      <Screen>
        <View style={styles.content}>
          <AppText variant="h1">Password updated</AppText>
          <AppText variant="body" color="#A1A1AA" style={styles.subtitle}>
            Sign in with your new password.
          </AppText>
          <Button label="Back to sign in" onPress={() => router.replace("/(auth)/login")} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.content}>
        <AppText variant="h1">Set a new password</AppText>

        <View style={styles.form}>
          <Controller
            control={control}
            name="password"
            render={({ field }) => (
              <TextField
                label="New password"
                secureTextEntry
                secureToggle
                textContentType="newPassword"
                autoComplete="password-new"
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                error={errors.password?.message}
                testID="reset-password-input"
              />
            )}
          />

          {formError ? (
            <AppText variant="small" color="#EF4444" accessibilityRole="alert">
              {formError}
            </AppText>
          ) : null}

          <Button label="Update password" onPress={onSubmit} loading={isSubmitting} />
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
