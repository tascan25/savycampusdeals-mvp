import type { ConfigContext, ExpoConfig } from "expo/config";

/**
 * Product identity is env-driven so the app can run under placeholder
 * identifiers during development and be repointed to owner-approved,
 * permanent identifiers with a single env change before store submission.
 * See mobile/docs/store-release.md — Android package / iOS bundle id are
 * effectively permanent once published.
 */
const APP_NAME = process.env.EXPO_PUBLIC_APP_NAME ?? "Savvy Campus";
const APP_SLUG = process.env.EXPO_PUBLIC_APP_SLUG ?? "savvy-campus";
const URL_SCHEME = process.env.EXPO_PUBLIC_URL_SCHEME ?? "savvycampus";
const ANDROID_PACKAGE = process.env.EXPO_PUBLIC_ANDROID_PACKAGE ?? "in.savvycampus.app";
const IOS_BUNDLE_ID = process.env.EXPO_PUBLIC_IOS_BUNDLE_ID ?? "in.savvycampus.app";
const PRODUCTION_DOMAIN = process.env.EXPO_PUBLIC_PRODUCTION_DOMAIN ?? "savvycampus.app";
const APP_ENV = process.env.EXPO_PUBLIC_APP_ENV ?? "development";
const GOOGLE_SERVICES_FILE = process.env.GOOGLE_SERVICES_FILE;
/**
 * iOS's Associated Domains (Universal Links) capability isn't provisionable
 * on a free personal Apple account — Xcode fails signing entirely with it
 * present. Deep links aren't wired up yet (Phase 7), so this defaults off
 * for local device testing and only needs flipping on once there's a paid
 * Apple Developer account provisioning the build (still required before
 * Universal Links can work at all, regardless of this flag).
 */
const ENABLE_ASSOCIATED_DOMAINS = process.env.EXPO_PUBLIC_ENABLE_ASSOCIATED_DOMAINS === "true";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: APP_NAME,
  slug: APP_SLUG,
  scheme: URL_SCHEME,
  version: "0.1.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "dark",
  backgroundColor: "#050505",
  splash: {
    backgroundColor: "#FFFFFF",
    image: "../frontend/public/brand_logo.jpeg",
    resizeMode: "contain",
  },
  experiments: {
    ...config.experiments,
    typedRoutes: true,
  },
  plugins: [
    ...(config.plugins ?? []),
    "expo-asset",
    [
      "expo-build-properties",
      {
        ios: {
          // Xcode 26.6 cannot link this project's New Architecture pods
          // against React Native's precompiled core: the prebuilt framework
          // omits debug symbols consumed by Screens/Reanimated/Gesture Handler.
          buildReactNativeFromSource: true,
        },
      },
    ],
    "@react-native-community/datetimepicker",
    ...(APP_ENV !== "production" ? ["./plugins/withDevCleartextTraffic"] : []),
    [
      "./plugins/withAndroidNotifications",
      {
        icon: "./assets/notification-icon-savvy.png",
        color: "#4F46E5",
        defaultChannel: "deals",
      },
    ],
    [
      "expo-splash-screen",
      {
        backgroundColor: "#FFFFFF",
        image: "../frontend/public/brand_logo.jpeg",
        imageWidth: 210,
        resizeMode: "contain",
      },
    ],
    [
      "expo-local-authentication",
      { faceIDPermission: "Allow $(PRODUCT_NAME) to use Face ID to unlock the app." },
    ],
    [
      "expo-location",
      {
        locationWhenInUsePermission:
          "Allow $(PRODUCT_NAME) to use your location to find nearby outlets.",
      },
    ],
    [
      "expo-image-picker",
      {
        cameraPermission: "Allow $(PRODUCT_NAME) to use your camera for student verification.",
        photosPermission: "Allow $(PRODUCT_NAME) to access your photos for student verification.",
      },
    ],
    // Local iOS notifications do not require APNs. Keep this last so it
    // removes the remote-push entitlement added by Expo's automatic plugin.
    "./plugins/withIosLocalNotificationsOnly",
  ],
  ios: {
    ...config.ios,
    icon: "./assets/icon.png",
    bundleIdentifier: IOS_BUNDLE_ID,
    supportsTablet: true,
    ...(ENABLE_ASSOCIATED_DOMAINS
      ? { associatedDomains: [`applinks:${PRODUCTION_DOMAIN}`] }
      : null),
    infoPlist: {
      ...config.ios?.infoPlist,
      // Lets a device build reach the dev backend over a plain-HTTP LAN
      // address (e.g. http://192.168.x.x:8000) during local development.
      // Scoped to private-network/.local addresses only — the loopback
      // address is always exempt regardless, and this has no effect on the
      // production API, which is HTTPS. See docs/environment.md.
      NSAppTransportSecurity: {
        NSAllowsLocalNetworking: true,
      },
    },
  },
  android: {
    versionCode: 1,
    ...config.android,
    icon: "./assets/icon.png",
    package: ANDROID_PACKAGE,
    ...(GOOGLE_SERVICES_FILE ? { googleServicesFile: GOOGLE_SERVICES_FILE } : null),
    adaptiveIcon: {
      backgroundColor: "#FFFFFF",
      foregroundImage: "./assets/android-icon-foreground.png",
    },
    intentFilters: [
      {
        action: "VIEW",
        autoVerify: true,
        data: [{ scheme: "https", host: PRODUCTION_DOMAIN }],
        category: ["BROWSABLE", "DEFAULT"],
      },
    ],
  },
  extra: {
    ...config.extra,
    appEnv: APP_ENV,
  },
});
