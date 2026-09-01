import * as Notifications from "expo-notifications";

import {
  buildDesiredLocalNotifications,
  cancelSavedOfferReminder,
  cancelAllManagedLocalNotifications,
  listSavedOfferReminders,
  presentClaimReadyNotification,
  presentVerificationSubmittedNotification,
  reconcileLocalNotifications,
  scheduleSavedOfferReminder,
} from "@/services/localNotifications";
import { deleteAppValue, getAppValue, setAppValue } from "@/storage/appStorage";
import type { CouponClaimResult, Offer } from "@/types/offer";
import type { LevelReward } from "@/types/rewards";
import type { User } from "@/types/user";

jest.mock("@/storage/appStorage", () => ({
  appStorageKeys: {
    localNotificationRegistry: "registry",
    claimNotificationReceipts: "claim-receipts",
    offerReminderRegistry: "offer-reminders",
  },
  getAppValue: jest.fn(),
  setAppValue: jest.fn(),
  deleteAppValue: jest.fn(),
}));

jest.mock("expo-notifications", () => ({
  AndroidImportance: { HIGH: 4, DEFAULT: 3 },
  SchedulableTriggerInputTypes: { DATE: "date", TIME_INTERVAL: "timeInterval" },
  IosAuthorizationStatus: { PROVISIONAL: 3 },
  getPermissionsAsync: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  cancelScheduledNotificationAsync: jest.fn(),
  cancelAllScheduledNotificationsAsync: jest.fn(),
}));

const now = Date.UTC(2026, 8, 1, 12);
const day = 24 * 60 * 60 * 1000;

const user: User = {
  id: "user-1",
  email: "student@example.com",
  name: "Student",
  role: "student",
  college: "Campus",
  course: "BTech",
  year: "2",
  phone: "",
  avatar_url: "",
  avatar_key: "",
  email_verified: true,
  verification_status: "approved",
  verification_method: "document_review",
  student_number: "SCD-1",
  verification_expiry: new Date(now + 31 * day).toISOString(),
  reverification_email_verified: false,
  savvy_points_balance: 0,
  savvy_points_lifetime: 0,
  reward_points: 0,
  referral_code: "REF",
  outlet_id: null,
  active: true,
  created_at: new Date(now).toISOString(),
};

function coupon(overrides: Partial<CouponClaimResult> = {}): CouponClaimResult {
  return {
    id: "coupon-1",
    code: "SECRET",
    offer_id: "offer-1",
    offer_title: "20% off lunch",
    brand: "Campus Cafe",
    brand_logo: "",
    discount: "20%",
    image_url: "",
    qr_data_uri: "",
    status: "active",
    created_at: new Date(now).toISOString(),
    expires_at: new Date(now + 25 * 60 * 60 * 1000).toISOString(),
    redeemed_at: null,
    ...overrides,
  };
}

function reward(overrides: Partial<LevelReward> = {}): LevelReward {
  return {
    id: "reward-1",
    tier_key: "deal_hunter",
    tier_name: "Deal Hunter",
    reward_title: "A free drink",
    code: "SECRET",
    qr_data_uri: "",
    status: "active",
    unlocked_at: new Date(now).toISOString(),
    expires_at: new Date(now + 8 * day).toISOString(),
    redeemed_at: null,
    redeemed_outlet_id: null,
    ...overrides,
  };
}

const offer: Offer = {
  id: "offer-1",
  title: "20% off lunch",
  brand: "Campus Cafe",
  brand_logo: "",
  brand_url: "",
  category: "Food",
  categories: ["Food"],
  description: "",
  discount: "20%",
  image_url: "",
  terms: "",
  validity: "",
  featured: false,
  trending: false,
  location: "Campus",
  claims_count: 0,
  saved: true,
  outlet_id: "outlet-1",
  offer_type: "partner_outlet",
  disclaimer: "",
  redemption_policy: "daily",
  created_at: new Date(now).toISOString(),
};

describe("local notification planning", () => {
  beforeEach(() => jest.clearAllMocks());

  it("plans verification, coupon and reward reminders without sensitive codes", () => {
    const desired = buildDesiredLocalNotifications({
      user,
      coupons: [coupon()],
      levelRewards: [reward()],
      now,
    });

    expect(desired.map((item) => item.key)).toEqual(
      expect.arrayContaining([
        "verification:user-1:30d",
        "verification:user-1:7d",
        "verification:user-1:1d",
        "verification:user-1:expired",
        "coupon:coupon-1:halfway",
        "coupon:coupon-1:24h",
        "coupon:coupon-1:1h",
        "coupon:coupon-1:expired",
        "reward:reward-1:7d",
        "reward:reward-1:1d",
      ]),
    );
    expect(JSON.stringify(desired)).not.toContain("SECRET");
  });

  it("plans and then removes incomplete-verification reminders as status changes", () => {
    const incomplete = buildDesiredLocalNotifications({
      user: { ...user, verification_status: "not_submitted", verification_expiry: null },
      coupons: [],
      levelRewards: [],
      now,
    });
    expect(incomplete.map((item) => item.key)).toEqual([
      "verification:user-1:incomplete:24h",
      "verification:user-1:incomplete:3d",
    ]);
    const submitted = buildDesiredLocalNotifications({
      user: { ...user, verification_status: "pending", verification_expiry: null },
      coupons: [],
      levelRewards: [],
      now,
    });
    expect(submitted).toEqual([]);
  });

  it("does not schedule reminders for redeemed or expired records", () => {
    const desired = buildDesiredLocalNotifications({
      user: { ...user, verification_status: "expired" },
      coupons: [coupon({ status: "redeemed" })],
      levelRewards: [reward({ status: "expired" })],
      now,
    });
    expect(desired).toEqual([]);
  });

  it("prioritizes the nearest reminders within the iOS-safe budget", () => {
    const coupons = Array.from({ length: 30 }, (_, index) =>
      coupon({
        id: `coupon-${index}`,
        expires_at: new Date(now + (index + 2) * day).toISOString(),
      }),
    );
    const desired = buildDesiredLocalNotifications({ user, coupons, levelRewards: [], now });
    expect(desired).toHaveLength(48);
    expect(
      desired.every((item, index) => index === 0 || desired[index - 1]!.fireAt <= item.fireAt),
    ).toBe(true);
  });
});

describe("local notification reconciliation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(getAppValue).mockResolvedValue(null);
    jest.mocked(setAppValue).mockResolvedValue();
    jest.mocked(deleteAppValue).mockResolvedValue();
    jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue({
      granted: true,
    } as Notifications.NotificationPermissionsStatus);
    jest.mocked(Notifications.setNotificationChannelAsync).mockResolvedValue(null);
    let nextId = 0;
    jest
      .mocked(Notifications.scheduleNotificationAsync)
      .mockImplementation(async () => `id-${++nextId}`);
    jest.mocked(Notifications.cancelScheduledNotificationAsync).mockResolvedValue();
    jest.mocked(Notifications.cancelAllScheduledNotificationsAsync).mockResolvedValue();
  });

  it("persists OS identifiers for every successfully scheduled reminder", async () => {
    const count = await reconcileLocalNotifications({
      user: { ...user, verification_status: "not_submitted", verification_expiry: null },
      coupons: [coupon()],
      levelRewards: [],
      now,
    });
    expect(count).toBe(6);
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(6);
    expect(setAppValue).toHaveBeenCalledWith(
      "registry",
      expect.stringContaining("coupon:coupon-1"),
    );
  });

  it("cancels every managed OS notification during logout cleanup", async () => {
    jest.mocked(getAppValue).mockImplementation(async (key) =>
      key === "registry"
        ? JSON.stringify([
            {
              key: "one",
              ownerId: "user-1",
              notificationId: "native-1",
              fireAt: now,
              fingerprint: "x",
            },
            {
              key: "two",
              ownerId: "user-1",
              notificationId: "native-2",
              fireAt: now,
              fingerprint: "y",
            },
          ])
        : null,
    );
    await cancelAllManagedLocalNotifications();
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledTimes(2);
    expect(Notifications.cancelAllScheduledNotificationsAsync).toHaveBeenCalledTimes(1);
    expect(deleteAppValue).toHaveBeenCalledWith("registry");
  });

  it("presents a privacy-safe notification after verification submission", async () => {
    await expect(presentVerificationSubmittedNotification()).resolves.toBe(true);
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({
          title: "Verification submitted",
          data: expect.objectContaining({ event: "verification_submitted", route: "/verify" }),
        }),
      }),
    );
    expect(
      JSON.stringify(jest.mocked(Notifications.scheduleNotificationAsync).mock.calls),
    ).not.toContain("document_review");
  });

  it("does not attempt delivery when notification permission is unavailable", async () => {
    jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue({
      granted: false,
    } as Notifications.NotificationPermissionsStatus);
    await expect(presentVerificationSubmittedNotification()).resolves.toBe(false);
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it("presents a coupon-ready notification without exposing its code", async () => {
    const result = coupon();
    await expect(presentClaimReadyNotification(result)).resolves.toBe(true);
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({
          title: "Your coupon is ready 🎉",
          body: expect.stringContaining(result.offer_title),
          data: expect.objectContaining({ event: "coupon_claimed", route: "/wallet" }),
        }),
      }),
    );
    expect(
      JSON.stringify(jest.mocked(Notifications.scheduleNotificationAsync).mock.calls),
    ).not.toContain(result.code);
    expect(setAppValue).toHaveBeenCalledWith("claim-receipts", expect.stringContaining(result.id));
  });

  it("does not present the same claim notification twice", async () => {
    const result = coupon();
    jest.mocked(getAppValue).mockResolvedValue(JSON.stringify([`coupon:${result.id}`]));
    await expect(presentClaimReadyNotification(result)).resolves.toBe(false);
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it("schedules, lists and replaces a saved-offer reminder without sensitive data", async () => {
    const fireAt = Date.now() + day;
    const reminder = await scheduleSavedOfferReminder({ ownerId: user.id, offer, fireAt });
    expect(reminder).toEqual(expect.objectContaining({ offerId: offer.id, fireAt }));
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({
          body: `${offer.brand}: ${offer.title}`,
          data: expect.objectContaining({ route: `/offer/${offer.id}` }),
        }),
      }),
    );
    expect(setAppValue).toHaveBeenCalledWith("offer-reminders", expect.stringContaining(offer.id));
    expect(
      JSON.stringify(jest.mocked(Notifications.scheduleNotificationAsync).mock.calls),
    ).not.toContain("SECRET");
  });

  it("cancels a saved-offer reminder and excludes expired entries from the list", async () => {
    jest.mocked(getAppValue).mockImplementation(async (key) =>
      key === "offer-reminders"
        ? JSON.stringify([
            {
              ownerId: user.id,
              offerId: offer.id,
              notificationId: "saved-native-1",
              fireAt: Date.now() + day,
              brand: offer.brand,
              offerTitle: offer.title,
            },
            {
              ownerId: user.id,
              offerId: "expired-offer",
              notificationId: "saved-native-old",
              fireAt: Date.now() - day,
              brand: "Old",
              offerTitle: "Old offer",
            },
          ])
        : null,
    );
    await expect(listSavedOfferReminders(user.id)).resolves.toHaveLength(1);
    await cancelSavedOfferReminder(user.id, offer.id);
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith("saved-native-1");
    expect(setAppValue).toHaveBeenCalledWith(
      "offer-reminders",
      expect.not.stringContaining(`\"offerId\":\"${offer.id}\"`),
    );
  });
});
