import type { User } from "@/types/user";

import { apiClient } from "./client";

export type ProfileUpdate = Partial<
  Pick<User, "name" | "college" | "course" | "year" | "phone" | "avatar_key">
>;

export type MobileSessionSummary = {
  id: string;
  device_name: string;
  platform: "ios" | "android" | null;
  created_at: string;
  last_used_at: string;
};

export async function apiUpdateProfile(input: ProfileUpdate): Promise<User> {
  const { data } = await apiClient.patch("/profile", input);
  return data;
}

export async function apiListMobileSessions(): Promise<MobileSessionSummary[]> {
  const { data } = await apiClient.get("/auth/mobile/sessions");
  return data.sessions;
}

export async function apiDeleteAccount(password: string, confirmation: string): Promise<void> {
  await apiClient.delete("/account", { data: { password, confirmation } });
}

export async function apiChangePassword(
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  await apiClient.post("/auth/change-password", {
    current_password: currentPassword,
    new_password: newPassword,
  });
}
