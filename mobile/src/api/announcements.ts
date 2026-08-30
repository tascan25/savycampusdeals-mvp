import type { AnnouncementsResponse } from "@/types/announcement";

import { apiClient } from "./client";

export async function apiListAnnouncements(): Promise<AnnouncementsResponse> {
  const { data } = await apiClient.get("/announcements");
  return data;
}

export async function apiMarkAnnouncementSeen(announcementId: string): Promise<void> {
  await apiClient.post(`/announcements/${announcementId}/seen`);
}

export async function apiMarkAnnouncementClicked(announcementId: string): Promise<void> {
  await apiClient.post(`/announcements/${announcementId}/click`);
}
