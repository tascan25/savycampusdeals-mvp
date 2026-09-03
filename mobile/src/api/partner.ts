import type {
  PartnerActivityResponse,
  PartnerCouponStatus,
  PartnerDashboard,
  PartnerPeriod,
  PartnerProfile,
  ScanLookupResult,
} from "@/types/partner";

import { apiClient } from "./client";

export async function apiGetPartnerProfile(): Promise<PartnerProfile> {
  const { data } = await apiClient.get("/partner/profile");
  return data;
}

export async function apiGetPartnerDashboard(period: PartnerPeriod): Promise<PartnerDashboard> {
  const { data } = await apiClient.get("/partner/dashboard", { params: { period } });
  return data;
}

export async function apiGetPartnerActivity(params: {
  period: PartnerPeriod;
  status?: PartnerCouponStatus;
  q?: string;
  page?: number;
}): Promise<PartnerActivityResponse> {
  const { data } = await apiClient.get("/partner/activity", { params });
  return data;
}

export async function apiScanLookup(payload: string): Promise<ScanLookupResult> {
  const { data } = await apiClient.post("/scan/lookup", { payload });
  return data;
}

export async function apiScanRedeem(payload: string): Promise<{
  ok: boolean;
  kind?: string;
  redeemed_at: string;
  student_name: string;
}> {
  const { data } = await apiClient.post("/scan/redeem", { payload });
  return data;
}
