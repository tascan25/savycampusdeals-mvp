import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from "react-native";

import { apiListOutletCities, apiListOutlets } from "@/api/outlets";
import { queryKeys } from "@/api/queryKeys";
import { NearbyMapPreview } from "@/components/NearbyMapPreview";
import { isOutletOpen, NearbyOutletRow } from "@/components/NearbyOutletRow";
import { AppText } from "@/design-system/components";
import { color, radius, space } from "@/design-system/tokens";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { requestCurrentCoords, type Coords } from "@/services/location";

type LocationState = "idle" | "loading" | "granted" | "denied";

export function OutletsExplorer() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [city, setCity] = useState("all");
  const [cuisine, setCuisine] = useState("all");
  const [openOnly, setOpenOnly] = useState(false);
  const [nearbyOnly, setNearbyOnly] = useState(false);
  const [radiusKm, setRadiusKm] = useState<2 | 5>(5);
  const [coords, setCoords] = useState<Coords | null>(null);
  const [locationState, setLocationState] = useState<LocationState>("idle");
  const debouncedQuery = useDebouncedValue(query, 350);

  const citiesQuery = useQuery({ queryKey: queryKeys.outlets.cities(), queryFn: apiListOutletCities });
  const cities = citiesQuery.data ?? [];
  const filters = {
    city: city === "all" ? undefined : city,
    q: debouncedQuery.trim() || undefined,
    lat: coords?.lat,
    lng: coords?.lng,
    nearby_only: nearbyOnly && Boolean(coords),
    radius_km: radiusKm,
  };
  const outletsQuery = useQuery({ queryKey: queryKeys.outlets.list(filters), queryFn: () => apiListOutlets(filters) });

  const cuisines = useMemo(() => ["all", ...Array.from(new Set((outletsQuery.data ?? []).map((outlet) => outlet.cuisine).filter(Boolean))).sort()], [outletsQuery.data]);
  const visibleOutlets = useMemo(
    () => (outletsQuery.data ?? []).filter((outlet) => {
      if (cuisine !== "all" && outlet.cuisine !== cuisine) return false;
      if (openOnly && isOutletOpen(outlet.hours) !== true) return false;
      return true;
    }),
    [cuisine, openOnly, outletsQuery.data],
  );

  const areaLabel = city !== "all" ? city : visibleOutlets[0]?.city || (coords ? "Current location" : "Nearby campus");

  const requestNearby = async () => {
    if (locationState === "loading") return;
    setLocationState("loading");
    const result = await requestCurrentCoords();
    if (result) {
      setCoords(result);
      setNearbyOnly(true);
      setLocationState("granted");
    } else {
      setNearbyOnly(false);
      setLocationState("denied");
    }
  };

  const toggleNearby = () => {
    if (nearbyOnly) {
      setNearbyOnly(false);
      return;
    }
    if (coords) {
      setNearbyOnly(true);
      return;
    }
    void requestNearby();
  };

  const cycleCity = () => {
    const options = ["all", ...cities];
    const nextIndex = (options.indexOf(city) + 1) % options.length;
    setCity(options[nextIndex] ?? "all");
  };

  const cycleCuisine = () => {
    const nextIndex = (cuisines.indexOf(cuisine) + 1) % cuisines.length;
    setCuisine(cuisines[nextIndex] ?? "all");
  };

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={outletsQuery.isRefetching} onRefresh={() => void outletsQuery.refetch()} tintColor={color.textSecondary} />}
    >
      <Pressable style={styles.locationChip} onPress={cycleCity} accessibilityRole="button" accessibilityLabel={`Area: ${areaLabel}. Tap to change`}>
        <Ionicons name="location" size={16} color={color.textPrimary} />
        <AppText variant="small" numberOfLines={1} style={styles.locationLabel}>{areaLabel}</AppText>
        <Ionicons name="chevron-down" size={15} color={color.textSecondary} />
      </Pressable>

      <View style={styles.search}>
        <Ionicons name="search-outline" size={22} color={color.textSecondary} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search cafés, gyms, stores"
          placeholderTextColor={color.textTertiary}
          style={styles.searchInput}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          testID="outlets-search-input"
        />
        <Ionicons name="options-outline" size={21} color={color.textSecondary} />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
        <Pressable onPress={() => setOpenOnly((value) => !value)} style={[styles.filter, openOnly && styles.filterActive]}>
          <View style={[styles.statusDot, !openOnly && styles.statusDotMuted]} />
          <AppText variant="small" color={openOnly ? "#DDD6FE" : color.textSecondary}>Open now</AppText>
        </Pressable>
        <Pressable onPress={toggleNearby} style={[styles.filter, nearbyOnly && styles.filterActive]}>
          <Ionicons name={locationState === "loading" ? "hourglass-outline" : "navigate-outline"} size={14} color={nearbyOnly ? "#C4B5FD" : color.textSecondary} />
          <AppText variant="small" color={nearbyOnly ? "#DDD6FE" : color.textSecondary}>{locationState === "loading" ? "Locating…" : `Within ${radiusKm} km`}</AppText>
          {nearbyOnly ? <Pressable onPress={(event) => { event.stopPropagation(); setRadiusKm((value) => value === 2 ? 5 : 2); }} hitSlop={8}><Ionicons name="chevron-down" size={14} color="#C4B5FD" /></Pressable> : null}
        </Pressable>
        <Pressable onPress={cycleCuisine} style={[styles.filter, cuisine !== "all" && styles.filterActive]}>
          <AppText variant="small" color={cuisine !== "all" ? "#DDD6FE" : color.textSecondary}>{cuisine === "all" ? "All categories" : cuisine}</AppText>
          <Ionicons name="chevron-down" size={14} color={cuisine !== "all" ? "#C4B5FD" : color.textSecondary} />
        </Pressable>
      </ScrollView>

      {locationState === "denied" ? <AppText variant="caption" color={color.amber} style={styles.locationMessage}>Location access was unavailable. Choose an area above or enable location in Settings.</AppText> : null}

      <NearbyMapPreview outlets={visibleOutlets} areaLabel={areaLabel} locating={locationState === "loading"} onLocate={() => void requestNearby()} onPressOutlet={(outlet) => router.push(`/outlet/${outlet.id}`)} />

      <View style={styles.sheet}>
        <View style={styles.handle} />
        <View style={styles.sheetHeader}>
          <View>
            <AppText variant="h2">Deals around you</AppText>
            <AppText variant="caption" color={color.textTertiary}>{visibleOutlets.length} places found</AppText>
          </View>
          {nearbyOnly ? <AppText variant="caption" color="#A5B4FC">Nearest first</AppText> : null}
        </View>

        {visibleOutlets.length ? visibleOutlets.map((outlet, index) => (
          <View key={outlet.id}>
            <NearbyOutletRow outlet={outlet} onPress={() => router.push(`/outlet/${outlet.id}`)} />
            {index < visibleOutlets.length - 1 ? <View style={styles.divider} /> : null}
          </View>
        )) : (
          <View style={styles.empty}>
            <Ionicons name="location-outline" size={28} color={color.textTertiary} />
            <AppText variant="bodyMedium">No nearby matches</AppText>
            <AppText variant="small" color={color.textTertiary} style={styles.emptyCopy}>Try another area or clear one of the filters.</AppText>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { paddingHorizontal: space.lg, paddingBottom: space.xl },
  locationChip: { alignSelf: "flex-start", maxWidth: "82%", minHeight: 42, paddingHorizontal: space.md, flexDirection: "row", alignItems: "center", gap: space.sm, borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth, borderColor: color.borderStrong, backgroundColor: color.surfaceMuted },
  locationLabel: { flexShrink: 1 },
  search: { minHeight: 58, marginTop: space.md, paddingHorizontal: space.md, flexDirection: "row", alignItems: "center", gap: space.sm, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: color.borderStrong, backgroundColor: color.surfaceMuted },
  searchInput: { flex: 1, color: color.textPrimary, fontSize: 16, paddingVertical: space.md },
  filters: { paddingVertical: space.md, gap: space.sm },
  filter: { minHeight: 42, paddingHorizontal: space.md, flexDirection: "row", alignItems: "center", gap: 7, borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth, borderColor: color.borderStrong, backgroundColor: color.surfaceMuted },
  filterActive: { borderColor: "rgba(124,58,237,0.80)", backgroundColor: "rgba(76,29,149,0.42)" },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: color.success },
  statusDotMuted: { backgroundColor: color.textTertiary },
  locationMessage: { marginBottom: space.md, lineHeight: 17 },
  sheet: { marginTop: space.md, marginHorizontal: -space.md, paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: space.md, borderRadius: radius.xl, borderCurve: "continuous", borderWidth: StyleSheet.hairlineWidth, borderColor: color.border, backgroundColor: color.surface },
  handle: { alignSelf: "center", width: 44, height: 4, marginBottom: space.md, borderRadius: 2, backgroundColor: color.borderStrong },
  sheetHeader: { marginBottom: space.sm, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 104, backgroundColor: color.border },
  empty: { paddingVertical: space.xxl, alignItems: "center", gap: space.sm },
  emptyCopy: { textAlign: "center" },
});
