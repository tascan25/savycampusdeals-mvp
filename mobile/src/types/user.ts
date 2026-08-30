/** Mirrors backend/server.py's serialize_user() output. */
export type VerificationStatus = "not_submitted" | "pending" | "approved" | "rejected" | "expired";

export type User = {
  id: string;
  email: string;
  name: string;
  role: "student" | "admin" | "outlet_partner" | "event_staff";
  college: string;
  course: string;
  year: string;
  phone: string;
  avatar_url: string;
  avatar_key: string;
  email_verified: boolean;
  verification_status: VerificationStatus;
  verification_method: "college_email" | "document_review";
  student_number: string;
  verification_expiry: string | null;
  reverification_email_verified: boolean;
  savvy_points_balance: number;
  savvy_points_lifetime: number;
  reward_points: number;
  referral_code: string;
  outlet_id: string | null;
  active: boolean;
  created_at: string | null;
};
