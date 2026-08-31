import type { Href } from "expo-router";

import type { User } from "@/types/user";

/** Keeps student verification ordered: email first, academic proof second. */
export function getVerificationHref(
  user: Pick<User, "email" | "email_verified"> | null | undefined,
): Href {
  if (user && !user.email_verified) {
    return { pathname: "/(auth)/verify-otp", params: { email: user.email } };
  }
  return "/verify";
}
