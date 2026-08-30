import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, View, type DimensionValue } from "react-native";

import { AppText } from "@/design-system/components";
import { color, radius, space } from "@/design-system/tokens";
import type { Outlet } from "@/types/outlet";

const FALLBACK_POSITIONS = [
  { left: 49, top: 48 },
  { left: 22, top: 65 },
  { left: 76, top: 29 },
  { left: 72, top: 70 },
  { left: 34, top: 25 },
];

function markerPosition(outlet: Outlet, outlets: Outlet[], index: number) {
  const located = outlets.filter((item) => item.lat != null && item.lng != null);
  if (outlet.lat == null || outlet.lng == null || located.length < 2) {
    return FALLBACK_POSITIONS[index % FALLBACK_POSITIONS.length] ?? FALLBACK_POSITIONS[0]!;
  }

  const lats = located.map((item) => item.lat as number);
  const lngs = located.map((item) => item.lng as number);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  if (maxLat - minLat < 0.0001 || maxLng - minLng < 0.0001) {
    return FALLBACK_POSITIONS[index % FALLBACK_POSITIONS.length] ?? FALLBACK_POSITIONS[0]!;
  }

  return {
    left: 12 + ((outlet.lng - minLng) / (maxLng - minLng)) * 76,
    top: 15 + (1 - (outlet.lat - minLat) / (maxLat - minLat)) * 66,
  };
}

export function NearbyMapPreview({
  outlets,
  areaLabel,
  locating,
  onLocate,
  onPressOutlet,
}: {
  outlets: Outlet[];
  areaLabel: string;
  locating: boolean;
  onLocate: () => void;
  onPressOutlet: (outlet: Outlet) => void;
}) {
  const markers = outlets.slice(0, 5);

  return (
    <View style={styles.map} accessibilityLabel={`Nearby outlet map for ${areaLabel}`}>
      <View style={[styles.road, styles.roadOne]} />
      <View style={[styles.road, styles.roadTwo]} />
      <View style={[styles.road, styles.roadThree]} />
      <View style={[styles.road, styles.roadFour]} />
      <View style={[styles.street, styles.streetOne]} />
      <View style={[styles.street, styles.streetTwo]} />
      <View style={[styles.street, styles.streetThree]} />

      <AppText variant="caption" color="rgba(255,255,255,0.45)" style={styles.areaTop}>{areaLabel.toUpperCase()}</AppText>
      <AppText variant="caption" color="rgba(255,255,255,0.35)" style={styles.areaBottom}>CAMPUS AREA</AppText>

      {markers.map((outlet, index) => {
        const position = markerPosition(outlet, markers, index);
        const primary = index === 0;
        return (
          <Pressable
            key={outlet.id}
            onPress={() => onPressOutlet(outlet)}
            accessibilityRole="button"
            accessibilityLabel={`${outlet.name}, ${outlet.offer_count} deals`}
            style={[
              styles.markerAnchor,
              { left: `${position.left}%` as DimensionValue, top: `${position.top}%` as DimensionValue },
            ]}
          >
            {primary ? (
              <View style={styles.primaryPin}>
                <AppText variant="caption" style={styles.primaryPinText}>{outlet.offer_count}</AppText>
                <View style={styles.pinTip} />
              </View>
            ) : (
              <View style={styles.dotMarker} />
            )}
          </Pressable>
        );
      })}

      <Pressable onPress={onLocate} accessibilityRole="button" accessibilityLabel="Use current location" style={styles.locateButton}>
        <Ionicons name={locating ? "hourglass-outline" : "locate"} size={20} color={color.textPrimary} />
      </Pressable>
      <View style={styles.mapLabel}>
        <Ionicons name="map-outline" size={12} color="#A5B4FC" />
        <AppText variant="caption" color="#C7D2FE">LIVE AREA PREVIEW</AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  map: {
    height: 250,
    borderRadius: radius.lg,
    borderCurve: "continuous",
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "#0C1018",
  },
  road: { position: "absolute", height: 12, width: "145%", borderRadius: 8, backgroundColor: "#1B202B" },
  roadOne: { left: -70, top: 44, transform: [{ rotate: "-31deg" }] },
  roadTwo: { left: -60, top: 145, transform: [{ rotate: "22deg" }] },
  roadThree: { left: -42, top: 205, transform: [{ rotate: "-11deg" }] },
  roadFour: { left: 84, top: 118, transform: [{ rotate: "82deg" }] },
  street: { position: "absolute", height: 2, width: "130%", backgroundColor: "#171C25" },
  streetOne: { left: -35, top: 85, transform: [{ rotate: "7deg" }] },
  streetTwo: { left: -45, top: 185, transform: [{ rotate: "38deg" }] },
  streetThree: { left: 20, top: 112, transform: [{ rotate: "-48deg" }] },
  areaTop: { position: "absolute", top: space.lg, left: space.md, maxWidth: 120, letterSpacing: 0.5 },
  areaBottom: { position: "absolute", bottom: space.lg, left: space.md, letterSpacing: 0.5 },
  markerAnchor: { position: "absolute", width: 44, height: 54, marginLeft: -22, marginTop: -27, alignItems: "center", justifyContent: "center" },
  dotMarker: { width: 17, height: 17, borderRadius: 9, borderWidth: 2, borderColor: "#D8D7FF", backgroundColor: color.primary, shadowColor: color.primary, shadowOpacity: 0.65, shadowRadius: 7 },
  primaryPin: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: "#8B5CF6", backgroundColor: "#4C1D95", shadowColor: "#7C3AED", shadowOpacity: 0.65, shadowRadius: 12 },
  primaryPinText: { fontSize: 16, lineHeight: 20, fontWeight: "800" },
  pinTip: { position: "absolute", bottom: -8, width: 15, height: 15, backgroundColor: "#4C1D95", borderRightWidth: 3, borderBottomWidth: 3, borderColor: "#8B5CF6", transform: [{ rotate: "45deg" }] },
  locateButton: { position: "absolute", right: space.md, bottom: space.md, width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", borderWidth: StyleSheet.hairlineWidth, borderColor: color.borderStrong, backgroundColor: "rgba(5,5,7,0.88)" },
  mapLabel: { position: "absolute", top: space.sm, right: space.sm, flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: space.sm, paddingVertical: 5, borderRadius: radius.pill, backgroundColor: "rgba(5,5,7,0.75)" },
});
