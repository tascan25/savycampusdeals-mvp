import { Stack } from "expo-router";
import { color } from "@/design-system/tokens";

export default function SettingsLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: color.background },
        headerTintColor: color.textPrimary,
        headerShadowVisible: false,
        headerBackButtonDisplayMode: "minimal",
        contentStyle: { backgroundColor: color.background },
      }}
    >
      <Stack.Screen name="profile-details" options={{ title: "Personal details" }} />
      <Stack.Screen name="avatar" options={{ title: "Choose avatar" }} />
      <Stack.Screen name="sessions" options={{ title: "Active sessions" }} />
      <Stack.Screen name="notifications" options={{ title: "Notifications" }} />
      <Stack.Screen name="delete-account" options={{ title: "Delete account" }} />
    </Stack>
  );
}
