import { Ionicons } from "@expo/vector-icons";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";

import { color, radius, space, type } from "@/design-system/tokens";
import type { Outlet } from "@/types/outlet";
import { resolveMediaUrl } from "@/utils/media";

export function OutletCard({ outlet, onPress }: { outlet: Outlet; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${outlet.name}, ${outlet.city}`}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.imageWrap}>
        <Image
          source={{ uri: resolveMediaUrl(outlet.image_url) }}
          style={styles.image}
          resizeMode="cover"
        />
        <View style={styles.topRow}>
          <View style={styles.chip}>
            <Ionicons name="location" size={10} color={color.textPrimary} />
            <Text style={styles.chipLabel}>{outlet.city}</Text>
          </View>
          <View style={styles.chip}>
            <Ionicons name="star" size={10} color={color.amber} />
            <Text style={styles.chipLabel}>{outlet.rating.toFixed(1)}</Text>
          </View>
        </View>
        {outlet.is_nearby ? (
          <View style={styles.nearbyBadge}>
            <Ionicons name="navigate" size={10} color={color.background} />
            <Text style={styles.nearbyLabel}>
              {outlet.distance_km != null ? `${outlet.distance_km} km` : "Nearby"}
            </Text>
          </View>
        ) : null}
        <View style={styles.titleWrap}>
          <Text style={styles.cuisine} numberOfLines={1}>
            {outlet.cuisine}
          </Text>
          <Text style={styles.name} numberOfLines={1}>
            {outlet.name}
          </Text>
        </View>
      </View>

      <View style={styles.body}>
        <Text style={styles.tagline} numberOfLines={1}>
          {outlet.tagline}
        </Text>
        <View style={styles.dealsBadge}>
          <Ionicons name="pricetag" size={11} color={color.success} />
          <Text style={styles.dealsLabel}>
            {outlet.offer_count} {outlet.offer_count === 1 ? "deal" : "deals"}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    backgroundColor: color.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.border,
    overflow: "hidden",
  },
  pressed: { opacity: 0.9 },
  imageWrap: {
    aspectRatio: 16 / 10,
    backgroundColor: color.surfaceElevated,
    justifyContent: "flex-end",
  },
  image: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  topRow: {
    position: "absolute",
    top: space.sm,
    left: space.sm,
    right: space.sm,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  nearbyBadge: {
    position: "absolute",
    top: 40,
    left: space.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: space.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: color.success,
  },
  nearbyLabel: { ...type.caption, color: color.background, fontWeight: "700" },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: space.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  chipLabel: { ...type.caption, color: color.textPrimary },
  titleWrap: { padding: space.md },
  cuisine: { ...type.caption, color: "rgba(255,255,255,0.7)", textTransform: "uppercase" },
  name: { ...type.h3, color: color.textPrimary },
  body: {
    padding: space.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.sm,
  },
  tagline: { ...type.small, color: color.textSecondary, flex: 1 },
  dealsBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: space.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: "rgba(34,197,94,0.15)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(34,197,94,0.3)",
  },
  dealsLabel: { ...type.caption, color: color.success },
});
