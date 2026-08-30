import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";

import { StudentAvatar } from "@/components/StudentAvatar";
import { STUDENT_AVATARS } from "@/constants/studentAvatars";
import { AppText, Screen } from "@/design-system/components";
import { color, radius, space } from "@/design-system/tokens";
import { useAuth } from "@/providers/AuthProvider";

export default function AvatarSettingsScreen() {
  const { user, updateProfile } = useAuth();
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  if (!user) return null;

  const choose = async (avatarKey: string) => {
    if (savingKey || avatarKey === user.avatar_key) return;
    setMessage(null);
    setSavingKey(avatarKey || "initials");
    try {
      await updateProfile({ avatar_key: avatarKey });
      setMessage("Avatar updated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Couldn't update your avatar.");
    } finally {
      setSavingKey(null);
    }
  };

  const options = [{ key: "", label: "Initial" }, ...STUDENT_AVATARS];

  return (
    <Screen edges={["bottom"]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.intro}>
          <StudentAvatar avatarKey={user.avatar_key} name={user.name} size={86} />
          <AppText variant="h2">Choose your avatar</AppText>
          <AppText variant="small" color={color.textSecondary} style={styles.subtitle}>Pick a Savvy character for your profile. It stays synced with the website.</AppText>
        </View>

        <View style={styles.grid}>
          {options.map((avatar) => {
            const selected = user.avatar_key === avatar.key;
            const saving = savingKey === (avatar.key || "initials");
            return (
              <Pressable key={avatar.key || "initials"} onPress={() => void choose(avatar.key)} disabled={Boolean(savingKey)} accessibilityRole="button" accessibilityState={{ selected }} accessibilityLabel={`Choose ${avatar.label}`} style={({ pressed }) => [styles.option, selected && styles.optionSelected, pressed && styles.optionPressed]}>
                <StudentAvatar avatarKey={avatar.key} name={user.name} size={62} />
                <AppText variant="caption" color={selected ? "#DDD6FE" : color.textSecondary} numberOfLines={1}>{avatar.label}</AppText>
                {saving ? <ActivityIndicator size="small" color="#A78BFA" style={styles.stateIcon} /> : selected ? <View style={styles.stateIcon}><Ionicons name="checkmark-circle" size={18} color="#A78BFA" /></View> : null}
              </Pressable>
            );
          })}
        </View>
        {message ? <AppText variant="small" color={message === "Avatar updated." ? color.success : color.destructive} style={styles.message}>{message}</AppText> : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, paddingBottom: space.xxl },
  intro: { alignItems: "center", gap: space.sm, marginBottom: space.xl },
  subtitle: { maxWidth: 290, textAlign: "center", lineHeight: 19 },
  grid: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -space.xs },
  option: { width: "33.333%", minHeight: 118, padding: space.sm, alignItems: "center", justifyContent: "center", gap: space.sm, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: "transparent" },
  optionSelected: { borderColor: "rgba(167,139,250,0.55)", backgroundColor: color.primarySoft },
  optionPressed: { opacity: 0.72 },
  stateIcon: { position: "absolute", right: 13, top: 11 },
  message: { marginTop: space.lg, textAlign: "center" },
});
