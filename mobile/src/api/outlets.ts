import type { Outlet, OutletDetail } from "@/types/outlet";

import { apiClient } from "./client";

export async function apiListOutlets(params: {
  city?: string;
  q?: string;
  lat?: number;
  lng?: number;
  nearby_only?: boolean;
  radius_km?: number;
}): Promise<Outlet[]> {
  const { data } = await apiClient.get("/outlets", { params });
  return data;
}

export async function apiListOutletCities(): Promise<string[]> {
  const { data } = await apiClient.get("/outlets/cities");
  return data;
}

export async function apiGetOutlet(outletId: string): Promise<OutletDetail> {
  const { data } = await apiClient.get(`/outlets/${outletId}`);
  return data;
}
