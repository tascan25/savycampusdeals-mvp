import { Stack } from "expo-router";

import { color } from "@/design-system/tokens";

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.background } }}
    >
      <Stack.Screen name="login" />
      <Stack.Screen name="login-password" />
      <Stack.Screen name="register" />
      <Stack.Screen name="verify-otp" />
      <Stack.Screen name="forgot-password" />
      <Stack.Screen name="reset-password/[token]" />
    </Stack>
  );
}
