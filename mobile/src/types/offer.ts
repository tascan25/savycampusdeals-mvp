/** Mirrors backend/server.py's serialize_offer() output. */
export type Offer = {
  id: string;
  title: string;
  brand: string;
  brand_logo: string;
  brand_url: string;
  category: string;
  categories: string[];
  description: string;
  discount: string;
  image_url: string;
  terms: string;
  validity: string;
  featured: boolean;
  trending: boolean;
  location: string;
  claims_count: number;
  saved: boolean;
  outlet_id: string | null;
  offer_type: "partner_outlet" | "listed_brand";
  disclaimer: string;
  redemption_policy: string;
  active_coupon?: {
    id: string;
    status: "active";
    expires_at: string | null;
  } | null;
  created_at: string | null;
  /** Only present on GET /offers/{id} for an outlet offer. */
  outlet_hours?: string;
  /** Only present when an offer is returned inline on GET /outlets/{id}. */
  claim_blocked?: boolean;
  claim_message?: string;
};

export type OfferCategory = {
  name: string;
  count: number;
};

export type OfferSort = "featured" | "trending" | "latest";

/** Mirrors serialize_coupon() — returned by POST /offers/{id}/claim for a partner_outlet offer. */
export type CouponClaimResult = {
  id: string;
  code: string;
  offer_id: string;
  offer_title: string;
  brand: string;
  brand_logo: string;
  discount: string;
  image_url: string;
  qr_data_uri: string;
  status: "active" | "redeemed" | "expired";
  created_at: string | null;
  expires_at: string | null;
  redeemed_at: string | null;
  /** True when POST /claim returned the coupon that was already active. */
  already_active?: boolean;
};

/** Mirrors serialize_brand_offer_claim() — returned by POST /offers/{id}/claim for a listed_brand offer. */
export type BrandOfferClaimResult = {
  id: string;
  kind: "listed_brand_offer";
  status: "claimed";
  offer_id: string;
  offer_title: string;
  brand: string;
  brand_logo: string;
  discount: string;
  image_url: string;
  official_url: string;
  terms: string;
  validity: string;
  disclaimer: string;
  claimed_at: string | null;
  last_visited_at: string | null;
  legacy: boolean;
};

export type ClaimResult = CouponClaimResult | BrandOfferClaimResult;

export function isBrandOfferClaim(result: ClaimResult): result is BrandOfferClaimResult {
  return "kind" in result && result.kind === "listed_brand_offer";
}
