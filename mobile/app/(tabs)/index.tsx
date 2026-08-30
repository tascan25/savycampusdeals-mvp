import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Image, Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";

import { apiListOffers, apiToggleSaveOffer } from "@/api/offers";
import { apiListOutlets } from "@/api/outlets";
import { queryKeys } from "@/api/queryKeys";
import { OfferCard } from "@/components/OfferCard";
import { StudentAvatar } from "@/components/StudentAvatar";
import { AppText, Screen } from "@/design-system/components";
import { color, radius, space } from "@/design-system/tokens";
import { useAuth } from "@/providers/AuthProvider";
import type { Offer } from "@/types/offer";
import type { Outlet } from "@/types/outlet";
import { getRotatingSalutation, getTimeGreeting } from "@/utils/greeting";
import { resolveMediaUrl } from "@/utils/media";

function FeaturedHero({ offer, onPress, onToggleSave }: { offer: Offer; onPress: () => void; onToggleSave: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${offer.brand}: ${offer.title}`} style={({ pressed }) => [styles.hero, pressed && styles.pressed]}>
      <Image source={{ uri: resolveMediaUrl(offer.image_url) }} style={styles.heroImage} />
      <View style={styles.heroShade} />
      <View style={styles.heroTopRow}>
        <View style={styles.editorPick}>
          <View style={styles.editorDot} />
          <AppText variant="caption" style={styles.editorText}>TODAY&apos;S PICK</AppText>
        </View>
        <Pressable onPress={(event) => { event.stopPropagation(); onToggleSave(); }} accessibilityRole="button" accessibilityLabel={offer.saved ? "Remove from saved" : "Save offer"} style={styles.saveButton}>
          <Ionicons name={offer.saved ? "bookmark" : "bookmark-outline"} size={19} color="#FFFFFF" />
        </Pressable>
      </View>
      <View style={styles.heroCopy}>
        <AppText style={styles.heroDiscount}>{offer.discount}</AppText>
        <AppText variant="h2" numberOfLines={1}>{offer.brand}</AppText>
        <AppText variant="small" color="rgba(255,255,255,0.76)" numberOfLines={2}>{offer.title}</AppText>
        <View style={styles.heroCta}>
          <AppText variant="small" style={styles.heroCtaText}>View offer</AppText>
          <Ionicons name="arrow-forward" size={15} color="#111114" />
        </View>
      </View>
    </Pressable>
  );
}

const actions = [
  { label: "All deals", icon: "pricetags-outline" as const, route: { pathname: "/(tabs)/explore", params: { tab: "deals" } } },
  { label: "Nearby", icon: "navigate-outline" as const, route: { pathname: "/(tabs)/explore", params: { tab: "outlets" } } },
  { label: "Student ID", icon: "card-outline" as const, route: { pathname: "/(tabs)/card" } },
];

function OutletTile({ outlet, onPress }: { outlet: Outlet; onPress: () => void }) {
  return (
    <Pressable style={({ pressed }) => [styles.outletTile, pressed && styles.pressed]} onPress={onPress} accessibilityRole="button" accessibilityLabel={`Open ${outlet.name}`}>
      <Image source={{ uri: resolveMediaUrl(outlet.image_url || outlet.logo_url) }} style={styles.outletImage} />
      <View style={styles.outletShade} />
      <View style={styles.outletRating}>
        <Ionicons name="star" size={11} color="#FBBF24" />
        <AppText variant="caption">{outlet.rating.toFixed(1)}</AppText>
      </View>
      <View style={styles.outletCopy}>
        <AppText variant="bodyMedium" numberOfLines={1}>{outlet.name}</AppText>
        <AppText variant="caption" color="rgba(255,255,255,0.7)" numberOfLines={1}>{outlet.offer_count} {outlet.offer_count === 1 ? "deal" : "deals"} · {outlet.cuisine}</AppText>
      </View>
    </Pressable>
  );
}

export default function HomeTab() {
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [now, setNow] = useState(() => new Date());
  const featured = useQuery({ queryKey: queryKeys.offers.list({ sort: "featured" }), queryFn: () => apiListOffers({ sort: "featured" }) });
  const trending = useQuery({ queryKey: queryKeys.offers.list({ sort: "trending" }), queryFn: () => apiListOffers({ sort: "trending" }) });
  const outlets = useQuery({ queryKey: queryKeys.outlets.list({ home: true }), queryFn: () => apiListOutlets({}) });

  const toggleSave = async (offer: Offer) => {
    await apiToggleSaveOffer(offer.id);
    await queryClient.invalidateQueries({ queryKey: queryKeys.offers.all() });
  };

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const firstName = user?.name?.trim().split(/\s+/)[0] || "there";
  const timeGreeting = getTimeGreeting(now);
  const salutation = getRotatingSalutation(now);
  const heroOffer = featured.data?.[0] ?? trending.data?.[0];
  const recommendations = (trending.data ?? []).filter((offer) => offer.id !== heroOffer?.id).slice(0, 2);
  const campusPicks = (outlets.data ?? []).filter((outlet) => Boolean(outlet.image_url || outlet.logo_url)).slice(0, 5);
  const refreshing = featured.isRefetching || trending.isRefetching || outlets.isRefetching;

  return (
    <Screen edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { void featured.refetch(); void trending.refetch(); void outlets.refetch(); }} tintColor={color.textSecondary} />}>
        <View style={styles.header}>
          <View>
            <AppText variant="caption" color={color.textTertiary} style={styles.eyebrow}>{timeGreeting.toUpperCase()}</AppText>
            <View style={styles.greetingRow}>
              <AppText variant="h1">{salutation}, {firstName}</AppText>
              {user?.verification_status === "approved" ? <Ionicons name="checkmark-circle" size={18} color={color.success} /> : null}
            </View>
          </View>
          <Pressable style={styles.avatar} onPress={() => router.push("/(tabs)/profile")} accessibilityRole="button" accessibilityLabel="Open profile">
            <StudentAvatar avatarKey={user?.avatar_key} name={user?.name || firstName} size={44} />
          </Pressable>
        </View>

        <Pressable style={styles.search} onPress={() => router.push("/(tabs)/explore")} accessibilityRole="search" accessibilityLabel="Search deals and outlets">
          <Ionicons name="search" size={20} color={color.textSecondary} />
          <AppText variant="body" color={color.textTertiary} style={styles.searchText}>Search deals, cafés and stores</AppText>
          <View style={styles.searchFilter}><Ionicons name="options-outline" size={17} color={color.textSecondary} /></View>
        </Pressable>

        {heroOffer ? <FeaturedHero offer={heroOffer} onPress={() => router.push(`/offer/${heroOffer.id}`)} onToggleSave={() => void toggleSave(heroOffer)} /> : <View style={styles.heroSkeleton} />}

        <View style={styles.actionBar}>
          {actions.map((action) => (
            <Pressable key={action.label} style={({ pressed }) => [styles.action, pressed && styles.pressed]} onPress={() => router.push(action.route as never)} accessibilityRole="button" accessibilityLabel={action.label}>
              <View style={styles.actionIcon}><Ionicons name={action.icon} size={19} color="#C7D2FE" /></View>
              <AppText variant="small">{action.label}</AppText>
            </Pressable>
          ))}
        </View>

        <Pressable style={styles.pointsRow} onPress={() => router.push("/rewards" as never)} accessibilityRole="button" accessibilityLabel={`${user?.savvy_points_balance ?? 0} Savvy Points`}>
          <Ionicons name="sparkles-outline" size={18} color="#C7D2FE" />
          <View style={styles.pointsCopy}>
            <AppText variant="bodyMedium">{(user?.savvy_points_balance ?? 0).toLocaleString("en-IN")} Savvy Points</AppText>
            <AppText variant="caption" color={color.textTertiary}>See rewards and ways to earn</AppText>
          </View>
          <Ionicons name="chevron-forward" size={17} color={color.textTertiary} />
        </Pressable>

        {campusPicks.length > 0 ? (
          <View style={styles.outletsSection}>
            <View style={[styles.sectionHeader, styles.outletsHeader]}>
              <View>
                <AppText variant="h2">Popular near campus</AppText>
                <AppText variant="small" color={color.textTertiary}>Student favourites, ready to explore.</AppText>
              </View>
              <Pressable onPress={() => router.push({ pathname: "/(tabs)/explore", params: { tab: "outlets" } } as never)} hitSlop={8}><AppText variant="small" color="#A5B4FC">See all</AppText></Pressable>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.outletRail}>
              {campusPicks.map((outlet) => <OutletTile key={outlet.id} outlet={outlet} onPress={() => router.push(`/outlet/${outlet.id}`)} />)}
            </ScrollView>
          </View>
        ) : null}

        {recommendations.length > 0 ? (
          <View style={styles.recommendations}>
            <View style={styles.sectionHeader}>
              <View>
                <AppText variant="h2">More for you</AppText>
                <AppText variant="small" color={color.textTertiary}>Picked from what students love.</AppText>
              </View>
              <Pressable onPress={() => router.push("/(tabs)/explore")} hitSlop={8}><AppText variant="small" color="#A5B4FC">See all</AppText></Pressable>
            </View>
            <View style={styles.offerStack}>
              {recommendations.map((offer) => <OfferCard key={offer.id} offer={offer} onPress={() => router.push(`/offer/${offer.id}`)} onToggleSave={() => void toggleSave(offer)} />)}
            </View>
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: space.xxl },
  pressed: { opacity: 0.9, transform: [{ scale: 0.995 }] },
  header: { paddingHorizontal: space.lg, paddingTop: space.lg, paddingBottom: space.md, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  eyebrow: { letterSpacing: 2 },
  greetingRow: { marginTop: 2, flexDirection: "row", alignItems: "center", gap: space.sm },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  search: { marginHorizontal: space.lg, marginBottom: space.md, minHeight: 52, paddingLeft: space.md, paddingRight: space.sm, flexDirection: "row", alignItems: "center", gap: space.sm, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: color.borderStrong, backgroundColor: color.surface },
  searchText: { flex: 1 },
  searchFilter: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: 18, backgroundColor: color.surfaceElevated },
  hero: { height: 330, marginHorizontal: space.lg, borderRadius: radius.xl, overflow: "hidden", backgroundColor: color.surfaceElevated },
  heroImage: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, width: undefined, height: undefined },
  heroShade: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(0,0,0,0.30)" },
  heroTopRow: { position: "absolute", top: space.md, left: space.md, right: space.md, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  editorPick: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: space.sm, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: "rgba(7,7,10,0.68)" },
  editorDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: "#A78BFA" },
  editorText: { fontSize: 10, letterSpacing: 1.2, fontWeight: "800" },
  saveButton: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(7,7,10,0.68)" },
  heroCopy: { position: "absolute", left: space.lg, right: space.lg, bottom: space.lg },
  heroDiscount: { fontSize: 34, lineHeight: 39, fontWeight: "900", letterSpacing: -1.1, marginBottom: 2 },
  heroCta: { marginTop: space.md, alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: space.sm, paddingHorizontal: space.md, minHeight: 42, borderRadius: radius.pill, backgroundColor: "#FFFFFF" },
  heroCtaText: { color: "#111114", fontWeight: "800" },
  heroSkeleton: { height: 330, marginHorizontal: space.lg, borderRadius: radius.xl, backgroundColor: color.surface },
  actionBar: { marginHorizontal: space.lg, marginTop: space.md, paddingVertical: space.md, flexDirection: "row", borderRadius: radius.lg, backgroundColor: color.surfaceMuted },
  action: { flex: 1, alignItems: "center", gap: space.sm },
  actionIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: color.primarySoft },
  pointsRow: { marginHorizontal: space.lg, marginTop: space.sm, minHeight: 66, paddingHorizontal: space.md, flexDirection: "row", alignItems: "center", gap: space.md },
  pointsCopy: { flex: 1 },
  outletsSection: { marginTop: space.xl },
  outletsHeader: { paddingHorizontal: space.lg },
  outletRail: { paddingHorizontal: space.lg, gap: space.md },
  outletTile: { width: 232, height: 170, overflow: "hidden", borderRadius: radius.lg, backgroundColor: color.surface },
  outletImage: { position: "absolute", width: "100%", height: "100%" },
  outletShade: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(0,0,0,0.26)" },
  outletRating: { position: "absolute", top: space.sm, right: space.sm, flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: space.sm, paddingVertical: 5, borderRadius: radius.pill, backgroundColor: "rgba(5,5,5,0.74)" },
  outletCopy: { position: "absolute", left: space.md, right: space.md, bottom: space.md, gap: 2 },
  recommendations: { marginTop: space.xl, paddingHorizontal: space.lg },
  sectionHeader: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginBottom: space.md },
  offerStack: { gap: space.lg },
});
