import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppText } from "@/design-system/components";
import { color, radius, space } from "@/design-system/tokens";
import type { SaveOfferFeedbackState } from "@/hooks/useSaveOfferToggle";

export function SaveOfferFeedback({
  feedback,
  bottomOffset = 0,
}: {
  feedback: SaveOfferFeedbackState;
  bottomOffset?: number;
}) {
  const insets = useSafeAreaInsets();

  if (!feedback) return null;

  const failed = feedback.kind === "error";
  const icon = failed ? "alert-circle" : feedback.saved ? "bookmark" : "bookmark-outline";
  const accent = failed ? color.destructive : color.success;

  return (
    <View
      pointerEvents="none"
      accessibilityLiveRegion={failed ? "assertive" : "polite"}
      accessibilityRole={failed ? "alert" : undefined}
      style={[styles.position, { bottom: Math.max(insets.bottom, space.md) + bottomOffset }]}
    >
      <View style={[styles.banner, { borderColor: `${accent}66` }]}>
        <View style={[styles.icon, { backgroundColor: `${accent}20` }]}>
          <Ionicons name={icon} size={21} color={accent} />
        </View>
        <View style={styles.copy}>
          <AppText variant="bodyMedium">{feedback.title}</AppText>
          <AppText variant="small" color={color.textSecondary}>
            {feedback.message}
          </AppText>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  position: {
    position: "absolute",
    left: space.md,
    right: space.md,
    zIndex: 100,
    elevation: 16,
  },
  banner: {
    minHeight: 68,
    paddingHorizontal: space.md,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    backgroundColor: "#17171D",
    shadowColor: "#000000",
    shadowOpacity: 0.32,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
  },
  icon: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
  },
  copy: { flex: 1, gap: 2 },
});
