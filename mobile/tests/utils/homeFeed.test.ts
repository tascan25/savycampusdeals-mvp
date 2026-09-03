import type { Offer } from "@/types/offer";
import type { Outlet } from "@/types/outlet";
import {
  getIndiaDateKey,
  interleaveOffers,
  selectDailyBrandOffers,
  selectPopularCampusOutlets,
  selectPopularOutletOffers,
} from "@/utils/homeFeed";

function offer(id: string, type: Offer["offer_type"], claimsCount = 0): Offer {
  return {
    id,
    title: id,
    brand: id,
    brand_logo: "",
    brand_url: "",
    category: "",
    categories: [],
    description: "",
    discount: "",
    image_url: "image.jpg",
    terms: "",
    validity: "",
    featured: false,
    trending: false,
    location: "",
    claims_count: claimsCount,
    saved: false,
    outlet_id: type === "partner_outlet" ? `outlet-${id}` : null,
    offer_type: type,
    disclaimer: "",
    redemption_policy: "",
    created_at: null,
  };
}

function outlet(id: string, favourite = false): Outlet {
  return {
    id,
    name: id,
    tagline: "",
    cuisine: "",
    city: "",
    address: "",
    lat: null,
    lng: null,
    image_url: "image.jpg",
    logo_url: "",
    cover_url: "",
    phone: "",
    hours: "",
    rating: 0,
    offer_count: 1,
    is_favourite: favourite,
  };
}

describe("home feed selection", () => {
  test("uses the India calendar date", () => {
    expect(getIndiaDateKey(new Date("2026-09-02T20:00:00.000Z"))).toBe("2026-09-03");
  });

  test("selects five deterministic brand offers and rotates their order daily", () => {
    const offers = Array.from({ length: 20 }, (_, index) =>
      offer(`brand-${index}`, "listed_brand"),
    );
    const today = selectDailyBrandOffers(offers, "2026-09-03");
    const repeated = selectDailyBrandOffers([...offers].reverse(), "2026-09-03");
    const tomorrow = selectDailyBrandOffers(offers, "2026-09-04");

    expect(today).toHaveLength(5);
    expect(repeated.map(({ id }) => id)).toEqual(today.map(({ id }) => id));
    expect(tomorrow.map(({ id }) => id)).not.toEqual(today.map(({ id }) => id));
  });

  test("adds the three most-claimed outlet offers to today's picks", () => {
    const brands = [offer("brand-a", "listed_brand"), offer("brand-b", "listed_brand")];
    const popular = selectPopularOutletOffers(
      [
        offer("low", "partner_outlet", 2),
        offer("top", "partner_outlet", 20),
        offer("mid", "partner_outlet", 8),
      ],
      2,
    );

    expect(popular.map(({ id }) => id)).toEqual(["top", "mid"]);
    expect(interleaveOffers(brands, popular).map(({ id }) => id)).toEqual([
      "brand-a",
      "top",
      "brand-b",
      "mid",
    ]);
  });

  test("keeps a student's favourite outlet alongside distance-ordered outlets", () => {
    const selected = selectPopularCampusOutlets(
      [outlet("nearest"), outlet("second"), outlet("favourite", true), outlet("fourth")],
      3,
    );

    expect(selected.map(({ id }) => id)).toEqual(["favourite", "nearest", "second"]);
  });
});
