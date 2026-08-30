import { z } from "zod";

/** Mirrors backend/server.py's is_valid_student_id() — flexible ID formats,
 * but rejects a value that's actually an email address entered by mistake. */
export const studentIdSchema = z
  .string()
  .trim()
  .min(1, "Student ID / Roll Number is required.")
  .refine(
    (value) => !value.includes("@"),
    "Enter your Student ID / Roll Number, not your email address.",
  );

export const verificationFormSchema = z.object({
  college_name: z.string().trim().min(1, "College name is required."),
  student_id_number: studentIdSchema,
  course: z.string().trim().min(1, "Course is required."),
  year: z.string().trim().min(1, "Year of study is required."),
});
export type VerificationFormValues = z.infer<typeof verificationFormSchema>;
