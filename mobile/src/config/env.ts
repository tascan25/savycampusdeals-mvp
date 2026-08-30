import { z } from "zod";

/**
 * Every EXPO_PUBLIC_* value is bundled into the app and readable by anyone
 * with the built binary — this module only validates *shape*, it must never
 * be the place a secret is introduced. See mobile/.env.example.
 */
const envSchema = z.object({
  APP_ENV: z.enum(["development", "staging", "production"]).default("development"),
  API_URL: z.string().url(),
  WEB_URL: z.string().url(),
});

function readEnv() {
  const parsed = envSchema.safeParse({
    APP_ENV: process.env.EXPO_PUBLIC_APP_ENV,
    API_URL: process.env.EXPO_PUBLIC_API_URL,
    WEB_URL: process.env.EXPO_PUBLIC_WEB_URL,
  });

  if (!parsed.success) {
    throw new Error(
      `Invalid mobile app environment configuration: ${parsed.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("; ")}. Check mobile/.env against mobile/.env.example.`,
    );
  }

  return parsed.data;
}

export const env = readEnv();
