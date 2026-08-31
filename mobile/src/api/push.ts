import { apiClient } from "./client";

export async function apiRegisterPushDevice(input: {
  token: string;
  installation_id: string;
  platform: "android" | "ios";
  app_version: string;
  permission: "granted" | "provisional";
}): Promise<void> {
  await apiClient.post("/push/devices", input);
}

export async function apiUnregisterPushDevice(installationId: string): Promise<void> {
  await apiClient.delete(`/push/devices/${encodeURIComponent(installationId)}`);
}

export async function apiMarkPushOpened(deliveryId: string): Promise<void> {
  await apiClient.post(`/push/deliveries/${encodeURIComponent(deliveryId)}/opened`);
}
