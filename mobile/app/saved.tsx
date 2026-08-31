import { Ionicons } from "@expo/vector-icons";
import { FlashList } from "@shopify/flash-list";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";

import { apiListSavedOffers, apiToggleSaveOffer } from "@/api/offers";
import { queryKeys } from "@/api/queryKeys";
import { OfferCard } from "@/components/OfferCard";
import { AppText, Screen } from "@/design-system/components";
import { color, radius, space } from "@/design-system/tokens";
import type { Offer } from "@/types/offer";

export default function SavedOffersScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const savedQuery = useQuery({ queryKey: queryKeys.offers.saved(), queryFn: apiListSavedOffers });

  const removeSaved = async (offer: Offer) => {
    await apiToggleSaveOffer(offer.id);
    await queryClient.invalidateQueries({ queryKey: queryKeys.offers.all() });
  };

  return (
    <Screen edges={["bottom"]}>
      <FlashList
        data={savedQuery.data ?? []}
        keyExtractor={(offer) => offer.id}
        contentContainerStyle={styles.content}
        refreshing={savedQuery.isRefetching}
        onRefresh={() => savedQuery.refetch()}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <OfferCard
              offer={item}
              onPress={() => router.push(`/offer/${item.id}`)}
              onToggleSave={() => void removeSaved(item)}
            />
          </View>
        )}
        ListHeaderComponent={
          <View style={styles.intro}>
            <AppText variant="caption" color={color.textTertiary} style={styles.eyebrow}>
              YOUR SHORTLIST
            </AppText>
            <AppText variant="h2">Saved offers</AppText>
            <AppText variant="small" color={color.textSecondary}>
              Keep the deals you want to revisit in one place.
            </AppText>
          </View>
        }
        ListEmptyComponent={
          !savedQuery.isLoading ? (
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Ionicons name="bookmark-outline" size={29} color="#D8B4FE" />
              </View>
              <AppText variant="h3">Nothing saved yet</AppText>
              <AppText variant="small" color={color.textTertiary} style={styles.emptyCopy}>
                Tap the bookmark on any offer and it will appear here.
              </AppText>
              <Pressable
                style={styles.exploreButton}
                onPress={() =>
                  router.replace({ pathname: "/(tabs)/explore", params: { tab: "deals" } } as never)
                }
              >
                <AppText variant="small" style={styles.exploreLabel}>
                  Browse deals
                </AppText>
              </Pressable>
            </View>
          ) : null
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.xxl },
  intro: { marginBottom: space.lg, gap: 3 },
  eyebrow: { letterSpacing: 1.8 },
  card: { marginBottom: space.lg },
  empty: {
    minHeight: 350,
    padding: space.xl,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.border,
    backgroundColor: color.surfaceMuted,
  },
  emptyIcon: {
    width: 58,
    height: 58,
    marginBottom: space.md,
    borderRadius: 29,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(147,51,234,0.16)",
  },
  emptyCopy: { maxWidth: 250, marginTop: space.sm, textAlign: "center", lineHeight: 19 },
  exploreButton: {
    minHeight: 44,
    marginTop: space.lg,
    paddingHorizontal: space.lg,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: "#FFFFFF",
  },
  exploreLabel: { color: "#111114", fontWeight: "800" },
});
