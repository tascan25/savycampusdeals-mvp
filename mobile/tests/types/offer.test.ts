import {
  isBrandOfferClaim,
  type BrandOfferClaimResult,
  type CouponClaimResult,
} from "@/types/offer";

const coupon: CouponClaimResult = {
  id: "1",
  code: "SCD-ABCD1234",
  offer_id: "offer-1",
  offer_title: "10% off",
  brand: "Acme",
  brand_logo: "",
  discount: "10%",
  image_url: "",
  qr_data_uri: "",
  status: "active",
  created_at: null,
  expires_at: null,
  redeemed_at: null,
};

const brandClaim: BrandOfferClaimResult = {
  id: "2",
  kind: "listed_brand_offer",
  status: "claimed",
  offer_id: "offer-2",
  offer_title: "Student discount",
  brand: "Acme",
  brand_logo: "",
  discount: "20%",
  image_url: "",
  official_url: "https://acme.example/students",
  terms: "",
  validity: "",
  disclaimer: "",
  claimed_at: null,
  last_visited_at: null,
  legacy: false,
};

describe("isBrandOfferClaim", () => {
  it("discriminates a listed-brand claim from a partner-outlet coupon", () => {
    expect(isBrandOfferClaim(brandClaim)).toBe(true);
    expect(isBrandOfferClaim(coupon)).toBe(false);
  });
});
