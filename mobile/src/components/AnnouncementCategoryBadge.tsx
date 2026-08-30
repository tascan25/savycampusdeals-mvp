import { StyleSheet, View } from "react-native";

import { AppText } from "@/design-system/components";
import { color, radius, space } from "@/design-system/tokens";
import type { AnnouncementCategory } from "@/types/announcement";

const CATEGORY_STYLE: Record<AnnouncementCategory, { bg: string; border: string; text: string }> = {
  new: { bg: "rgba(79,70,229,0.12)", border: "rgba(79,70,229,0.3)", text: color.primary },
  important: { bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.3)", text: color.amber },
  limited: { bg: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.3)", text: color.destructive },
};

export function AnnouncementCategoryBadge({ category }: { category: AnnouncementCategory }) {
  const style = CATEGORY_STYLE[category] ?? CATEGORY_STYLE.new;
  return (
    <View style={[styles.badge, { backgroundColor: style.bg, borderColor: style.border }]}>
      <AppText variant="caption" color={style.text} style={styles.label}>
        {category === "new" ? "New drop" : category}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: "flex-start",
    paddingHorizontal: space.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  label: { textTransform: "uppercase", fontWeight: "700", letterSpacing: 0.4 },
});
