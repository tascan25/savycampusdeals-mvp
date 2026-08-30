import { Image, StyleSheet, View } from "react-native";

import { getStudentAvatar } from "@/constants/studentAvatars";
import { AppText } from "@/design-system/components";
import { color } from "@/design-system/tokens";
import { resolveMediaUrl } from "@/utils/media";

export function StudentAvatar({ avatarKey, name, size = 48 }: { avatarKey?: string; name: string; size?: number }) {
  const avatar = getStudentAvatar(avatarKey);
  const initial = name.trim().charAt(0).toUpperCase() || "S";

  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]} accessibilityLabel={avatar ? avatar.label : `${name} initial`}>
      {avatar ? (
        <Image source={{ uri: resolveMediaUrl(avatar.path) }} style={styles.image} resizeMode="cover" />
      ) : (
        <AppText style={{ fontSize: size * 0.36, lineHeight: size * 0.44, fontWeight: "800", color: "#DDD6FE" }}>{initial}</AppText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: { alignItems: "center", justifyContent: "center", overflow: "hidden", borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(167,139,250,0.40)", backgroundColor: color.primarySoft },
  image: { width: "100%", height: "100%" },
});
