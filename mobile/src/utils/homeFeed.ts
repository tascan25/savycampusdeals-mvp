import type { Offer } from "@/types/offer";
import type { Outlet } from "@/types/outlet";

const INDIA_OFFSET_MS = 5.5 * 60 * 60 * 1000;

export function getIndiaDateKey(date: Date): string {
  return new Date(date.getTime() + INDIA_OFFSET_MS).toISOString().slice(0, 10);
}

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function selectDailyBrandOffers(offers: Offer[], dateKey: string, limit = 5): Offer[] {
  return offers
    .filter((offer) => offer.offer_type === "listed_brand")
    .map((offer) => ({ offer, score: stableHash(`${dateKey}:${offer.id}`) }))
    .sort((left, right) => left.score - right.score || left.offer.id.localeCompare(right.offer.id))
    .slice(0, limit)
    .map(({ offer }) => offer);
}

export function selectPopularOutletOffers(offers: Offer[], limit = 3): Offer[] {
  return offers
    .filter((offer) => offer.offer_type === "partner_outlet" && Boolean(offer.outlet_id))
    .sort(
      (left, right) =>
        (right.claims_count ?? 0) - (left.claims_count ?? 0) || left.id.localeCompare(right.id),
    )
    .slice(0, limit);
}

export function interleaveOffers(primary: Offer[], secondary: Offer[]): Offer[] {
  const result: Offer[] = [];
  const total = Math.max(primary.length, secondary.length);
  for (let index = 0; index < total; index += 1) {
    const primaryOffer = primary[index];
    const secondaryOffer = secondary[index];
    if (primaryOffer) result.push(primaryOffer);
    if (secondaryOffer) result.push(secondaryOffer);
  }
  return result;
}

export function selectPopularCampusOutlets(outlets: Outlet[], limit = 5): Outlet[] {
  const eligible = outlets.filter((outlet) => Boolean(outlet.image_url || outlet.logo_url));
  const favourite = eligible.find((outlet) => outlet.is_favourite);
  return [
    ...(favourite ? [favourite] : []),
    ...eligible.filter((outlet) => outlet.id !== favourite?.id),
  ].slice(0, limit);
}
