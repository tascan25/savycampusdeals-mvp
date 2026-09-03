import { pickDefaultRewardTier } from "@/components/LevelRewardsSection";
import type { LevelReward, SavvyTier } from "@/types/rewards";

const rewardTiers: SavvyTier[] = [
  { key: "deal_hunter", name: "Deal Hunter", minimum: 2000, benefit: "", reward: "" },
  { key: "savvy_insider", name: "Savvy Insider", minimum: 5000, benefit: "", reward: "" },
  { key: "campus_icon", name: "Campus Icon", minimum: 12000, benefit: "", reward: "" },
];

function reward(overrides: Partial<LevelReward>): LevelReward {
  return {
    id: "r1",
    tier_key: "deal_hunter",
    tier_name: "Deal Hunter",
    reward_title: "",
    code: "",
    qr_data_uri: "",
    status: "active",
    unlocked_at: null,
    expires_at: null,
    redeemed_at: null,
    redeemed_outlet_id: null,
    ...overrides,
  };
}

describe("pickDefaultRewardTier", () => {
  it("prefers the most-advanced tier with an unclaimed active reward", () => {
    const rewardsByKey = {
      deal_hunter: reward({ tier_key: "deal_hunter", status: "redeemed" }),
      savvy_insider: reward({ tier_key: "savvy_insider", status: "active" }),
    };
    expect(pickDefaultRewardTier(rewardTiers, rewardsByKey, 5500)).toBe("savvy_insider");
  });

  it("falls back to the next locked tier when nothing is active", () => {
    const rewardsByKey = { deal_hunter: reward({ tier_key: "deal_hunter", status: "redeemed" }) };
    expect(pickDefaultRewardTier(rewardTiers, rewardsByKey, 2500)).toBe("savvy_insider");
  });

  it("falls back to the last tier once every tier is reached", () => {
    expect(pickDefaultRewardTier(rewardTiers, {}, 13000)).toBe("campus_icon");
  });
});
