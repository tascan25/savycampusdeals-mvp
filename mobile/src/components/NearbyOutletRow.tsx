import { Ionicons } from "@expo/vector-icons";
import { Image, Pressable, StyleSheet, View } from "react-native";

import { AppText } from "@/design-system/components";
import { color, radius, space } from "@/design-system/tokens";
import type { Outlet } from "@/types/outlet";
import { resolveMediaUrl } from "@/utils/media";

export function isOutletOpen(hours: string, now = new Date()): boolean | null {
  const match = hours.toLowerCase().match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)\s*[–—-]\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)/);
  if (!match) return null;
  const toMinutes = (hourText: string, minuteText: string | undefined, suffix: string) => {
    let hour = Number(hourText) % 12;
    if (suffix === "pm") hour += 12;
    return hour * 60 + Number(minuteText ?? 0);
  };
  const opens = toMinutes(match[1] as string, match[2], match[3] as string);
  const closes = toMinutes(match[4] as string, match[5], match[6] as string);
  const current = now.getHours() * 60 + now.getMinutes();
  return closes <= opens ? current >= opens || current < closes : current >= opens && current < closes;
}

export function NearbyOutletRow({ outlet, onPress }: { outlet: Outlet; onPress: () => void }) {
  const open = isOutletOpen(outlet.hours);
  // Match the website: compact/list surfaces use the thumbnail (`image_url`),
  // while the outlet detail hero uses the wider `cover_url`.
  const image = outlet.image_url || outlet.logo_url;

  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${outlet.name}, ${outlet.offer_count} student deals`} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <Image source={{ uri: resolveMediaUrl(image) }} style={styles.image} />
      <View style={styles.copy}>
        <View style={styles.titleRow}>
          <AppText variant="bodyMedium" numberOfLines={1} style={styles.name}>{outlet.name}</AppText>
          {outlet.distance_km != null ? <AppText variant="caption" color={color.textSecondary}>{outlet.distance_km} km</AppText> : null}
        </View>
        <View style={styles.offerRow}>
          <View style={styles.dealPill}><AppText variant="caption" style={styles.dealLabel}>{outlet.offer_count} {outlet.offer_count === 1 ? "DEAL" : "DEALS"}</AppText></View>
          <AppText variant="caption" color={color.textSecondary} numberOfLines={1} style={styles.tagline}>{outlet.tagline || outlet.cuisine}</AppText>
        </View>
        <View style={styles.hoursRow}>
          <AppText variant="caption" color={open === false ? color.textSecondary : color.success}>{open === false ? "Closed" : open === true ? "Open" : "Hours"}</AppText>
          <AppText variant="caption" color={color.textTertiary}>·</AppText>
          <AppText variant="caption" color={color.textTertiary} numberOfLines={1} style={styles.hours}>{outlet.hours || outlet.city}</AppText>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={18} color={color.textSecondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: 112, flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: space.sm },
  pressed: { opacity: 0.82 },
  image: { width: 88, height: 88, borderRadius: radius.md, backgroundColor: color.surfaceElevated },
  copy: { flex: 1, gap: 7 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  name: { flex: 1 },
  offerRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  dealPill: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, backgroundColor: color.primary },
  dealLabel: { fontSize: 10, lineHeight: 13, fontWeight: "800" },
  tagline: { flex: 1 },
  hoursRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  hours: { flex: 1 },
});
