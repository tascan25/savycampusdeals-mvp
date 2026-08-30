import { getAuthGateDecision } from "@/hooks/useAuthGate";
import type { User } from "@/types/user";

const student = {
  id: "student-1",
  email: "student@example.com",
  role: "student",
  email_verified: false,
} as User;

describe("getAuthGateDecision", () => {
  it("moves a newly registered student from signup to OTP", () => {
    expect(getAuthGateDecision(student, ["(auth)", "register"])).toBe("otp");
  });

  it("does not race the OTP screen's own success navigation", () => {
    expect(getAuthGateDecision(student, ["(auth)", "verify-otp"])).toBeNull();
    expect(getAuthGateDecision({ ...student, email_verified: true }, ["(auth)", "verify-otp"])).toBeNull();
  });

  it("moves a verified login to the main app", () => {
    expect(getAuthGateDecision({ ...student, email_verified: true }, ["(auth)", "login"])).toBe("tabs");
  });

  it("returns a signed-out deep link to login", () => {
    expect(getAuthGateDecision(null, ["offer", "123"])).toBe("login");
  });
});
