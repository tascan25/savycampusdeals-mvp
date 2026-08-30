import type { SavvyPointsOverview } from "@/types/rewards";

import { apiClient } from "./client";

export async function apiGetSavvyPointsOverview(limit = 8): Promise<SavvyPointsOverview> {
  const { data } = await apiClient.get("/savvy-points/overview", { params: { limit } });
  return data;
}
