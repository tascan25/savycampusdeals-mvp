import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { color } from "@/design-system/tokens";
import { useAuthGate } from "@/hooks/useAuthGate";
import { AnnouncementProvider } from "@/providers/AnnouncementProvider";
import { AppLockProvider } from "@/providers/AppLockProvider";
import { AuthProvider, useAuth } from "@/providers/AuthProvider";
import { NetworkProvider } from "@/providers/NetworkProvider";
import { QueryProvider } from "@/providers/QueryProvider";

void SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { user, ready } = useAuth();
  useAuthGate(user);

  useEffect(() => {
    if (!ready) return;
    void SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <Stack
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.background } }}
    >
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen
        name="rewards"
        options={{ headerShown: true, title: "Savvy Points", headerStyle: { backgroundColor: color.background }, headerTintColor: color.textPrimary, headerShadowVisible: false }}
      />
      <Stack.Screen
        name="brand-claims"
        options={{ headerShown: true, title: "Online offers", headerStyle: { backgroundColor: color.background }, headerTintColor: color.textPrimary, headerShadowVisible: false }}
      />
      <Stack.Screen
        name="offer/[id]"
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="outlet/[id]"
        options={{
          headerShown: true,
          title: "Outlet",
          headerStyle: { backgroundColor: color.background },
          headerTintColor: color.textPrimary,
          headerShadowVisible: false,
        }}
      />
      <Stack.Screen
        name="verify"
        options={{ headerShown: false }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: color.background }}>
      <SafeAreaProvider>
        <ErrorBoundary>
          <NetworkProvider>
            <QueryProvider>
              <AuthProvider>
                <AppLockProvider>
                  <AnnouncementProvider>
                    <RootNavigator />
                  </AnnouncementProvider>
                </AppLockProvider>
              </AuthProvider>
            </QueryProvider>
          </NetworkProvider>
        </ErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
