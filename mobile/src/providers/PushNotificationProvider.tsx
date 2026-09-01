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
import { AppState, Linking, Platform } from "react-native";

import { apiListCoupons } from "@/api/coupons";
import { apiMarkPushOpened, apiRegisterPushDevice } from "@/api/push";
import { apiGetSavvyPointsOverview } from "@/api/rewards";
import { NotificationPermissionSheet } from "@/components/NotificationPermissionSheet";
import { useAuth } from "@/providers/AuthProvider";
import { getPushInstallationId } from "@/services/installation";
import {
  cancelAllManagedLocalNotifications,
  ensureNotificationChannels,
  reconcileLocalNotifications,
} from "@/services/localNotifications";
import {
  recordNotificationPermissionPromptShown,
  shouldShowNotificationPermissionPrompt,
} from "@/services/notificationPermissionPrompt";
import { createPushDeviceRegistrar } from "@/services/pushDeviceRegistration";
import { resolveCtaRoute } from "@/utils/announcementRoute";

Notifications.setNotificationHandler({
  handleNotification: async (notification) => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: notification.request.content.data?.play_sound === true,
    shouldSetBadge: false,
  }),
});

export type PushPermissionState = "loading" | "enabled" | "undetermined" | "denied" | "unavailable";

type PushNotificationContextValue = {
  permission: PushPermissionState;
  enable: () => Promise<boolean>;
  refresh: () => Promise<void>;
  openSystemSettings: () => Promise<void>;
  reconcileReminders: () => Promise<number>;
};

const PushNotificationContext = createContext<PushNotificationContextValue | null>(null);

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

function permissionState(
  settings: Notifications.NotificationPermissionsStatus,
): PushPermissionState {
  if (grantedState(settings)) return "enabled";
  return settings.canAskAgain ? "undetermined" : "denied";
}

export function PushNotificationProvider({ children }: PropsWithChildren) {
  const { user } = useAuth();
  const router = useRouter();
  const [permission, setPermission] = useState<PushPermissionState>("loading");
  const [permissionPromptVisible, setPermissionPromptVisible] = useState(false);
  const [permissionPromptWorking, setPermissionPromptWorking] = useState(false);
  const handledResponses = useRef(new Set<string>());
  const grantedPermission = useRef<"granted" | "provisional" | null>(null);
  const [registerPushDevice] = useState(() =>
    createPushDeviceRegistrar((input) => apiRegisterPushDevice(input)),
  );

  useEffect(() => {
    registerPushDevice.setCurrentAccount(user?.id);
  }, [registerPushDevice, user?.id]);

  const registerToken = useCallback(
    async (
      token: Notifications.DevicePushToken,
      granted: "granted" | "provisional",
    ): Promise<void> => {
      const accountId = user?.id;
      if (!accountId || (Platform.OS !== "android" && Platform.OS !== "ios")) return;
      if (typeof token.data !== "string" || !token.data) return;

      const installationId = await getPushInstallationId();
      await registerPushDevice(accountId, {
        token: token.data,
        installation_id: installationId,
        platform: Platform.OS,
        app_version: Constants.expoConfig?.version ?? Constants.nativeAppVersion ?? "",
        permission: granted,
      });
    },
    [registerPushDevice, user?.id],
  );

  const registerCurrentToken = useCallback(
    async (granted: "granted" | "provisional"): Promise<void> => {
      const token = await Notifications.getDevicePushTokenAsync();
      await registerToken(token, granted);
    },
    [registerToken],
  );

  const reconcileReminders = useCallback(async (): Promise<number> => {
    if (!user || user.role !== "student") return 0;
    const settings = await Notifications.getPermissionsAsync();
    if (!grantedState(settings)) return 0;
    const [coupons, rewards] = await Promise.all([apiListCoupons(), apiGetSavvyPointsOverview()]);
    return reconcileLocalNotifications({
      user,
      coupons,
      levelRewards: rewards.level_rewards,
    });
  }, [user]);

  const syncPermissionAndToken = useCallback(async (): Promise<PushPermissionState> => {
    if (Platform.OS !== "android" && Platform.OS !== "ios") {
      setPermission("unavailable");
      return "unavailable";
    }
    await ensureNotificationChannels();
    const settings = await Notifications.getPermissionsAsync();
    const granted = grantedState(settings);
    grantedPermission.current = granted;
    const nextPermission = permissionState(settings);
    setPermission(nextPermission);
    if (granted && user) {
      // Token registration is deliberately best-effort. A Firebase outage must
      // never block authentication or make the app unusable.
      void registerCurrentToken(granted).catch(() => undefined);
    }
    return nextPermission;
  }, [registerCurrentToken, user]);

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
    if (user === null) {
      void cancelAllManagedLocalNotifications();
      return;
    }
    if (!user) return;
    let active = true;
    let promptTimer: ReturnType<typeof setTimeout> | undefined;
    // Permission hydration is an asynchronous native-system synchronization;
    // state updates occur after its promise resolves, never during render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void syncPermissionAndToken().then(async (nextPermission) => {
      if (!active) return;
      if (nextPermission === "enabled") {
        void reconcileReminders().catch(() => undefined);
        return;
      }
      const due = await shouldShowNotificationPermissionPrompt(false);
      if (!active || !due) return;
      promptTimer = setTimeout(() => {
        if (!active) return;
        void recordNotificationPermissionPromptShown();
        setPermissionPromptVisible(true);
      }, 1200);
    });
    const tokenSubscription = Notifications.addPushTokenListener((token) => {
      const granted = grantedPermission.current;
      if (granted) void registerToken(token, granted).catch(() => undefined);
    });
    const responseSubscription = Notifications.addNotificationResponseReceivedListener(
      (response) => void handleResponse(response),
    );
    void Notifications.getLastNotificationResponseAsync()
      .then(handleResponse)
      .catch(() => undefined);
    const appStateSubscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;
      void syncPermissionAndToken().then((nextPermission) => {
        if (nextPermission === "enabled") void reconcileReminders().catch(() => undefined);
      });
    });
    return () => {
      active = false;
      if (promptTimer) clearTimeout(promptTimer);
      tokenSubscription.remove();
      responseSubscription.remove();
      appStateSubscription.remove();
    };
  }, [handleResponse, reconcileReminders, registerToken, syncPermissionAndToken, user]);

  const enable = useCallback(async () => {
    if (Platform.OS !== "android" && Platform.OS !== "ios") return false;
    await ensureNotificationChannels();
    const settings = await Notifications.requestPermissionsAsync();
    const granted = grantedState(settings);
    grantedPermission.current = granted;
    setPermission(permissionState(settings));
    if (granted && user) {
      void registerCurrentToken(granted).catch(() => undefined);
      void reconcileReminders().catch(() => undefined);
    }
    return Boolean(granted);
  }, [reconcileReminders, registerCurrentToken, user]);

  const dismissPermissionPrompt = useCallback(() => setPermissionPromptVisible(false), []);

  const acceptPermissionPrompt = useCallback(async () => {
    setPermissionPromptWorking(true);
    if (permission === "denied") {
      await Linking.openSettings().catch(() => undefined);
    } else {
      await enable();
    }
    setPermissionPromptWorking(false);
    setPermissionPromptVisible(false);
  }, [enable, permission]);

  const value = useMemo<PushNotificationContextValue>(
    () => ({
      permission,
      enable,
      refresh: async () => {
        await syncPermissionAndToken();
      },
      reconcileReminders,
      openSystemSettings: async () => {
        await Linking.openSettings();
      },
    }),
    [enable, permission, reconcileReminders, syncPermissionAndToken],
  );

  return (
    <PushNotificationContext.Provider value={value}>
      {children}
      <NotificationPermissionSheet
        visible={Boolean(user) && permissionPromptVisible}
        requiresSettings={permission === "denied"}
        working={permissionPromptWorking}
        onAllow={() => void acceptPermissionPrompt()}
        onDismiss={dismissPermissionPrompt}
      />
    </PushNotificationContext.Provider>
  );
}

export function usePushNotifications(): PushNotificationContextValue {
  const context = useContext(PushNotificationContext);
  if (!context) {
    throw new Error("usePushNotifications must be used within PushNotificationProvider");
  }
  return context;
}
