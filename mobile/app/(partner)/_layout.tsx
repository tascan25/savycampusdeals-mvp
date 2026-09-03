import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { color } from "@/design-system/tokens";

type IconName = keyof typeof Ionicons.glyphMap;
const icons: Record<string, { active: IconName; inactive: IconName }> = {
  index: { active: "grid", inactive: "grid-outline" },
  activity: { active: "receipt", inactive: "receipt-outline" },
  scan: { active: "scan", inactive: "scan-outline" },
  explore: { active: "compass", inactive: "compass-outline" },
  account: { active: "person-circle", inactive: "person-circle-outline" },
};

export default function PartnerTabsLayout() {
  const insets = useSafeAreaInsets();
  const bottom = Math.max(insets.bottom - 16, 10);
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: "#86EFAC",
        tabBarInactiveTintColor: color.textTertiary,
        tabBarHideOnKeyboard: true,
        sceneStyle: { paddingBottom: 76 + bottom, backgroundColor: color.background },
        tabBarStyle: [styles.tabBar, { bottom }],
        tabBarItemStyle: styles.item,
        tabBarLabelStyle: [styles.label, route.name === "scan" && styles.scanLabel],
        tabBarIcon: ({ focused, color: tint, size }) => {
          const pair = icons[route.name] ?? icons.index!;
          if (route.name === "scan")
            return (
              <View style={[styles.scanButton, focused && styles.scanButtonActive]}>
                <Ionicons name={focused ? pair.active : pair.inactive} size={29} color="#FFFFFF" />
              </View>
            );
          return (
            <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
              <Ionicons name={focused ? pair.active : pair.inactive} size={size - 2} color={tint} />
            </View>
          );
        },
      })}
    >
      <Tabs.Screen name="index" options={{ title: "Dashboard" }} />
      <Tabs.Screen name="activity" options={{ title: "Activity" }} />
      <Tabs.Screen name="scan" options={{ title: "Scan" }} />
      <Tabs.Screen name="explore" options={{ title: "Explore" }} />
      <Tabs.Screen name="account" options={{ title: "Account" }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: "absolute",
    left: 12,
    right: 12,
    height: 70,
    paddingTop: 7,
    paddingBottom: 6,
    borderRadius: 35,
    overflow: "visible",
    backgroundColor: "rgba(20,20,25,0.96)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.borderStrong,
    shadowColor: "#000",
    shadowOpacity: 0.5,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
    elevation: 16,
  },
  item: { borderRadius: 22 },
  label: { fontSize: 9, lineHeight: 12, fontWeight: "700" },
  scanLabel: { marginTop: 10 },
  iconWrap: {
    minWidth: 38,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  iconWrapActive: { backgroundColor: "rgba(34,197,94,0.12)" },
  scanButton: {
    width: 62,
    height: 62,
    marginTop: -26,
    borderRadius: 31,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: color.primary,
    borderWidth: 5,
    borderColor: color.background,
    shadowColor: color.primary,
    shadowOpacity: 0.48,
    shadowRadius: 13,
    shadowOffset: { width: 0, height: 5 },
    elevation: 18,
  },
  scanButtonActive: { backgroundColor: color.success },
});
