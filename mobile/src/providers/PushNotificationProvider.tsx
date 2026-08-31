import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import { Linking, Platform } from "react-native";

import { apiMarkPushOpened, apiRegisterPushDevice } from "@/api/push";
import { useAuth } from "@/providers/AuthProvider";
import { getPushInstallationId } from "@/services/installation";
import { resolveCtaRoute } from "@/utils/announcementRoute";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export type PushPermissionState = "loading" | "enabled" | "disabled" | "unavailable";

type PushNotificationContextValue = {
  permission: PushPermissionState;
  enable: () => Promise<boolean>;
  refresh: () => Promise<void>;
  openSystemSettings: () => Promise<void>;
};

const PushNotificationContext = createContext<PushNotificationContextValue | null>(null);

async function ensureAndroidChannels(): Promise<void> {
  if (Platform.OS !== "android") return;
  await Promise.all([
    Notifications.setNotificationChannelAsync("account", {
      name: "Important account updates",
      description: "Verification, account and security updates",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 220, 120, 220],
    }),
    Notifications.setNotificationChannelAsync("reminders", {
      name: "Reminders",
      description: "Coupon and membership reminders",
      importance: Notifications.AndroidImportance.DEFAULT,
    }),
    Notifications.setNotificationChannelAsync("deals", {
      name: "Deals and announcements",
      description: "New campus deals and Savvy announcements",
      importance: Notifications.AndroidImportance.DEFAULT,
    }),
  ]);
}

async function registerCurrentToken(permission: "granted" | "provisional"): Promise<void> {
  if (Platform.OS !== "android" && Platform.OS !== "ios") return;
  const token = await Notifications.getDevicePushTokenAsync();
  if (typeof token.data !== "string" || !token.data) return;
  await apiRegisterPushDevice({
    token: token.data,
    installation_id: await getPushInstallationId(),
    platform: Platform.OS,
    app_version: Constants.expoConfig?.version ?? Constants.nativeAppVersion ?? "",
    permission,
  });
}

function grantedState(
  settings: Notifications.NotificationPermissionsStatus,
): "granted" | "provisional" | null {
  if (settings.granted) return "granted";
  if (
    Platform.OS === "ios" &&
    settings.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
  ) {
    return "provisional";
  }
  return null;
}

export function PushNotificationProvider({ children }: PropsWithChildren) {
  const { user } = useAuth();
  const router = useRouter();
  const [permission, setPermission] = useState<PushPermissionState>("loading");
  const handledResponses = useRef(new Set<string>());

  const syncPermissionAndToken = useCallback(async () => {
    if (Platform.OS !== "android" && Platform.OS !== "ios") {
      setPermission("unavailable");
      return;
    }
    await ensureAndroidChannels();
    const settings = await Notifications.getPermissionsAsync();
    const granted = grantedState(settings);
    setPermission(granted ? "enabled" : "disabled");
    if (granted && user) {
      // Token registration is deliberately best-effort. A Firebase outage must
      // never block authentication or make the app unusable.
      await registerCurrentToken(granted).catch(() => undefined);
    }
  }, [user]);

  const handleResponse = useCallback(
    async (response: Notifications.NotificationResponse | null) => {
      if (!response || !user) return;
      const responseId = response.notification.request.identifier;
      if (handledResponses.current.has(responseId)) return;
      handledResponses.current.add(responseId);
      await Notifications.clearLastNotificationResponseAsync().catch(() => undefined);
      const data = response.notification.request.content.data ?? {};
      const deliveryId = typeof data.delivery_id === "string" ? data.delivery_id : "";
      const route = typeof data.route === "string" ? data.route : "";
      if (deliveryId) await apiMarkPushOpened(deliveryId).catch(() => undefined);
      const resolved = resolveCtaRoute(route);
      if ("external" in resolved) {
        await Linking.openURL(resolved.external).catch(() => undefined);
      } else {
        router.push(
          resolved.params
            ? ({ pathname: resolved.push, params: resolved.params } as never)
            : (resolved.push as never),
        );
      }
    },
    [router, user],
  );

  useEffect(() => {
    if (!user) return;
    // Permission/token hydration resolves asynchronously from the native OS;
    // the hooks rule cannot distinguish it from a synchronous state setter.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void syncPermissionAndToken();
    const tokenSubscription = Notifications.addPushTokenListener(() => {
      void syncPermissionAndToken();
    });
    const responseSubscription = Notifications.addNotificationResponseReceivedListener(
      (response) => void handleResponse(response),
    );
    void Notifications.getLastNotificationResponseAsync()
      .then(handleResponse)
      .catch(() => undefined);
    return () => {
      tokenSubscription.remove();
      responseSubscription.remove();
    };
  }, [handleResponse, syncPermissionAndToken, user]);

  const enable = useCallback(async () => {
    if (Platform.OS !== "android" && Platform.OS !== "ios") return false;
    await ensureAndroidChannels();
    const settings = await Notifications.requestPermissionsAsync();
    const granted = grantedState(settings);
    setPermission(granted ? "enabled" : "disabled");
    if (granted && user) await registerCurrentToken(granted).catch(() => undefined);
    return Boolean(granted);
  }, [user]);

  const value = useMemo<PushNotificationContextValue>(
    () => ({
      permission,
      enable,
      refresh: syncPermissionAndToken,
      openSystemSettings: async () => {
        await Linking.openSettings();
      },
    }),
    [enable, permission, syncPermissionAndToken],
  );

  return (
    <PushNotificationContext.Provider value={value}>{children}</PushNotificationContext.Provider>
  );
}

export function usePushNotifications(): PushNotificationContextValue {
  const context = useContext(PushNotificationContext);
  if (!context) {
    throw new Error("usePushNotifications must be used within PushNotificationProvider");
  }
  return context;
}
