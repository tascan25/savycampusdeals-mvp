import { useQuery } from "@tanstack/react-query";
import { Linking, ScrollView, StyleSheet, View } from "react-native";

import { apiListBrandOfferClaims } from "@/api/coupons";
import { apiClaimOffer } from "@/api/offers";
import { queryKeys } from "@/api/queryKeys";
import { BrandClaimListItem } from "@/components/BrandClaimListItem";
import { AppText, Screen } from "@/design-system/components";
import { color, space } from "@/design-system/tokens";
import { isBrandOfferClaim } from "@/types/offer";

export default function BrandClaimsScreen() {
  const claims = useQuery({ queryKey: queryKeys.coupons.brandClaims(), queryFn: apiListBrandOfferClaims });

  const reopen = async (offerId: string, fallbackUrl: string) => {
    const result = await apiClaimOffer(offerId);
    const url = isBrandOfferClaim(result) ? result.official_url : fallbackUrl;
    if (url) await Linking.openURL(url);
  };

  return (
    <Screen edges={["bottom"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <AppText variant="small" color={color.textTertiary}>These offers are completed securely on the brand&apos;s official website.</AppText>
        <View style={styles.list}>
          {(claims.data ?? []).map((claim) => <BrandClaimListItem key={claim.id} claim={claim} continuing={false} onContinue={() => void reopen(claim.offer_id, claim.official_url)} />)}
        </View>
        {!claims.isLoading && (claims.data?.length ?? 0) === 0 ? <AppText variant="body" color={color.textSecondary} style={styles.empty}>No claimed online offers yet.</AppText> : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, gap: space.lg },
  list: { gap: space.md },
  empty: { paddingVertical: space.xxl, textAlign: "center" },
});
