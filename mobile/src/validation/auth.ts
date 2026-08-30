import { z } from "zod";

/** Mirrors backend/server.py's validate_password() exactly so client-side
 * errors match what the server would say — server remains the authority. */
export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters long.")
  .regex(/[A-Z]/, "Password must include at least one uppercase letter.")
  .regex(/[0-9]/, "Password must include at least one digit.")
  .regex(/[^A-Za-z0-9\s]/, "Password must include at least one special character.")
  .refine((value) => !/\s/.test(value), "Password must not contain spaces.");

export const emailSchema = z
  .string()
  .trim()
  .min(1, "Email is required.")
  .email("Enter a valid email address.");

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required."),
});
export type LoginFormValues = z.infer<typeof loginSchema>;

export const registerSchema = z
  .object({
    name: z.string().trim().min(2, "Enter your full name."),
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Confirm your password."),
    college: z.string().trim().optional(),
    course: z.string().trim().optional(),
    year: z.string().trim().optional(),
    referralCode: z.string().trim().optional(),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });
export type RegisterFormValues = z.infer<typeof registerSchema>;

export const otpSchema = z.object({
  otp: z
    .string()
    .length(6, "Enter the 6-digit code.")
    .regex(/^\d{6}$/, "Code must be numeric."),
});
export type OtpFormValues = z.infer<typeof otpSchema>;

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});
export type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  password: passwordSchema,
});
export type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;
