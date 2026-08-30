export type SavvyTierKey = "campus_starter" | "deal_hunter" | "savvy_insider" | "campus_icon";

/** A single entry from backend/server.py's SAVVY_POINT_TIERS. */
export type SavvyTier = {
  key: SavvyTierKey;
  name: string;
  minimum: number;
  benefit: string;
  reward: string;
};

/** The `tier` field of GET /api/savvy-points/overview — savvy_tier(lifetime). */
export type CurrentSavvyTier = SavvyTier & {
  index: number;
  progress_percent: number;
  points_to_next: number;
  next_tier: SavvyTier | null;
};

export type WayToEarn =
  | {
      type: "redeem" | "verify";
      title: string;
      description: string;
      points: number;
      cta: string;
      href: string;
      completed?: boolean;
    }
  | {
      type: "refer";
      title: string;
      description: string;
      points: number;
      cta: string;
      referral_code: string;
    };

export type PointsActivityItem = {
  id: string;
  amount: number;
  event_type: "redemption" | "referral" | "verification" | "welcome" | "legacy_balance" | "bonus";
  title: string;
  description: string;
  status: string;
  created_at: string | null;
};

export type LevelRewardStatus = "active" | "redeemed" | "expired";

/** Mirrors serialize_level_reward() — a one-time reward unlocked at a tier threshold. */
export type LevelReward = {
  id: string;
  tier_key: string;
  tier_name: string;
  reward_title: string;
  code: string;
  qr_data_uri: string;
  status: LevelRewardStatus;
  unlocked_at: string | null;
  expires_at: string | null;
  redeemed_at: string | null;
  redeemed_outlet_id: string | null;
};

/** Mirrors GET /api/savvy-points/overview. */
export type SavvyPointsOverview = {
  balance: number;
  lifetime: number;
  tier: CurrentSavvyTier;
  pending_referrals: number;
  activity: PointsActivityItem[];
  ways_to_earn: WayToEarn[];
  tiers: SavvyTier[];
  level_rewards: LevelReward[];
};
