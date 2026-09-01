import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";

import { apiListOfferCategories, apiListOffers, apiToggleSaveOffer } from "@/api/offers";
import { apiListOutlets } from "@/api/outlets";
import { queryKeys } from "@/api/queryKeys";
import { OfferCard } from "@/components/OfferCard";
import { StudentAvatar } from "@/components/StudentAvatar";
import { AppText, Screen } from "@/design-system/components";
import { color, radius, space } from "@/design-system/tokens";
import { useAuth } from "@/providers/AuthProvider";
import { cancelSavedOfferReminder } from "@/services/localNotifications";
import { getCurrentCoordsIfGranted, type Coords } from "@/services/location";
import type { Offer } from "@/types/offer";
import type { Outlet } from "@/types/outlet";
import { getRotatingSalutation, getTimeGreeting } from "@/utils/greeting";
import { resolveMediaUrl } from "@/utils/media";

function FeaturedHero({
  offer,
  width,
  onPress,
  onToggleSave,
}: {
  offer: Offer;
  width: number;
  onPress: () => void;
  onToggleSave: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${offer.brand}: ${offer.title}`}
      style={({ pressed }) => [styles.hero, { width }, pressed && styles.pressed]}
    >
      <Image source={{ uri: resolveMediaUrl(offer.image_url) }} style={styles.heroImage} />
      <View style={styles.heroShade} />
      <View style={styles.heroTopRow}>
        <View style={styles.editorPick}>
          <View style={styles.editorDot} />
          <AppText variant="caption" style={styles.editorText}>
            TODAY&apos;S PICK
          </AppText>
        </View>
        <Pressable
          onPress={(event) => {
            event.stopPropagation();
            onToggleSave();
          }}
          accessibilityRole="button"
          accessibilityLabel={offer.saved ? "Remove from saved" : "Save offer"}
          style={styles.saveButton}
        >
          <Ionicons
            name={offer.saved ? "bookmark" : "bookmark-outline"}
            size={19}
            color="#FFFFFF"
          />
        </Pressable>
      </View>
      <View style={styles.heroCopy}>
        <AppText
          style={styles.heroDiscount}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.75}
        >
          {offer.discount}
        </AppText>
        <AppText style={styles.heroBrand} numberOfLines={1}>
          {offer.brand}
        </AppText>
        <AppText style={styles.heroTitle} numberOfLines={2}>
          {offer.title}
        </AppText>
        <View style={styles.heroCta}>
          <AppText
            variant="small"
            style={styles.heroCtaText}
            numberOfLines={1}
            maxFontSizeMultiplier={1.2}
          >
            View offer
          </AppText>
          <Ionicons name="arrow-forward" size={15} color="#111114" />
        </View>
      </View>
    </Pressable>
  );
}

const actions = [
  {
    label: "All deals",
    asset: require("../../assets/home-shortcuts/all-deals.png"),
    route: { pathname: "/(tabs)/explore", params: { tab: "deals" } },
  },
  {
    label: "Nearby",
    asset: require("../../assets/home-shortcuts/nearby.png"),
    route: { pathname: "/(tabs)/explore", params: { tab: "outlets" } },
  },
  {
    label: "Saved",
    asset: require("../../assets/home-shortcuts/saved.png"),
    route: { pathname: "/saved" },
  },
  {
    label: "Student ID",
    asset: require("../../assets/home-shortcuts/student-id.png"),
    route: { pathname: "/(tabs)/card" },
  },
];

const SPOTLIGHT_BRANDS = ["IndiGo", "Air India", "GitHub", "Cult.fit", "Spotify"] as const;

function normalizeBrand(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function getSpotlightWidth(viewportWidth: number): number {
  return Math.max(268, viewportWidth - 88);
}

function formatDistanceFromYou(outlet: Outlet): string | null {
  const distance = outlet.distance_km;
  if (distance == null || !outlet.is_nearby) return null;
  if (distance < 1) return `${Math.round(distance * 1000)} m from you`;
  return `${distance.toLocaleString("en-IN", { maximumFractionDigits: 1 })} km from you`;
}

function OutletTile({
  outlet,
  offer,
  width,
  onPress,
}: {
  outlet: Outlet;
  offer?: Offer;
  width: number;
  onPress: () => void;
}) {
  const distanceLabel = formatDistanceFromYou(outlet);
  const offerLead =
    offer?.discount ||
    `${outlet.offer_count} student ${outlet.offer_count === 1 ? "deal" : "deals"}`;
  const offerDetail = outlet.tagline || offer?.title || outlet.cuisine;
  const locationLabel = [distanceLabel, outlet.address || outlet.city]
    .filter(Boolean)
    .join("  |  ");

  return (
    <Pressable
      style={({ pressed }) => [styles.outletTile, { width }, pressed && styles.pressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Open ${outlet.name}`}
    >
      <View style={styles.outletVisual}>
        <Image
          source={{ uri: resolveMediaUrl(outlet.image_url || outlet.logo_url) }}
          style={styles.outletImage}
        />
        <View style={styles.outletShade} />
        <View style={styles.outletRating}>
          <Ionicons name="star" size={12} color="#FBBF24" />
          <AppText variant="caption" style={styles.outletRatingText}>
            {outlet.rating.toFixed(1)}
          </AppText>
        </View>
        <View style={styles.outletOpenButton}>
          <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
        </View>
      </View>

      <LinearGradient
        colors={["#5B21E8", "#38139B", "#151124"]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={styles.outletOfferStrip}
      >
        <Ionicons name="pricetag" size={16} color="#FFFFFF" />
        <AppText style={styles.outletOfferText} numberOfLines={1}>
          <AppText style={styles.outletOfferLead}>{offerLead}</AppText>
          {offerDetail ? `  •  ${offerDetail}` : ""}
        </AppText>
      </LinearGradient>

      <View style={styles.outletCopy}>
        <AppText style={styles.outletName} numberOfLines={1}>
          {outlet.name}
        </AppText>
        <View style={styles.outletLocationRow}>
          <Ionicons name="location-outline" size={14} color={color.textTertiary} />
          <AppText style={styles.outletMeta} numberOfLines={1}>
            {locationLabel || outlet.city || "Near campus"}
          </AppText>
        </View>
      </View>
    </Pressable>
  );
}

export default function HomeTab() {
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const spotlightRef = useRef<ScrollView>(null);
  const outletRef = useRef<ScrollView>(null);
  const [spotlightScrollX] = useState(() => new Animated.Value(0));
  const [outletScrollX] = useState(() => new Animated.Value(0));
  const { width: viewportWidth } = useWindowDimensions();
  const [now, setNow] = useState(() => new Date());
  const [spotlightIndex, setSpotlightIndex] = useState(0);
  const [outletIndex, setOutletIndex] = useState(0);
  const [coords, setCoords] = useState<Coords | null>(null);
  const featured = useQuery({
    queryKey: queryKeys.offers.list({ sort: "featured" }),
    queryFn: () => apiListOffers({ sort: "featured" }),
  });
  const trending = useQuery({
    queryKey: queryKeys.offers.list({ sort: "trending" }),
    queryFn: () => apiListOffers({ sort: "trending" }),
  });
  const outlets = useQuery({
    queryKey: queryKeys.outlets.list({ home: true }),
    queryFn: () => apiListOutlets({}),
  });
  const locatedOutlets = useQuery({
    queryKey: queryKeys.outlets.list({ homeLocation: true, lat: coords?.lat, lng: coords?.lng }),
    queryFn: () => apiListOutlets({ lat: coords?.lat, lng: coords?.lng }),
    enabled: Boolean(coords),
  });
  const categoriesQuery = useQuery({
    queryKey: queryKeys.offers.categories(),
    queryFn: apiListOfferCategories,
  });

  const toggleSave = async (offer: Offer) => {
    const result = await apiToggleSaveOffer(offer.id);
    if (!result.saved && user) await cancelSavedOfferReminder(user.id, offer.id);
    await queryClient.invalidateQueries({ queryKey: queryKeys.offers.all() });
  };

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void getCurrentCoordsIfGranted().then((result) => {
        if (active && result) setCoords(result);
      });
      return () => {
        active = false;
      };
    }, []),
  );

  const allOffers = useMemo(() => {
    const unique = new Map<string, Offer>();
    for (const offer of [...(featured.data ?? []), ...(trending.data ?? [])])
      unique.set(offer.id, offer);
    return Array.from(unique.values());
  }, [featured.data, trending.data]);

  const brandSpotlightOffers = useMemo(() => {
    return SPOTLIGHT_BRANDS.map((brand) =>
      allOffers.find((offer) => normalizeBrand(offer.brand) === normalizeBrand(brand)),
    ).filter((offer): offer is Offer => Boolean(offer));
  }, [allOffers]);

  const locationResultsAreLocal = Boolean(
    coords && locatedOutlets.data?.some((outlet) => outlet.is_nearby),
  );
  const homeOutlets = useMemo(
    () => (locationResultsAreLocal ? (locatedOutlets.data ?? []) : (outlets.data ?? [])),
    [locatedOutlets.data, locationResultsAreLocal, outlets.data],
  );

  const localOutletOffers = useMemo(() => {
    const partnerOffers = allOffers.filter(
      (offer) => offer.offer_type === "partner_outlet" && Boolean(offer.outlet_id),
    );
    return homeOutlets
      .map((outlet) => partnerOffers.find((offer) => offer.outlet_id === outlet.id))
      .filter((offer): offer is Offer => Boolean(offer))
      .slice(0, 3);
  }, [allOffers, homeOutlets]);

  const spotlightOffers = useMemo(() => {
    const mixed: Offer[] = [];
    const total = Math.max(brandSpotlightOffers.length, localOutletOffers.length);
    for (let index = 0; index < total; index += 1) {
      const brandOffer = brandSpotlightOffers[index];
      const outletOffer = localOutletOffers[index];
      if (brandOffer) mixed.push(brandOffer);
      if (outletOffer) mixed.push(outletOffer);
    }
    return mixed;
  }, [brandSpotlightOffers, localOutletOffers]);

  useEffect(() => {
    if (spotlightOffers.length < 2) return;
    const initialIndex = 1;
    const frame = requestAnimationFrame(() => {
      const stride = getSpotlightWidth(viewportWidth) + space.md;
      spotlightRef.current?.scrollTo({ x: initialIndex * stride, animated: false });
      setSpotlightIndex(initialIndex);
    });
    return () => cancelAnimationFrame(frame);
  }, [spotlightOffers.length, viewportWidth]);

  useEffect(() => {
    if (spotlightOffers.length < 2) return;
    const timer = setInterval(() => {
      setSpotlightIndex((current) => {
        const next = (current + 1) % spotlightOffers.length;
        const stride = getSpotlightWidth(viewportWidth) + space.md;
        spotlightRef.current?.scrollTo({ x: next * stride, animated: true });
        return next;
      });
    }, 4_500);
    return () => clearInterval(timer);
  }, [spotlightOffers.length, viewportWidth]);

  const firstName = user?.name?.trim().split(/\s+/)[0] || "there";
  const timeGreeting = getTimeGreeting(now);
  const salutation = getRotatingSalutation(now);
  const spotlightOutletIds = new Set(
    localOutletOffers.map((offer) => offer.outlet_id).filter(Boolean),
  );
  const outletRecommendation = allOffers.find(
    (offer) =>
      offer.offer_type === "partner_outlet" &&
      Boolean(offer.outlet_id) &&
      !spotlightOutletIds.has(offer.outlet_id),
  );
  const campusPicks = homeOutlets
    .filter(
      (outlet) =>
        !spotlightOutletIds.has(outlet.id) &&
        outlet.id !== outletRecommendation?.outlet_id &&
        Boolean(outlet.image_url || outlet.logo_url),
    )
    .slice(0, 5);
  const campusOfferByOutletId = useMemo(() => {
    const offersByOutlet = new Map<string, Offer>();
    for (const offer of allOffers) {
      if (offer.outlet_id && !offersByOutlet.has(offer.outlet_id)) {
        offersByOutlet.set(offer.outlet_id, offer);
      }
    }
    return offersByOutlet;
  }, [allOffers]);
  const spotlightOfferIds = new Set(spotlightOffers.map((offer) => offer.id));
  const perplexityOffer = allOffers.find((offer) => normalizeBrand(offer.brand) === "perplexity");
  const moreBrandOffers = [
    ...(perplexityOffer ? [perplexityOffer] : []),
    ...allOffers.filter(
      (offer) =>
        offer.offer_type === "listed_brand" &&
        offer.id !== perplexityOffer?.id &&
        !spotlightOfferIds.has(offer.id),
    ),
  ].slice(0, 2);
  const recommendations = [
    ...(outletRecommendation ? [outletRecommendation] : []),
    ...moreBrandOffers,
  ];
  const categories = (categoriesQuery.data ?? []).filter((category) => category.name).slice(0, 8);
  const spotlightWidth = getSpotlightWidth(viewportWidth);
  const spotlightStride = spotlightWidth + space.md;
  const spotlightSideInset = Math.max(space.md, (viewportWidth - spotlightStride) / 2);
  const outletWidth = Math.max(264, viewportWidth - 88);
  const outletStride = outletWidth + space.md;
  const outletSideInset = Math.max(space.md, (viewportWidth - outletStride) / 2);
  const refreshing =
    featured.isRefetching ||
    trending.isRefetching ||
    outlets.isRefetching ||
    locatedOutlets.isRefetching ||
    categoriesQuery.isRefetching;

  useEffect(() => {
    if (campusPicks.length < 2) return;
    const timer = setInterval(() => {
      setOutletIndex((current) => {
        const next = (current + 1) % campusPicks.length;
        outletRef.current?.scrollTo({ x: next * outletStride, animated: true });
        return next;
      });
    }, 5_500);
    return () => clearInterval(timer);
  }, [campusPicks.length, outletStride]);

  return (
    <Screen edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              void featured.refetch();
              void trending.refetch();
              void outlets.refetch();
              if (coords) void locatedOutlets.refetch();
              void categoriesQuery.refetch();
            }}
            tintColor={color.textSecondary}
          />
        }
      >
        <View style={styles.header}>
          <View>
            <AppText variant="caption" color={color.textTertiary} style={styles.eyebrow}>
              {timeGreeting.toUpperCase()}
            </AppText>
            <View style={styles.greetingRow}>
              <AppText variant="h1" style={styles.greeting}>
                {salutation}, {firstName}
              </AppText>
              {user?.verification_status === "approved" ? (
                <Ionicons name="checkmark-circle" size={18} color={color.success} />
              ) : null}
            </View>
          </View>
          <Pressable
            style={styles.avatar}
            onPress={() => router.push("/(tabs)/profile")}
            accessibilityRole="button"
            accessibilityLabel="Open profile"
          >
            <StudentAvatar avatarKey={user?.avatar_key} name={user?.name || firstName} size={44} />
          </Pressable>
        </View>

        <Pressable
          style={styles.search}
          onPress={() => router.push("/(tabs)/explore")}
          accessibilityRole="search"
          accessibilityLabel="Search deals and outlets"
        >
          <Ionicons name="search" size={20} color={color.textSecondary} />
          <AppText variant="body" color={color.textTertiary} style={styles.searchText}>
            Search deals, cafés and stores
          </AppText>
          <View style={styles.searchFilter}>
            <Ionicons name="options-outline" size={17} color={color.textSecondary} />
          </View>
        </Pressable>

        {spotlightOffers.length ? (
          <View style={styles.spotlightSection}>
            <View style={styles.spotlightHeading}>
              <View style={styles.spotlightHeadingCopy}>
                <AppText variant="h2">Today&apos;s picks</AppText>
                <AppText variant="small" color={color.textTertiary}>
                  Brands and local outlet deals
                </AppText>
              </View>
            </View>
            <Animated.ScrollView
              ref={spotlightRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              snapToInterval={spotlightStride}
              decelerationRate="fast"
              disableIntervalMomentum
              contentContainerStyle={[
                styles.spotlightRail,
                { paddingHorizontal: spotlightSideInset },
              ]}
              scrollEventThrottle={16}
              onScroll={Animated.event(
                [{ nativeEvent: { contentOffset: { x: spotlightScrollX } } }],
                { useNativeDriver: true },
              )}
              onMomentumScrollEnd={(event) =>
                setSpotlightIndex(
                  Math.max(
                    0,
                    Math.min(
                      spotlightOffers.length - 1,
                      Math.round(event.nativeEvent.contentOffset.x / spotlightStride),
                    ),
                  ),
                )
              }
            >
              {spotlightOffers.map((offer, index) => {
                const inputRange = [
                  (index - 1) * spotlightStride,
                  index * spotlightStride,
                  (index + 1) * spotlightStride,
                ];
                const scale = spotlightScrollX.interpolate({
                  inputRange,
                  outputRange: [0.86, 1, 0.86],
                  extrapolate: "clamp",
                });
                const opacity = spotlightScrollX.interpolate({
                  inputRange,
                  outputRange: [0.52, 1, 0.52],
                  extrapolate: "clamp",
                });
                const translateY = spotlightScrollX.interpolate({
                  inputRange,
                  outputRange: [18, 0, 18],
                  extrapolate: "clamp",
                });

                return (
                  <Animated.View
                    key={offer.id}
                    style={[
                      styles.spotlightItem,
                      { width: spotlightStride, opacity, transform: [{ translateY }, { scale }] },
                    ]}
                  >
                    <FeaturedHero
                      offer={offer}
                      width={spotlightWidth}
                      onPress={() => router.push(`/offer/${offer.id}`)}
                      onToggleSave={() => void toggleSave(offer)}
                    />
                  </Animated.View>
                );
              })}
            </Animated.ScrollView>
            <View
              style={styles.pagination}
              accessibilityLabel={`Spotlight item ${spotlightIndex + 1} of ${spotlightOffers.length}`}
            >
              {spotlightOffers.map((offer, index) => (
                <View
                  key={offer.id}
                  style={[
                    styles.paginationDot,
                    index === spotlightIndex && styles.paginationDotActive,
                  ]}
                />
              ))}
            </View>
          </View>
        ) : (
          <View style={styles.heroSkeleton} />
        )}

        <View style={styles.actionBar}>
          {actions.map((action) => (
            <Pressable
              key={action.label}
              style={({ pressed }) => [styles.action, pressed && styles.pressed]}
              onPress={() => router.push(action.route as never)}
              accessibilityRole="button"
              accessibilityLabel={action.label}
            >
              <View style={styles.actionIcon}>
                <Image source={action.asset} style={styles.actionIconImage} resizeMode="contain" />
              </View>
              <AppText variant="small">{action.label}</AppText>
            </Pressable>
          ))}
        </View>

        <Pressable
          style={styles.pointsRow}
          onPress={() => router.push("/rewards" as never)}
          accessibilityRole="button"
          accessibilityLabel={`${user?.savvy_points_balance ?? 0} Savvy Points`}
        >
          <Ionicons name="sparkles-outline" size={18} color="#C7D2FE" />
          <View style={styles.pointsCopy}>
            <AppText variant="bodyMedium">
              {(user?.savvy_points_balance ?? 0).toLocaleString("en-IN")} Savvy Points
            </AppText>
            <AppText variant="caption" color={color.textTertiary}>
              See rewards and ways to earn
            </AppText>
          </View>
          <Ionicons name="chevron-forward" size={17} color={color.textTertiary} />
        </Pressable>

        {campusPicks.length > 0 ? (
          <View style={styles.outletsSection}>
            <View style={[styles.sectionHeader, styles.outletsHeader]}>
              <View>
                <AppText variant="h2">Popular near campus</AppText>
                <AppText variant="small" color={color.textTertiary}>
                  Student favourites, ready to explore.
                </AppText>
              </View>
              <Pressable
                onPress={() =>
                  router.push({ pathname: "/(tabs)/explore", params: { tab: "outlets" } } as never)
                }
                hitSlop={8}
              >
                <AppText variant="small" color="#A5B4FC">
                  See all
                </AppText>
              </Pressable>
            </View>
            <Animated.ScrollView
              ref={outletRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              snapToInterval={outletStride}
              decelerationRate="fast"
              disableIntervalMomentum
              contentContainerStyle={[styles.outletRail, { paddingHorizontal: outletSideInset }]}
              scrollEventThrottle={16}
              onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: outletScrollX } } }], {
                useNativeDriver: true,
              })}
              onMomentumScrollEnd={(event) =>
                setOutletIndex(
                  Math.max(
                    0,
                    Math.min(
                      campusPicks.length - 1,
                      Math.round(event.nativeEvent.contentOffset.x / outletStride),
                    ),
                  ),
                )
              }
            >
              {campusPicks.map((outlet, index) => {
                const inputRange = [
                  (index - 1) * outletStride,
                  index * outletStride,
                  (index + 1) * outletStride,
                ];
                const scale = outletScrollX.interpolate({
                  inputRange,
                  outputRange: [0.9, 1, 0.9],
                  extrapolate: "clamp",
                });
                const opacity = outletScrollX.interpolate({
                  inputRange,
                  outputRange: [0.58, 1, 0.58],
                  extrapolate: "clamp",
                });
                const translateY = outletScrollX.interpolate({
                  inputRange,
                  outputRange: [12, 0, 12],
                  extrapolate: "clamp",
                });

                return (
                  <Animated.View
                    key={outlet.id}
                    style={[
                      styles.outletCarouselItem,
                      { width: outletStride, opacity, transform: [{ translateY }, { scale }] },
                    ]}
                  >
                    <OutletTile
                      outlet={outlet}
                      offer={campusOfferByOutletId.get(outlet.id)}
                      width={outletWidth}
                      onPress={() => router.push(`/outlet/${outlet.id}`)}
                    />
                  </Animated.View>
                );
              })}
            </Animated.ScrollView>
            {campusPicks.length > 1 ? (
              <View
                style={styles.outletPagination}
                accessibilityLabel={`Popular outlet ${outletIndex + 1} of ${campusPicks.length}`}
              >
                {campusPicks.map((outlet, index) => (
                  <View
                    key={outlet.id}
                    style={[
                      styles.paginationDot,
                      index === outletIndex && styles.paginationDotActive,
                    ]}
                  />
                ))}
              </View>
            ) : null}
          </View>
        ) : null}

        {recommendations.length > 0 ? (
          <View style={styles.recommendations}>
            <View style={styles.sectionHeader}>
              <View>
                <AppText variant="h2">More for you</AppText>
                <AppText variant="small" color={color.textTertiary}>
                  Picked from what students love.
                </AppText>
              </View>
              <Pressable onPress={() => router.push("/(tabs)/explore")} hitSlop={8}>
                <AppText variant="small" color="#A5B4FC">
                  See all
                </AppText>
              </Pressable>
            </View>
            <View style={styles.offerStack}>
              {recommendations.map((offer) => (
                <OfferCard
                  key={offer.id}
                  offer={offer}
                  onPress={() => router.push(`/offer/${offer.id}`)}
                  onToggleSave={() => void toggleSave(offer)}
                />
              ))}
            </View>
            {categories.length > 0 ? (
              <View style={styles.categorySection}>
                <AppText variant="h3">Browse by category</AppText>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.categoryRail}
                >
                  {categories.map((category) => (
                    <Pressable
                      key={category.name}
                      onPress={() =>
                        router.push({
                          pathname: "/(tabs)/explore",
                          params: { tab: "deals", category: category.name },
                        } as never)
                      }
                      style={({ pressed }) => [styles.categoryChip, pressed && styles.pressed]}
                      accessibilityRole="button"
                      accessibilityLabel={`Browse ${category.name} deals`}
                    >
                      <Ionicons name="sparkles-outline" size={15} color="#D8B4FE" />
                      <AppText variant="small" style={styles.categoryLabel}>
                        {category.name}
                      </AppText>
                      <AppText variant="caption" color={color.textTertiary}>
                        {category.count}
                      </AppText>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: space.xxl },
  pressed: { opacity: 0.9, transform: [{ scale: 0.995 }] },
  header: {
    paddingHorizontal: space.lg,
    paddingTop: space.lg,
    paddingBottom: space.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  eyebrow: { letterSpacing: 2 },
  greeting: { fontSize: 26, lineHeight: 32, letterSpacing: -0.45 },
  greetingRow: { marginTop: 2, flexDirection: "row", alignItems: "center", gap: space.sm },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  search: {
    marginHorizontal: space.lg,
    marginBottom: space.md,
    minHeight: 52,
    paddingLeft: space.md,
    paddingRight: space.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.borderStrong,
    backgroundColor: color.surface,
  },
  searchText: { flex: 1 },
  searchFilter: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    backgroundColor: color.surfaceElevated,
  },
  spotlightSection: { marginTop: space.sm },
  spotlightHeading: {
    paddingHorizontal: space.lg,
    marginBottom: space.md,
  },
  spotlightHeadingCopy: { flex: 1, minWidth: 0 },
  spotlightRail: { paddingVertical: 18 },
  spotlightItem: { alignItems: "center", justifyContent: "center" },
  hero: {
    height: 350,
    borderRadius: radius.xl,
    overflow: "hidden",
    backgroundColor: color.surfaceElevated,
  },
  heroImage: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    width: undefined,
    height: undefined,
  },
  heroShade: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: "rgba(0,0,0,0.30)",
  },
  heroTopRow: {
    position: "absolute",
    top: space.md,
    left: space.md,
    right: space.md,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  editorPick: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: space.sm,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: "rgba(7,7,10,0.68)",
  },
  editorDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: "#A78BFA" },
  editorText: { fontSize: 10, letterSpacing: 1.2, fontWeight: "800" },
  saveButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(7,7,10,0.68)",
  },
  heroCopy: { position: "absolute", left: space.lg, right: space.lg, bottom: space.lg },
  heroDiscount: {
    fontSize: 28,
    lineHeight: 33,
    fontWeight: "900",
    letterSpacing: -0.7,
    marginBottom: 3,
  },
  heroBrand: { fontSize: 21, lineHeight: 26, fontWeight: "800", letterSpacing: -0.25 },
  heroTitle: {
    maxWidth: "92%",
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "500",
    color: "rgba(255,255,255,0.76)",
  },
  heroCta: {
    marginTop: 12,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    minWidth: 124,
    minHeight: 38,
    borderRadius: radius.pill,
    backgroundColor: "#FFFFFF",
  },
  heroCtaText: {
    flexShrink: 0,
    color: "#111114",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800",
    includeFontPadding: false,
  },
  heroSkeleton: {
    height: 350,
    marginHorizontal: space.lg,
    borderRadius: radius.xl,
    backgroundColor: color.surface,
  },
  pagination: {
    height: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  paginationDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: color.textTertiary },
  paginationDotActive: { width: 22, backgroundColor: "#D8B4FE" },
  actionBar: {
    marginHorizontal: space.lg,
    marginTop: space.lg,
    paddingVertical: 12,
    flexDirection: "row",
    borderRadius: radius.lg,
    backgroundColor: color.surfaceMuted,
  },
  action: { flex: 1, alignItems: "center", gap: 5 },
  actionIcon: {
    width: 50,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  actionIconImage: { width: 48, height: 48 },
  pointsRow: {
    marginHorizontal: space.lg,
    marginTop: space.lg,
    minHeight: 66,
    paddingHorizontal: space.md,
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
  },
  pointsCopy: { flex: 1 },
  outletsSection: { marginTop: space.xxl },
  outletsHeader: { paddingHorizontal: space.lg },
  outletRail: { paddingVertical: space.sm },
  outletCarouselItem: { alignItems: "center", justifyContent: "center" },
  outletTile: {
    height: 390,
    overflow: "hidden",
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.borderStrong,
    backgroundColor: color.surface,
  },
  outletVisual: { height: 262, overflow: "hidden", backgroundColor: color.surfaceElevated },
  outletImage: { width: "100%", height: "100%" },
  outletShade: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: "rgba(0,0,0,0.08)",
  },
  outletRating: {
    position: "absolute",
    top: space.sm,
    left: space.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: space.sm,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: "rgba(5,5,8,0.78)",
  },
  outletRatingText: { color: "#FFFFFF", fontWeight: "800" },
  outletOpenButton: {
    position: "absolute",
    top: space.sm,
    right: space.sm,
    width: 44,
    height: 44,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(5,5,8,0.78)",
  },
  outletOfferStrip: {
    minHeight: 46,
    paddingHorizontal: space.md,
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
  },
  outletOfferText: { flex: 1, fontSize: 14, lineHeight: 19, color: "#FFFFFF" },
  outletOfferLead: { fontSize: 14, lineHeight: 19, color: "#FFFFFF", fontWeight: "900" },
  outletCopy: { flex: 1, paddingHorizontal: space.md, justifyContent: "center", gap: space.sm },
  outletName: { fontSize: 22, lineHeight: 27, fontWeight: "800", letterSpacing: -0.3 },
  outletLocationRow: { minWidth: 0, flexDirection: "row", alignItems: "center", gap: 5 },
  outletMeta: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
    color: color.textTertiary,
  },
  outletPagination: {
    height: 30,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  recommendations: { marginTop: space.xl, paddingHorizontal: space.lg },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginBottom: space.md,
  },
  offerStack: { gap: space.lg },
  categorySection: { marginTop: space.xl, gap: space.md },
  categoryRail: { gap: space.sm, paddingRight: space.lg },
  categoryChip: {
    minHeight: 44,
    paddingHorizontal: space.md,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(216,180,254,0.26)",
    backgroundColor: "rgba(147,51,234,0.12)",
  },
  categoryLabel: { fontWeight: "700" },
});
