import type { User, VerificationStatus } from "./user";

/** Mirrors GET /api/verification/status. */
export type VerificationStatusResponse = {
  status: VerificationStatus;
  student_number: string;
  expiry: string | null;
  last_submission: string | null;
};

/** Mirrors GET /api/student-card (only reachable once verification_status === "approved"). */
export type StudentCard = {
  name: string;
  college: string;
  course: string;
  year: string;
  student_number: string;
  email: string;
  avatar_url: string;
  expiry: string | null;
  qr_data_uri: string;
};

/** Mirrors POST /api/verification/submit. */
export type SubmitVerificationResult = {
  ok: boolean;
  verification_method: "college_email" | "document_review";
  user: User;
  freshers_reward_unlocked: boolean;
};

/** Mirrors POST /api/auth/start-reverification. */
export type StartReverificationResult = {
  ok: boolean;
  email_sent: boolean;
  user: User;
  dev_otp?: string;
  email_error?: string;
};
