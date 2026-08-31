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
          <>
            <Image source={{ uri: value }} style={styles.image} resizeMode="cover" />
            <View style={styles.selectedBadge}>
              <Ionicons name="checkmark-circle" size={15} color="#86EFAC" />
              <AppText variant="caption" color="#DCFCE7" style={styles.selectedLabel}>
                Photo added
              </AppText>
            </View>
          </>
        ) : (
          <View style={styles.placeholder}>
            <View style={styles.placeholderIcon}>
              <Ionicons name="image-outline" size={24} color="#C4B5FD" />
            </View>
            <AppText variant="small" color={color.textSecondary}>
              Add a clear, well-lit photo
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
          <Ionicons name="camera-outline" size={17} color="#C4B5FD" />
          <AppText variant="small" color="#DDD6FE" style={styles.actionLabel}>
            Take photo
          </AppText>
        </Pressable>
        <Pressable
          onPress={() => runPick(pickFromLibrary)}
          accessibilityRole="button"
          accessibilityLabel={`Choose a photo for ${label}`}
          style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}
        >
          <Ionicons name="images-outline" size={17} color="#C4B5FD" />
          <AppText variant="small" color="#DDD6FE" style={styles.actionLabel}>
            Choose photo
          </AppText>
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
  label: { fontWeight: "700" },
  preview: {
    height: 154,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: "rgba(167,139,250,0.18)",
    backgroundColor: "rgba(16,16,22,0.92)",
    overflow: "hidden",
  },
  image: { width: "100%", height: "100%" },
  placeholder: { flex: 1, alignItems: "center", justifyContent: "center", gap: space.sm },
  placeholderIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(196,181,253,0.25)",
    backgroundColor: "rgba(124,58,237,0.12)",
  },
  selectedBadge: {
    position: "absolute",
    left: space.sm,
    bottom: space.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: radius.pill,
    backgroundColor: "rgba(5,20,12,0.88)",
  },
  selectedLabel: { fontWeight: "800" },
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
    borderColor: "rgba(167,139,250,0.20)",
    backgroundColor: "rgba(124,58,237,0.09)",
  },
  actionLabel: { fontWeight: "700" },
  pressed: { opacity: 0.85 },
});
