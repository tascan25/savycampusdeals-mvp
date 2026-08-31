import { getVerificationHref } from "@/utils/verificationRoute";

describe("getVerificationHref", () => {
  it("sends an email-unverified user to OTP first", () => {
    expect(getVerificationHref({ email: "student@example.com", email_verified: false })).toEqual({
      pathname: "/(auth)/verify-otp",
      params: { email: "student@example.com" },
    });
  });

  it("sends an email-verified user to student verification", () => {
    expect(getVerificationHref({ email: "student@example.com", email_verified: true })).toBe(
      "/verify",
    );
  });
});
