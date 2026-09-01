import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { appStorageKeys, deleteAppValue, getAppValue, setAppValue } from "@/storage/appStorage";
import {
  isBrandOfferClaim,
  type ClaimResult,
  type CouponClaimResult,
  type Offer,
} from "@/types/offer";
import type { LevelReward } from "@/types/rewards";
import type { User } from "@/types/user";

const MAX_MANAGED_SCHEDULES = 48;
const MAX_SAVED_OFFER_REMINDERS = 12;
const MAX_CLAIM_NOTIFICATION_RECEIPTS = 100;
const MIN_FUTURE_DELAY_MS = 30_000;
const DAY_MS = 24 * 60 * 60 * 1000;

export type NotificationChannel = "account" | "reminders" | "deals";

type DesiredNotification = {
  key: string;
  ownerId: string;
  fireAt: number;
  title: string;
  body: string;
  route: string;
  channel: NotificationChannel;
  playSound?: boolean;
};

type RegistryEntry = {
  key: string;
  ownerId: string;
  notificationId: string;
  fireAt: number;
  fingerprint: string;
};

export type SavedOfferReminder = {
  ownerId: string;
  offerId: string;
  notificationId: string;
  fireAt: number;
  brand: string;
  offerTitle: string;
};

export type LocalNotificationReconciliationInput = {
  user: User;
  coupons: CouponClaimResult[];
  levelRewards: LevelReward[];
  now?: number;
};

let mutationQueue: Promise<void> = Promise.resolve();
let notificationChannelsPromise: Promise<void> | null = null;

function defaultNotificationSound(): true | "default" {
  // expo-notifications 57 treats `sound: "default"` on an Android channel as
  // a custom filename and logs an error. A boolean requests Android's built-in
  // sound; iOS uses its documented `default` value.
  return Platform.OS === "android" ? true : "default";
}

function enqueue<T>(operation: () => Promise<T>): Promise<T> {
  const result = mutationQueue.then(operation, operation);
  mutationQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

export async function ensureNotificationChannels(): Promise<void> {
  if (Platform.OS !== "android") return;
  if (!notificationChannelsPromise) {
    notificationChannelsPromise = Promise.all([
      Notifications.setNotificationChannelAsync("account", {
        name: "Important account updates",
        description: "Verification, account and security updates",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 220, 120, 220],
      }),
      Notifications.setNotificationChannelAsync("reminders", {
        name: "Reminders",
        description: "Coupon, reward and membership reminders",
        importance: Notifications.AndroidImportance.DEFAULT,
      }),
      Notifications.setNotificationChannelAsync("deals", {
        name: "Deals and announcements",
        description: "New campus deals and Savvy announcements",
        importance: Notifications.AndroidImportance.DEFAULT,
      }),
    ])
      .then(() => undefined)
      .catch((error: unknown) => {
        notificationChannelsPromise = null;
        throw error;
      });
  }
  await notificationChannelsPromise;
}

function safeDate(value: string | null): number | null {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

function addReminder(
  target: DesiredNotification[],
  input: Omit<DesiredNotification, "fireAt"> & { eventAt: number; leadMs: number },
  now: number,
): void {
  const fireAt = input.eventAt - input.leadMs;
  if (fireAt <= now + MIN_FUTURE_DELAY_MS) return;
  const { eventAt: _eventAt, leadMs: _leadMs, ...notification } = input;
  target.push({ ...notification, fireAt });
}

export function buildDesiredLocalNotifications({
  user,
  coupons,
  levelRewards,
  now = Date.now(),
}: LocalNotificationReconciliationInput): DesiredNotification[] {
  const desired: DesiredNotification[] = [];
  const verificationExpiry = safeDate(user.verification_expiry);
  const accountCreatedAt = safeDate(user.created_at);

  if (user.verification_status === "not_submitted" && accountCreatedAt) {
    for (const [label, delayMs, wording] of [
      ["24h", DAY_MS, "Complete your student verification to start claiming campus deals."],
      [
        "3d",
        3 * DAY_MS,
        "Your Savvy deals are waiting. Finish student verification when you're ready.",
      ],
    ] as const) {
      addReminder(
        desired,
        {
          key: `verification:${user.id}:incomplete:${label}`,
          ownerId: user.id,
          eventAt: accountCreatedAt + delayMs,
          leadMs: 0,
          title: "Finish setting up Savvy",
          body: wording,
          route: "/verify",
          channel: "account",
        },
        now,
      );
    }
  }

  if (user.verification_status === "approved" && verificationExpiry) {
    for (const [label, leadMs] of [
      ["30d", 30 * DAY_MS],
      ["7d", 7 * DAY_MS],
      ["1d", DAY_MS],
    ] as const) {
      addReminder(
        desired,
        {
          key: `verification:${user.id}:${label}`,
          ownerId: user.id,
          eventAt: verificationExpiry,
          leadMs,
          title: "Student verification expiring",
          body: `Your Savvy student verification expires ${label === "1d" ? "tomorrow" : `in ${label.replace("d", " days")}`}. Renew it to keep claiming deals.`,
          route: "/verify",
          channel: "account",
        },
        now,
      );
    }
    addReminder(
      desired,
      {
        key: `verification:${user.id}:expired`,
        ownerId: user.id,
        eventAt: verificationExpiry + 60_000,
        leadMs: 0,
        title: "Student verification expired",
        body: "Renew your student verification to continue claiming Savvy deals.",
        route: "/verify",
        channel: "account",
      },
      now,
    );
  }

  for (const coupon of coupons) {
    if (coupon.status !== "active") continue;
    const expiry = safeDate(coupon.expires_at);
    if (!expiry) continue;
    const createdAt = safeDate(coupon.created_at);
    if (createdAt && createdAt < expiry) {
      addReminder(
        desired,
        {
          key: `coupon:${coupon.id}:halfway`,
          ownerId: user.id,
          eventAt: createdAt + (expiry - createdAt) / 2,
          leadMs: 0,
          title: "Your Savvy coupon is waiting",
          body: `${coupon.brand}: You still have time to use ${coupon.offer_title}.`,
          route: "/wallet",
          channel: "reminders",
        },
        now,
      );
    }
    for (const [label, leadMs, wording] of [
      ["24h", DAY_MS, "expires tomorrow"],
      ["1h", 60 * 60 * 1000, "expires in one hour"],
    ] as const) {
      addReminder(
        desired,
        {
          key: `coupon:${coupon.id}:${label}`,
          ownerId: user.id,
          eventAt: expiry,
          leadMs,
          title: "Use your Savvy coupon",
          body: `${coupon.brand}: ${coupon.offer_title} ${wording}.`,
          route: "/wallet",
          channel: "reminders",
        },
        now,
      );
    }
    addReminder(
      desired,
      {
        key: `coupon:${coupon.id}:expired`,
        ownerId: user.id,
        eventAt: expiry + 60_000,
        leadMs: 0,
        title: "Coupon expired",
        body: `Your ${coupon.brand} coupon is no longer available to redeem.`,
        route: "/wallet",
        channel: "reminders",
      },
      now,
    );
  }

  for (const reward of levelRewards) {
    if (reward.status !== "active") continue;
    const expiry = safeDate(reward.expires_at);
    if (!expiry) continue;
    for (const [label, leadMs, wording] of [
      ["7d", 7 * DAY_MS, "expires in 7 days"],
      ["1d", DAY_MS, "expires tomorrow"],
    ] as const) {
      addReminder(
        desired,
        {
          key: `reward:${reward.id}:${label}`,
          ownerId: user.id,
          eventAt: expiry,
          leadMs,
          title: "Your Savvy reward is waiting",
          body: `${reward.reward_title} ${wording}.`,
          route: "/rewards",
          channel: "reminders",
        },
        now,
      );
    }
  }

  return desired.sort((a, b) => a.fireAt - b.fireAt).slice(0, MAX_MANAGED_SCHEDULES);
}

function fingerprint(spec: DesiredNotification): string {
  return JSON.stringify([
    spec.fireAt,
    spec.title,
    spec.body,
    spec.route,
    spec.channel,
    Boolean(spec.playSound),
  ]);
}

async function readRegistry(): Promise<RegistryEntry[]> {
  const raw = await getAppValue(appStorageKeys.localNotificationRegistry);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as RegistryEntry[]) : [];
  } catch {
    return [];
  }
}

async function writeRegistry(entries: RegistryEntry[]): Promise<void> {
  if (entries.length === 0) {
    await deleteAppValue(appStorageKeys.localNotificationRegistry);
    return;
  }
  await setAppValue(appStorageKeys.localNotificationRegistry, JSON.stringify(entries));
}

async function readOfferReminderRegistry(): Promise<SavedOfferReminder[]> {
  const raw = await getAppValue(appStorageKeys.offerReminderRegistry);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as SavedOfferReminder[]) : [];
  } catch {
    return [];
  }
}

async function writeOfferReminderRegistry(entries: SavedOfferReminder[]): Promise<void> {
  if (entries.length === 0) {
    await deleteAppValue(appStorageKeys.offerReminderRegistry);
    return;
  }
  await setAppValue(appStorageKeys.offerReminderRegistry, JSON.stringify(entries));
}

async function schedule(spec: DesiredNotification): Promise<RegistryEntry> {
  const notificationId = await Notifications.scheduleNotificationAsync({
    content: {
      title: spec.title,
      body: spec.body,
      sound: spec.playSound ? defaultNotificationSound() : undefined,
      data: {
        route: spec.route,
        local_notification: true,
        logical_key: spec.key,
        play_sound: Boolean(spec.playSound),
      },
      color: "#4F46E5",
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: new Date(spec.fireAt),
      channelId: spec.channel,
    },
  });
  return {
    key: spec.key,
    ownerId: spec.ownerId,
    notificationId,
    fireAt: spec.fireAt,
    fingerprint: fingerprint(spec),
  };
}

export async function reconcileLocalNotifications(
  input: LocalNotificationReconciliationInput,
): Promise<number> {
  return enqueue(async () => {
    await ensureNotificationChannels();
    const desired = buildDesiredLocalNotifications(input);
    const desiredByKey = new Map(desired.map((item) => [item.key, item]));
    const registry = await readRegistry();
    const next: RegistryEntry[] = [];

    for (const entry of registry) {
      const wanted = desiredByKey.get(entry.key);
      if (entry.ownerId === input.user.id && wanted && entry.fingerprint === fingerprint(wanted)) {
        next.push(entry);
        desiredByKey.delete(entry.key);
      } else {
        await Notifications.cancelScheduledNotificationAsync(entry.notificationId).catch(
          () => undefined,
        );
      }
    }

    for (const spec of desiredByKey.values()) {
      try {
        next.push(await schedule(spec));
      } catch {
        // One malformed or OS-rejected reminder must not prevent the remaining
        // valid reminders from being reconciled.
      }
    }

    await writeRegistry(next);
    return next.length;
  });
}

export async function cancelAllManagedLocalNotifications(): Promise<void> {
  await enqueue(async () => {
    const registry = await readRegistry();
    const offerReminders = await readOfferReminderRegistry();
    await Promise.all(
      [...registry, ...offerReminders].map((entry) =>
        Notifications.cancelScheduledNotificationAsync(entry.notificationId).catch(() => undefined),
      ),
    );
    // Also covers a corrupted/lost registry so another user's reminders can
    // never survive logout on a shared phone. Savvy is the sole scheduler in
    // this app, so clearing all pending local requests is intentional here.
    await Notifications.cancelAllScheduledNotificationsAsync().catch(() => undefined);
    await writeRegistry([]);
    await writeOfferReminderRegistry([]);
  });
}

export async function getManagedLocalNotificationCount(): Promise<number> {
  const [registry, offerReminders] = await Promise.all([
    readRegistry(),
    readOfferReminderRegistry(),
  ]);
  return registry.length + offerReminders.filter((entry) => entry.fireAt > Date.now()).length;
}

export async function listSavedOfferReminders(ownerId: string): Promise<SavedOfferReminder[]> {
  return (await readOfferReminderRegistry())
    .filter((entry) => entry.ownerId === ownerId && entry.fireAt > Date.now())
    .sort((a, b) => a.fireAt - b.fireAt);
}

export async function scheduleSavedOfferReminder(input: {
  ownerId: string;
  offer: Offer;
  fireAt: number;
}): Promise<SavedOfferReminder> {
  if (input.fireAt <= Date.now() + MIN_FUTURE_DELAY_MS) {
    throw new Error("Choose a reminder time at least one minute from now.");
  }
  const permissions = await Notifications.getPermissionsAsync();
  const authorized =
    permissions.granted ||
    (Platform.OS === "ios" &&
      permissions.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL);
  if (!authorized) throw new Error("Notification permission is required to create a reminder.");

  return enqueue(async () => {
    await ensureNotificationChannels();
    const registry = (await readOfferReminderRegistry()).filter(
      (entry) => entry.fireAt > Date.now(),
    );
    const existing = registry.find(
      (entry) => entry.ownerId === input.ownerId && entry.offerId === input.offer.id,
    );
    const ownerReminderCount = registry.filter((entry) => entry.ownerId === input.ownerId).length;
    if (!existing && ownerReminderCount >= MAX_SAVED_OFFER_REMINDERS) {
      throw new Error("You can keep up to 12 saved-offer reminders at a time.");
    }
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: "Your saved deal is waiting",
        body: `${input.offer.brand}: ${input.offer.title}`,
        sound: defaultNotificationSound(),
        color: "#4F46E5",
        data: {
          route: `/offer/${input.offer.id}`,
          local_notification: true,
          event: "saved_offer_reminder",
          play_sound: true,
        },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(input.fireAt),
        channelId: "reminders",
      },
    });
    if (existing) {
      await Notifications.cancelScheduledNotificationAsync(existing.notificationId).catch(
        () => undefined,
      );
    }
    const reminder: SavedOfferReminder = {
      ownerId: input.ownerId,
      offerId: input.offer.id,
      notificationId,
      fireAt: input.fireAt,
      brand: input.offer.brand,
      offerTitle: input.offer.title,
    };
    await writeOfferReminderRegistry([
      ...registry.filter(
        (entry) => !(entry.ownerId === input.ownerId && entry.offerId === input.offer.id),
      ),
      reminder,
    ]);
    return reminder;
  });
}

export async function cancelSavedOfferReminder(ownerId: string, offerId: string): Promise<void> {
  await enqueue(async () => {
    const registry = await readOfferReminderRegistry();
    const matches = registry.filter(
      (entry) => entry.ownerId === ownerId && entry.offerId === offerId,
    );
    await Promise.all(
      matches.map((entry) =>
        Notifications.cancelScheduledNotificationAsync(entry.notificationId).catch(() => undefined),
      ),
    );
    await writeOfferReminderRegistry(
      registry.filter((entry) => !(entry.ownerId === ownerId && entry.offerId === offerId)),
    );
  });
}

export async function presentVerificationSubmittedNotification(): Promise<boolean> {
  const permissions = await Notifications.getPermissionsAsync();
  const authorized =
    permissions.granted ||
    (Platform.OS === "ios" &&
      permissions.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL);
  if (!authorized) return false;

  await ensureNotificationChannels();
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Verification submitted",
      body: "Your student documents are with the Savvy team. Review usually finishes within 24 hours.",
      sound: defaultNotificationSound(),
      color: "#4F46E5",
      data: {
        route: "/verify",
        local_notification: true,
        event: "verification_submitted",
        play_sound: true,
      },
    },
    trigger: Platform.OS === "android" ? { channelId: "account" } : null,
  });
  return true;
}

export async function presentClaimReadyNotification(result: ClaimResult): Promise<boolean> {
  const permissions = await Notifications.getPermissionsAsync();
  const authorized =
    permissions.granted ||
    (Platform.OS === "ios" &&
      permissions.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL);
  if (!authorized) return false;

  return enqueue(async () => {
    const isBrandClaim = isBrandOfferClaim(result);
    const receipt = `${isBrandClaim ? "brand" : "coupon"}:${result.id}`;
    const rawReceipts = await getAppValue(appStorageKeys.claimNotificationReceipts);
    let receipts: string[] = [];
    try {
      const parsed = rawReceipts ? (JSON.parse(rawReceipts) as unknown) : [];
      if (Array.isArray(parsed))
        receipts = parsed.filter((item): item is string => typeof item === "string");
    } catch {
      receipts = [];
    }
    if (receipts.includes(receipt)) return false;

    await ensureNotificationChannels();
    await Notifications.scheduleNotificationAsync({
      content: {
        title: isBrandClaim ? "Your offer link is ready 🎉" : "Your coupon is ready 🎉",
        body: isBrandClaim
          ? `${result.brand}: ${result.offer_title} is saved in your claimed online offers.`
          : `${result.brand}: ${result.offer_title} is waiting in your wallet.`,
        sound: defaultNotificationSound(),
        color: "#4F46E5",
        data: {
          route: isBrandClaim ? "/brand-claims" : "/wallet",
          local_notification: true,
          event: isBrandClaim ? "brand_offer_claimed" : "coupon_claimed",
          play_sound: true,
        },
      },
      trigger: Platform.OS === "android" ? { channelId: "account" } : null,
    });
    await setAppValue(
      appStorageKeys.claimNotificationReceipts,
      JSON.stringify([...receipts, receipt].slice(-MAX_CLAIM_NOTIFICATION_RECEIPTS)),
    );
    return true;
  });
}

export async function presentDevelopmentNotification(): Promise<void> {
  await ensureNotificationChannels();
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Savvy notifications are ready ✨",
      body: "Tap to explore your campus deals.",
      color: "#4F46E5",
      data: { route: "/offers", local_notification: true, development_test: true },
    },
    trigger: null,
  });
}

export async function scheduleDevelopmentNotification(seconds = 10): Promise<string> {
  await ensureNotificationChannels();
  return Notifications.scheduleNotificationAsync({
    content: {
      title: "Your Savvy reminder works",
      body: `This local notification was scheduled ${seconds} seconds ago.`,
      color: "#4F46E5",
      data: { route: "/wallet", local_notification: true, development_test: true },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds,
      channelId: "reminders",
    },
  });
}
