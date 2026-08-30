import { Ionicons } from "@expo/vector-icons";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";

import { color, radius, space, type } from "@/design-system/tokens";
import type { Offer } from "@/types/offer";
import { resolveMediaUrl } from "@/utils/media";

export function OfferCard({
  offer,
  onPress,
  onToggleSave,
}: {
  offer: Offer;
  onPress: () => void;
  onToggleSave: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${offer.brand}: ${offer.title}`}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.imageWrap}>
        <Image
          source={{ uri: resolveMediaUrl(offer.image_url) }}
          style={styles.image}
          resizeMode="cover"
        />
        <Pressable
          onPress={(event) => {
            event.stopPropagation();
            onToggleSave();
          }}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={offer.saved ? "Remove from saved" : "Save offer"}
          style={[styles.saveButton, offer.saved && styles.saveButtonActive]}
        >
          <Ionicons name={offer.saved ? "bookmark" : "bookmark-outline"} size={16} color={offer.saved ? "#C7D2FE" : color.textPrimary} />
        </Pressable>
        <View style={styles.imageShade} />
        <View style={styles.discountPill}><Text style={styles.discount} numberOfLines={1}>{offer.discount}</Text></View>
      </View>

      <View style={styles.body}>
        <View style={styles.metaRow}>
          <Text style={styles.meta} numberOfLines={1}>{(offer.categories.length ? offer.categories : [offer.category]).join(" · ")}</Text>
          {offer.trending ? <View style={styles.trendingDot} /> : null}
        </View>
        <Text style={styles.brand} numberOfLines={1}>{offer.brand}</Text>
        <Text style={styles.title} numberOfLines={2}>
          {offer.title}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: radius.lg,
    backgroundColor: color.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.065)",
    overflow: "hidden",
  },
  pressed: { opacity: 0.9 },
  imageWrap: {
    aspectRatio: 16 / 10,
    backgroundColor: color.surfaceElevated,
    justifyContent: "flex-end",
    padding: space.md,
  },
  image: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  imageShade: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "55%",
    backgroundColor: "rgba(0,0,0,0.24)",
  },
  discountPill: { alignSelf: "flex-start", paddingHorizontal: space.sm, paddingVertical: 5, borderRadius: radius.pill, backgroundColor: "rgba(5,5,5,0.78)" },
  discount: { ...type.small, color: color.textPrimary, fontWeight: "800" },
  body: { padding: space.md, gap: 3 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  meta: { ...type.caption, color: color.textTertiary, textTransform: "uppercase" },
  trendingDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: color.success },
  brand: { ...type.bodyMedium, color: color.textPrimary, marginTop: 2 },
  title: { ...type.small, color: color.textSecondary },
  saveButton: {
    position: "absolute",
    top: space.sm,
    right: space.sm,
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    backgroundColor: "rgba(5,5,5,0.72)",
    zIndex: 2,
  },
  saveButtonActive: { backgroundColor: "rgba(79,70,229,0.76)" },
});
