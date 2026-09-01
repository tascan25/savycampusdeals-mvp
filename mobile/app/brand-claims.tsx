import { useQuery } from "@tanstack/react-query";
import { FlatList, Linking, StyleSheet, View } from "react-native";

import { apiListBrandOfferClaims } from "@/api/coupons";
import { apiClaimOffer } from "@/api/offers";
import { queryKeys } from "@/api/queryKeys";
import { BrandClaimListItem } from "@/components/BrandClaimListItem";
import { AppText, Screen } from "@/design-system/components";
import { color, space } from "@/design-system/tokens";
import { isBrandOfferClaim } from "@/types/offer";

export default function BrandClaimsScreen() {
  const claims = useQuery({
    queryKey: queryKeys.coupons.brandClaims(),
    queryFn: apiListBrandOfferClaims,
  });

  const reopen = async (offerId: string, fallbackUrl: string) => {
    const result = await apiClaimOffer(offerId);
    const url = isBrandOfferClaim(result) ? result.official_url : fallbackUrl;
    if (url) await Linking.openURL(url);
  };

  return (
    <Screen edges={["bottom"]}>
      <FlatList
        data={claims.data ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        renderItem={({ item }) => (
          <BrandClaimListItem
            claim={item}
            continuing={false}
            onContinue={() => void reopen(item.offer_id, item.official_url)}
          />
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListHeaderComponent={
          <AppText variant="small" color={color.textTertiary} style={styles.header}>
            These offers are completed securely on the brand&apos;s official website.
          </AppText>
        }
        ListEmptyComponent={
          !claims.isLoading ? (
            <AppText variant="body" color={color.textSecondary} style={styles.empty}>
              No claimed online offers yet.
            </AppText>
          ) : null
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg },
  header: { marginBottom: space.lg },
  separator: { height: space.md },
  empty: { paddingVertical: space.xxl, textAlign: "center" },
});
