import { Platform } from "react-native";

import type { User } from "@/types/user";

import { apiClient } from "./client";

type MobileTokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
};

export type AuthResponse = { user: User } & MobileTokenResponse;

const platform = Platform.OS === "ios" || Platform.OS === "android" ? Platform.OS : undefined;

export async function apiRegister(input: {
  name: string;
  email: string;
  password: string;
  college?: string;
  course?: string;
  year?: string;
  phone?: string;
  referral_code?: string;
}): Promise<AuthResponse & { email_sent: boolean; dev_otp?: string; email_error?: string }> {
  const { data } = await apiClient.post("/auth/mobile/register", { ...input, platform });
  return data;
}

export async function apiLogin(input: { email: string; password: string }): Promise<AuthResponse> {
  const { data } = await apiClient.post("/auth/mobile/login", { ...input, platform });
  return data;
}

export async function apiRefresh(refreshToken: string): Promise<AuthResponse> {
  const { data } = await apiClient.post("/auth/mobile/refresh", { refresh_token: refreshToken });
  return data;
}

export async function apiLogout(refreshToken: string): Promise<void> {
  await apiClient.post("/auth/mobile/logout", { refresh_token: refreshToken });
}

export async function apiLogoutAll(): Promise<{ revoked_count: number }> {
  const { data } = await apiClient.post("/auth/mobile/logout-all");
  return data;
}

export async function apiMe(): Promise<User> {
  const { data } = await apiClient.get("/auth/me");
  return data;
}

export async function apiSendOtp(
  email: string,
): Promise<{ ok: boolean; already_verified?: boolean; email_sent?: boolean; dev_otp?: string }> {
  const { data } = await apiClient.post("/auth/send-otp", { email });
  return data;
}

export async function apiVerifyOtp(
  email: string,
  otp: string,
): Promise<{ ok: boolean; user?: User }> {
  const { data } = await apiClient.post("/auth/verify-otp", { email, otp });
  return data;
}

export async function apiForgotPassword(email: string): Promise<void> {
  await apiClient.post("/auth/forgot-password", { email });
}

export async function apiResetPassword(token: string, password: string): Promise<void> {
  await apiClient.post("/auth/reset-password", { token, password });
}
