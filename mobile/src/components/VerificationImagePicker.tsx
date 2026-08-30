import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";

import { AppText } from "@/design-system/components";
import { color, minTouchTarget, radius, space } from "@/design-system/tokens";
import {
  captureFromCamera,
  pickFromLibrary,
  type PickImageError,
} from "@/services/verificationImage";

const ERROR_MESSAGES: Record<Exclude<PickImageError, "cancelled">, string> = {
  permission_denied: "Permission was denied. Enable it in Settings to continue.",
  too_large: "That image is too large — please use one under 5 MB.",
};

export function VerificationImagePicker({
  label,
  value,
  onChange,
  testID,
}: {
  label: string;
  value: string;
  onChange: (dataUri: string) => void;
  testID?: string;
}) {
  const [error, setError] = useState<string | null>(null);

  const runPick = async (pick: () => ReturnType<typeof captureFromCamera>) => {
    const result = await pick();
    if (result.ok) {
      setError(null);
      onChange(result.image.dataUri);
      return;
    }
    if (result.error !== "cancelled") {
      setError(ERROR_MESSAGES[result.error]);
    }
  };

  return (
    <View style={styles.container} testID={testID}>
      <AppText variant="small" color={color.textSecondary} style={styles.label}>
        {label}
      </AppText>
      <View style={styles.preview}>
        {value ? (
          <Image source={{ uri: value }} style={styles.image} resizeMode="cover" />
        ) : (
          <View style={styles.placeholder}>
            <Ionicons name="image-outline" size={28} color={color.textTertiary} />
            <AppText variant="caption" color={color.textTertiary}>
              No image selected
            </AppText>
          </View>
        )}
      </View>
      <View style={styles.actions}>
        <Pressable
          onPress={() => runPick(captureFromCamera)}
          accessibilityRole="button"
          accessibilityLabel={`Take a photo for ${label}`}
          style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}
        >
          <Ionicons name="camera" size={16} color={color.textPrimary} />
          <AppText variant="small">Camera</AppText>
        </Pressable>
        <Pressable
          onPress={() => runPick(pickFromLibrary)}
          accessibilityRole="button"
          accessibilityLabel={`Choose a photo for ${label}`}
          style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}
        >
          <Ionicons name="images" size={16} color={color.textPrimary} />
          <AppText variant="small">Gallery</AppText>
        </Pressable>
      </View>
      {error ? (
        <AppText variant="caption" color={color.destructive} accessibilityRole="alert">
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: space.sm },
  label: { textTransform: "uppercase", letterSpacing: 0.4 },
  preview: {
    aspectRatio: 4 / 3,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.border,
    backgroundColor: color.surface,
    overflow: "hidden",
  },
  image: { width: "100%", height: "100%" },
  placeholder: { flex: 1, alignItems: "center", justifyContent: "center", gap: space.xs },
  actions: { flexDirection: "row", gap: space.sm },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.xs,
    minHeight: minTouchTarget,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.border,
    backgroundColor: color.surfaceElevated,
  },
  pressed: { opacity: 0.85 },
});
