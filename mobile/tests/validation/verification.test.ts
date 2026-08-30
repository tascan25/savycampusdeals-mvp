import { studentIdSchema, verificationFormSchema } from "@/validation/verification";

describe("studentIdSchema", () => {
  it("accepts a plain roll number", () => {
    expect(studentIdSchema.safeParse("CS2026-0142").success).toBe(true);
  });

  it("rejects an email address entered by mistake", () => {
    const result = studentIdSchema.safeParse("student@college.edu");
    expect(result.success).toBe(false);
  });

  it("rejects an empty value", () => {
    expect(studentIdSchema.safeParse("   ").success).toBe(false);
  });
});

describe("verificationFormSchema", () => {
  it("accepts a fully filled form", () => {
    const result = verificationFormSchema.safeParse({
      college_name: "IIT Delhi",
      student_id_number: "2026CS0142",
      course: "B.Tech CSE",
      year: "2nd year",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a missing college name", () => {
    const result = verificationFormSchema.safeParse({
      college_name: "",
      student_id_number: "2026CS0142",
      course: "B.Tech CSE",
      year: "2nd year",
    });
    expect(result.success).toBe(false);
  });
});
