import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { FlatList, StyleSheet, View } from "react-native";

import { apiListOfferCategories, apiListOffers } from "@/api/offers";
import { queryKeys } from "@/api/queryKeys";
import { OfferCard } from "@/components/OfferCard";
import { LoadingShimmer } from "@/components/LoadingShimmer";
import { SaveOfferFeedback } from "@/components/SaveOfferFeedback";
import { AppText, Chip, SearchField } from "@/design-system/components";
import { color, space } from "@/design-system/tokens";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useSaveOfferToggle } from "@/hooks/useSaveOfferToggle";
import type { OfferSort } from "@/types/offer";

const SORTS: { value: OfferSort; label: string }[] = [
  { value: "featured", label: "Featured" },
  { value: "trending", label: "Trending" },
  { value: "latest", label: "Latest" },
];

export function DealsExplorer({ initialCategory }: { initialCategory?: string }) {
  const router = useRouter();
  const { feedback, toggleSave } = useSaveOfferToggle();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState(initialCategory || "all");
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

  return (
    <View style={styles.container}>
      <FlatList
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
              onToggleSave={() => void toggleSave(item)}
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
            <FlatList
              horizontal
              data={SORTS}
              keyExtractor={(item) => item.value}
              showsHorizontalScrollIndicator={false}
              style={styles.chipRow}
              renderItem={({ item: s }) => (
                <View key={s.value} style={styles.chipGap}>
                  <Chip
                    label={s.label}
                    active={sort === s.value}
                    onPress={() => setSort(s.value)}
                  />
                </View>
              )}
            />
            <FlatList
              horizontal
              data={categories}
              keyExtractor={(item) => item}
              showsHorizontalScrollIndicator={false}
              style={styles.chipRow}
              renderItem={({ item: c }) => (
                <View key={c} style={styles.chipGap}>
                  <Chip
                    label={c === "all" ? "All" : c}
                    active={category === c}
                    onPress={() => setCategory(c)}
                  />
                </View>
              )}
            />
          </View>
        }
        ListEmptyComponent={
          offersQuery.isLoading ? (
            <View style={styles.loading}>
              <LoadingShimmer style={styles.offerSkeleton} />
              <LoadingShimmer style={styles.offerSkeleton} />
              <LoadingShimmer style={styles.offerSkeleton} />
            </View>
          ) : (
            <View style={styles.empty}>
              <AppText variant="body" color={color.textSecondary}>
                No offers match. Try clearing filters.
              </AppText>
            </View>
          )
        }
      />
      <SaveOfferFeedback feedback={feedback} bottomOffset={72} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { flex: 1 },
  filters: { paddingVertical: space.md, gap: space.sm },
  chipRow: { flexGrow: 0 },
  chipGap: { marginRight: space.sm },
  listContent: { paddingHorizontal: space.lg, paddingBottom: space.xl },
  gridItem: { marginBottom: space.md },
  loading: { gap: space.md },
  offerSkeleton: { height: 164 },
  empty: { padding: space.xl, alignItems: "center" },
});
