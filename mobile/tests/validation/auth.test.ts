import { registerSchema } from "@/validation/auth";

const validRegistration = {
  name: "Aarav Sharma",
  email: "aarav@college.edu",
  password: "Campus@123",
  confirmPassword: "Campus@123",
  college: "Savvy University",
  course: "Computer Science",
  year: "2nd year",
  referralCode: "SAVY1234",
};

describe("mobile registration", () => {
  it("accepts every field used by the website registration form", () => {
    expect(registerSchema.safeParse(validRegistration).success).toBe(true);
  });

  it("requires matching password confirmation", () => {
    const result = registerSchema.safeParse({ ...validRegistration, confirmPassword: "Different@123" });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0]?.path).toEqual(["confirmPassword"]);
  });
});
