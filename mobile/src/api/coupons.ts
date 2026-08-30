import type { BrandOfferClaimResult, CouponClaimResult } from "@/types/offer";

import { apiClient } from "./client";

export async function apiListCoupons(): Promise<CouponClaimResult[]> {
  const { data } = await apiClient.get("/coupons");
  return data;
}

export async function apiGetCoupon(couponId: string): Promise<CouponClaimResult> {
  const { data } = await apiClient.get(`/coupons/${couponId}`);
  return data;
}

export async function apiListBrandOfferClaims(): Promise<BrandOfferClaimResult[]> {
  const { data } = await apiClient.get("/brand-offer-claims");
  return data;
}
