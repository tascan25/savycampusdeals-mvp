import { FlashList } from "@shopify/flash-list";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";

import { apiListOfferCategories, apiListOffers, apiToggleSaveOffer } from "@/api/offers";
import { queryKeys } from "@/api/queryKeys";
import { OfferCard } from "@/components/OfferCard";
import { AppText, Chip, SearchField } from "@/design-system/components";
import { color, space } from "@/design-system/tokens";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import type { Offer, OfferSort } from "@/types/offer";

const SORTS: { value: OfferSort; label: string }[] = [
  { value: "featured", label: "Featured" },
  { value: "trending", label: "Trending" },
  { value: "latest", label: "Latest" },
];

export function DealsExplorer() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState<OfferSort>("featured");
  const debouncedQuery = useDebouncedValue(query, 350);

  const categoriesQuery = useQuery({
    queryKey: queryKeys.offers.categories(),
    queryFn: apiListOfferCategories,
  });
  const categories = useMemo(
    () => [
      "all",
      ...(categoriesQuery.data
        ?.map((c) => c.name)
        .filter(Boolean)
        .sort() ?? []),
    ],
    [categoriesQuery.data],
  );

  const filters = {
    q: debouncedQuery.trim() || undefined,
    category: category === "all" ? undefined : category,
    sort,
  };
  const offersQuery = useQuery({
    queryKey: queryKeys.offers.list(filters),
    queryFn: () => apiListOffers(filters),
  });

  const toggleSave = async (offer: Offer) => {
    await apiToggleSaveOffer(offer.id);
    await queryClient.invalidateQueries({ queryKey: queryKeys.offers.all() });
  };

  return (
    <FlashList
      style={styles.list}
      data={offersQuery.data ?? []}
      keyExtractor={(item) => item.id}
      numColumns={1}
      refreshing={offersQuery.isRefetching}
      onRefresh={() => offersQuery.refetch()}
      contentContainerStyle={styles.listContent}
      renderItem={({ item }) => (
        <View style={styles.gridItem}>
          <OfferCard
            offer={item}
            onPress={() => router.push(`/offer/${item.id}`)}
            onToggleSave={() => toggleSave(item)}
          />
        </View>
      )}
      ListHeaderComponent={
        <View style={styles.filters}>
          <SearchField
            value={query}
            onChangeText={setQuery}
            placeholder="Search brands, offers…"
            testID="offers-search-input"
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
            {SORTS.map((s) => (
              <View key={s.value} style={styles.chipGap}>
                <Chip label={s.label} active={sort === s.value} onPress={() => setSort(s.value)} />
              </View>
            ))}
          </ScrollView>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
            {categories.map((c) => (
              <View key={c} style={styles.chipGap}>
                <Chip
                  label={c === "all" ? "All" : c}
                  active={category === c}
                  onPress={() => setCategory(c)}
                />
              </View>
            ))}
          </ScrollView>
        </View>
      }
      ListEmptyComponent={
        !offersQuery.isLoading ? (
          <View style={styles.empty}>
            <AppText variant="body" color={color.textSecondary}>
              No offers match. Try clearing filters.
            </AppText>
          </View>
        ) : null
      }
    />
  );
}

const styles = StyleSheet.create({
  list: { flex: 1 },
  filters: { paddingVertical: space.md, gap: space.sm },
  chipRow: { flexGrow: 0 },
  chipGap: { marginRight: space.sm },
  listContent: { paddingHorizontal: space.lg, paddingBottom: space.xl },
  gridItem: { marginBottom: space.md },
  empty: { padding: space.xl, alignItems: "center" },
});
