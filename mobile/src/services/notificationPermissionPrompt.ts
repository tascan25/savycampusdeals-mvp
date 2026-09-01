import { appStorageKeys, getAppValue, setAppValue } from "@/storage/appStorage";

export const NOTIFICATION_PROMPT_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

type PromptState = {
  lastShownAt: number;
};

export function isNotificationPromptDue(
  permissionGranted: boolean,
  lastShownAt: number | null,
  now = Date.now(),
): boolean {
  if (permissionGranted) return false;
  if (lastShownAt === null) return true;
  return now - lastShownAt >= NOTIFICATION_PROMPT_COOLDOWN_MS;
}

async function readPromptState(): Promise<PromptState | null> {
  const raw = await getAppValue(appStorageKeys.notificationPermissionPrompt);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<PromptState>;
    return typeof parsed.lastShownAt === "number" ? { lastShownAt: parsed.lastShownAt } : null;
  } catch {
    return null;
  }
}

export async function shouldShowNotificationPermissionPrompt(
  permissionGranted: boolean,
  now = Date.now(),
): Promise<boolean> {
  const state = await readPromptState();
  return isNotificationPromptDue(permissionGranted, state?.lastShownAt ?? null, now);
}

export async function recordNotificationPermissionPromptShown(now = Date.now()): Promise<void> {
  await setAppValue(
    appStorageKeys.notificationPermissionPrompt,
    JSON.stringify({ lastShownAt: now } satisfies PromptState),
  );
}
