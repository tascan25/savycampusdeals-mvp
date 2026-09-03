import type { Offer } from "./offer";
import type { Outlet } from "./outlet";

export type PartnerPeriod = "today" | "7d" | "30d" | "all";
export type PartnerCouponStatus = "active" | "redeemed" | "expired";

export type PartnerActivityItem = {
  id: string;
  code: string;
  status: PartnerCouponStatus;
  student_name: string;
  student_number: string;
  offer_id: string;
  offer_title: string;
  discount: string;
  claimed_at: string | null;
  expires_at: string | null;
  redeemed_at: string | null;
};

export type PartnerProfile = {
  name: string;
  email: string;
  role: "outlet_partner" | "admin";
  outlet: Outlet | null;
};

export type PartnerDashboard = {
  period: PartnerPeriod;
  outlet: Outlet;
  summary: {
    claimed: number;
    active: number;
    redeemed: number;
    expired: number;
    unique_students: number;
    redemption_rate: number;
  };
  trend: { date: string; claimed: number; redeemed: number }[];
  offers: {
    offer: Offer;
    claimed: number;
    active: number;
    redeemed: number;
    expired: number;
    redemption_rate: number;
  }[];
  recent: PartnerActivityItem[];
};

export type PartnerActivityResponse = {
  items: PartnerActivityItem[];
  page: number;
  page_size: number;
  total: number;
};

export type ScanLookupResult = {
  kind: "student" | "coupon" | "level_reward" | "freshers_cafe";
  code?: string;
  status?: PartnerCouponStatus;
  expired?: boolean;
  verified?: boolean;
  student_verified?: boolean;
  student_expiry_expired?: boolean;
  student_name?: string;
  name?: string;
  student_number?: string;
  college?: string;
  student_college?: string;
  offer_title?: string;
  reward_title?: string;
  tier_name?: string;
  brand?: string;
  discount?: string;
  expires_at?: string | null;
  redeemed_at?: string | null;
};
