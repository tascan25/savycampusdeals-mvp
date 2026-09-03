import { useState } from "react";
import { Alert, ScrollView, StyleSheet, View } from "react-native";

import { apiChangePassword } from "@/api/profile";
import { toApiError } from "@/api/errors";
import { AppText, Button, Screen, TextField } from "@/design-system/components";
import { color, radius, space } from "@/design-system/tokens";
import { useAuth } from "@/providers/AuthProvider";

export default function ChangePasswordScreen() {
  const { logout } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setError("");
    if (newPassword !== confirmPassword) {
      setError("The new passwords do not match.");
      return;
    }
    if (newPassword.length < 8) {
      setError("Use at least 8 characters for the new password.");
      return;
    }
    setWorking(true);
    try {
      await apiChangePassword(currentPassword, newPassword);
      Alert.alert(
        "Password changed",
        "For security, every signed-in device has been logged out. Sign in again with your new password.",
      );
      await logout();
    } catch (caught) {
      setError(toApiError(caught).message);
    } finally {
      setWorking(false);
    }
  };

  return (
    <Screen edges={["bottom"]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.intro}>
          <AppText variant="h1">Secure your account</AppText>
          <AppText variant="body" color={color.textSecondary}>
            Changing the password signs this account out on every device.
          </AppText>
        </View>
        <View style={styles.form}>
          <TextField
            label="Current password"
            value={currentPassword}
            onChangeText={setCurrentPassword}
            secureTextEntry
            secureToggle
          />
          <TextField
            label="New password"
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry
            secureToggle
          />
          <TextField
            label="Confirm new password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            secureToggle
          />
          {error ? (
            <AppText variant="small" color={color.destructive} accessibilityRole="alert">
              {error}
            </AppText>
          ) : null}
          <Button
            label="Change password"
            onPress={() => void submit()}
            loading={working}
            disabled={!currentPassword || !newPassword || !confirmPassword}
          />
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: space.lg, gap: space.xl },
  intro: { gap: space.sm },
  form: {
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.lg,
    backgroundColor: color.surface,
  },
});
