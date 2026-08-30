import type { ClaimResult, Offer, OfferCategory, OfferSort } from "@/types/offer";

import { apiClient } from "./client";

export async function apiListOffers(params: {
  q?: string;
  category?: string;
  sort?: OfferSort;
}): Promise<Offer[]> {
  const { data } = await apiClient.get("/offers", { params });
  return data;
}

export async function apiListOfferCategories(): Promise<OfferCategory[]> {
  const { data } = await apiClient.get("/offers/categories");
  return data;
}

export async function apiGetOffer(offerId: string): Promise<Offer> {
  const { data } = await apiClient.get(`/offers/${offerId}`);
  return data;
}

export async function apiToggleSaveOffer(offerId: string): Promise<{ saved: boolean }> {
  const { data } = await apiClient.post(`/offers/${offerId}/save`);
  return data;
}

export async function apiListSavedOffers(): Promise<Offer[]> {
  const { data } = await apiClient.get("/saved");
  return data;
}

export async function apiClaimOffer(offerId: string): Promise<ClaimResult> {
  const { data } = await apiClient.post(`/offers/${offerId}/claim`);
  return data;
}
