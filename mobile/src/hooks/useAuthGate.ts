import { useRouter, useSegments } from "expo-router";
import { useEffect } from "react";

import type { User } from "@/types/user";

export type AuthGateDecision = "login" | "otp" | "tabs" | null;

export function getAuthGateDecision(
  user: User | null | undefined,
  segments: readonly string[],
): AuthGateDecision {
  if (user === undefined) return null;
  const inAuthGroup = segments[0] === "(auth)";
  const authScreen = inAuthGroup ? segments[1] : undefined;
  if (!user) return inAuthGroup ? null : "login";
  if (user.role === "student" && !user.email_verified && authScreen !== "verify-otp") {
    return "otp";
  }
  if ((user.role !== "student" || user.email_verified) && inAuthGroup && authScreen !== "verify-otp") {
    return "tabs";
  }
  return null;
}

/**
 * Redirects between the (auth) and (tabs) groups based on session state,
 * mirroring frontend/src/components/ProtectedRoute.jsx's tri-state logic
 * (undefined = loading, null = signed out, User = signed in) adapted to
 * Expo Router's segment-based navigation.
 */
export function useAuthGate(user: User | null | undefined) {
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    const decision = getAuthGateDecision(user, segments);
    if (decision === "login") {
      router.replace("/(auth)/login");
      return;
    }
    if (decision === "otp" && user) {
      router.replace({ pathname: "/(auth)/verify-otp", params: { email: user.email } });
      return;
    }
    if (decision === "tabs") {
      router.replace("/(tabs)");
    }
  }, [user, segments, router]);
}
