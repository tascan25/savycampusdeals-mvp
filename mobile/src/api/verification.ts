import type {
  StartReverificationResult,
  StudentCard,
  SubmitVerificationResult,
  VerificationStatusResponse,
} from "@/types/verification";

import { apiClient } from "./client";

export async function apiGetVerificationStatus(): Promise<VerificationStatusResponse> {
  const { data } = await apiClient.get("/verification/status");
  return data;
}

export async function apiSubmitVerification(input: {
  college_id_image?: string;
  selfie_image?: string;
  college_name: string;
  course: string;
  year: string;
  student_id_number: string;
}): Promise<SubmitVerificationResult> {
  // Two base64 images are validated and uploaded before this request returns.
  // Give it a dedicated window instead of the shorter default used by normal
  // JSON requests, otherwise the server may succeed after the app times out.
  const { data } = await apiClient.post("/verification/submit", input, { timeout: 60_000 });
  return data;
}

export async function apiStartReverification(): Promise<StartReverificationResult> {
  const { data } = await apiClient.post("/auth/start-reverification");
  return data;
}

export async function apiGetStudentCard(): Promise<StudentCard> {
  const { data } = await apiClient.get("/student-card");
  return data;
}
