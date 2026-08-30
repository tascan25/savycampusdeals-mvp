import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from "react-native";

import { AppText, Button, Screen, TextField } from "@/design-system/components";
import { color, radius, space } from "@/design-system/tokens";
import { useAuth } from "@/providers/AuthProvider";

export default function DeleteAccountScreen() {
  const { deleteAccount } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canDelete = password.length > 0 && confirmation.trim().toUpperCase() === "DELETE";

  const removeAccount = async () => {
    setDeleting(true); setError(null);
    try { await deleteAccount(password); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Account deletion couldn't be completed."); setDeleting(false); }
  };

  return <Screen edges={["bottom"]}>
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.intro}><AppText variant="h1">Delete your account</AppText><AppText variant="body" color={color.textSecondary}>This permanently removes your profile, verification images, saved offers, coupons, points history and active sessions.</AppText></View>
        <View style={styles.warning}><AppText variant="bodyMedium" color={color.destructive}>This cannot be undone</AppText><AppText variant="small" color={color.textSecondary}>You will need to create and verify a new account if you return later.</AppText></View>
        <View style={styles.form}>
          <TextField label="Current password" value={password} onChangeText={setPassword} secureTextEntry secureToggle autoComplete="password" />
          <TextField label="Type DELETE to confirm" value={confirmation} onChangeText={setConfirmation} autoCapitalize="characters" autoCorrect={false} />
        </View>
        {error ? <AppText variant="small" color={color.destructive} accessibilityRole="alert">{error}</AppText> : null}
        <Button label="Permanently delete account" variant="destructive" onPress={removeAccount} disabled={!canDelete} loading={deleting} />
      </ScrollView>
    </KeyboardAvoidingView>
  </Screen>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 }, content: { padding: space.lg, paddingBottom: space.xxl, gap: space.xl }, intro: { gap: space.sm }, warning: { padding: space.md, borderRadius: radius.lg, backgroundColor: "rgba(239,68,68,0.08)", borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(239,68,68,0.24)", gap: space.xs }, form: { gap: space.md },
});
