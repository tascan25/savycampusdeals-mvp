import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { Image, ScrollView, StyleSheet, View } from "react-native";
import { useState } from "react";

import { apiListOffers } from "@/api/offers";
import { apiListOutlets } from "@/api/outlets";
import { apiGetPartnerProfile } from "@/api/partner";
import { queryKeys } from "@/api/queryKeys";
import { LoadingShimmer } from "@/components/LoadingShimmer";
import { AppText, Screen, SearchField, SegmentedControl } from "@/design-system/components";
import { color, radius, space } from "@/design-system/tokens";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { resolveMediaUrl } from "@/utils/media";

type Segment = "offers" | "outlets";

export default function PartnerExploreScreen() {
  const [segment, setSegment] = useState<Segment>("offers");
  const [search, setSearch] = useState("");
  const q = useDebouncedValue(search, 350).trim() || undefined;
  const profile = useQuery({
    queryKey: queryKeys.partner.profile(),
    queryFn: apiGetPartnerProfile,
  });
  const offers = useQuery({
    queryKey: queryKeys.offers.list({ partner: true, q }),
    queryFn: () => apiListOffers({ q }),
  });
  const outlets = useQuery({
    queryKey: queryKeys.outlets.list({ partner: true, q }),
    queryFn: () => apiListOutlets({ q }),
  });
  const loading =
    profile.isLoading || (segment === "offers" ? offers.isLoading : outlets.isLoading);
  const ownOutletId = profile.data?.outlet?.id;

  return (
    <Screen edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View>
          <AppText variant="caption" color={color.success} style={styles.eyebrow}>
            PUBLIC MARKETPLACE
          </AppText>
          <AppText variant="h1">Explore</AppText>
          <AppText variant="small" color={color.textSecondary}>
            Browse-only access to Savvy deals
          </AppText>
        </View>
        <SegmentedControl
          options={[
            { value: "offers", label: "Offers" },
            { value: "outlets", label: "Outlets" },
          ]}
          value={segment}
          onChange={setSegment}
        />
        <SearchField
          value={search}
          onChangeText={setSearch}
          placeholder={segment === "offers" ? "Search public offers" : "Search outlets"}
        />
        {loading
          ? [0, 1, 2, 3].map((item) => <LoadingShimmer key={item} style={styles.shimmer} />)
          : segment === "offers"
            ? (offers.data ?? []).map((offer) => (
                <View key={offer.id} style={styles.card}>
                  <Image source={{ uri: resolveMediaUrl(offer.image_url) }} style={styles.image} />
                  <View style={styles.cardBody}>
                    <View style={styles.badgeRow}>
                      {offer.outlet_id === ownOutletId ? (
                        <View style={styles.yours}>
                          <AppText variant="caption" color={color.success}>
                            YOUR OUTLET
                          </AppText>
                        </View>
                      ) : null}
                      <AppText variant="caption" color={color.textTertiary}>
                        {offer.offer_type === "listed_brand" ? "ONLINE" : "PARTNER"}
                      </AppText>
                    </View>
                    <AppText variant="h3">{offer.discount}</AppText>
                    <AppText variant="bodyMedium">{offer.brand}</AppText>
                    <AppText variant="small" color={color.textSecondary}>
                      {offer.title}
                    </AppText>
                    <AppText variant="caption" color={color.textTertiary} numberOfLines={3}>
                      {offer.description}
                    </AppText>
                  </View>
                </View>
              ))
            : (outlets.data ?? []).map((outlet) => (
                <View key={outlet.id} style={styles.outletCard}>
                  <Image
                    source={{ uri: resolveMediaUrl(outlet.image_url || outlet.logo_url) }}
                    style={styles.outletImage}
                  />
                  <View style={styles.outletCopy}>
                    <View style={styles.badgeRow}>
                      <AppText variant="bodyMedium" style={styles.flex}>
                        {outlet.name}
                      </AppText>
                      {outlet.id === ownOutletId ? (
                        <View style={styles.yours}>
                          <AppText variant="caption" color={color.success}>
                            YOUR OUTLET
                          </AppText>
                        </View>
                      ) : null}
                    </View>
                    <AppText variant="small" color={color.textSecondary}>
                      {outlet.cuisine} · {outlet.city}
                    </AppText>
                    <AppText variant="caption" color={color.textTertiary}>
                      {outlet.offer_count} public offer{outlet.offer_count === 1 ? "" : "s"}
                    </AppText>
                  </View>
                </View>
              ))}
        {!loading && segment === "offers" && !offers.data?.length ? (
          <View style={styles.empty}>
            <Ionicons name="search-outline" size={26} color={color.textTertiary} />
            <AppText>No offers found</AppText>
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, paddingBottom: 120, gap: space.md },
  eyebrow: { letterSpacing: 1.8, fontWeight: "800" },
  shimmer: { height: 210, borderRadius: radius.lg },
  card: {
    borderRadius: radius.lg,
    overflow: "hidden",
    backgroundColor: color.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.border,
  },
  image: { width: "100%", aspectRatio: 16 / 8, backgroundColor: color.surfaceElevated },
  cardBody: { padding: space.md, gap: 4 },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.sm,
  },
  yours: {
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "rgba(34,197,94,0.12)",
  },
  outletCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    padding: space.sm,
    borderRadius: radius.lg,
    backgroundColor: color.surface,
  },
  outletImage: {
    width: 72,
    height: 72,
    borderRadius: radius.md,
    backgroundColor: color.surfaceElevated,
  },
  outletCopy: { flex: 1, gap: 4 },
  flex: { flex: 1 },
  empty: { minHeight: 180, alignItems: "center", justifyContent: "center", gap: space.sm },
});
