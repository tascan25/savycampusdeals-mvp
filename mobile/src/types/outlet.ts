import type { Offer } from "./offer";

/** Mirrors backend/server.py's serialize_outlet() output. */
export type Outlet = {
  id: string;
  name: string;
  tagline: string;
  cuisine: string;
  city: string;
  address: string;
  lat: number | null;
  lng: number | null;
  image_url: string;
  logo_url: string;
  cover_url: string;
  phone: string;
  hours: string;
  rating: number;
  offer_count: number;
  /** Only present when the request included lat/lng. */
  distance_km?: number | null;
  is_nearby?: boolean;
  /** Coupon claims made by the signed-in student at this outlet. */
  interaction_count?: number;
  /** The signed-in student's most-claimed outlet. */
  is_favourite?: boolean;
};

/** GET /outlets/{id} — the outlet plus its active offers and claim gating. */
export type OutletDetail = Outlet & {
  offers: Offer[];
  already_redeemed_here: boolean;
  claim_message: string;
};
