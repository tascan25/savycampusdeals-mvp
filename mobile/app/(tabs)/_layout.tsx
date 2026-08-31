import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { color } from "@/design-system/tokens";

type IconName = keyof typeof Ionicons.glyphMap;

const TAB_ICONS: Record<string, { active: IconName; inactive: IconName }> = {
  index: { active: "home", inactive: "home-outline" },
  explore: { active: "compass", inactive: "compass-outline" },
  card: { active: "card", inactive: "card-outline" },
  wallet: { active: "wallet", inactive: "wallet-outline" },
  profile: { active: "person-circle", inactive: "person-circle-outline" },
};

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const bottomOffset = Math.max(insets.bottom - 16, 10);

  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: "#D8B4FE",
        tabBarInactiveTintColor: color.textTertiary,
        tabBarHideOnKeyboard: true,
        sceneStyle: { paddingBottom: 74 + bottomOffset, backgroundColor: color.background },
        tabBarStyle: [styles.tabBar, { bottom: bottomOffset }],
        tabBarItemStyle: styles.item,
        tabBarLabelStyle: styles.label,
        tabBarIcon: ({ focused, color: tintColor, size }) => {
          const icons = TAB_ICONS[route.name];
          const name = icons ? (focused ? icons.active : icons.inactive) : "ellipse-outline";
          return (
            <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
              <Ionicons name={name} size={focused ? size - 1 : size - 2} color={tintColor} />
            </View>
          );
        },
      })}
    >
      <Tabs.Screen name="index" options={{ title: "Home" }} />
      <Tabs.Screen name="explore" options={{ title: "Explore" }} />
      <Tabs.Screen name="card" options={{ title: "Card" }} />
      <Tabs.Screen name="wallet" options={{ title: "Wallet" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: "absolute",
    left: 14,
    right: 14,
    height: 68,
    paddingTop: 7,
    paddingBottom: 7,
    borderRadius: 34,
    borderCurve: "continuous",
    overflow: "hidden",
    backgroundColor: "rgba(20,20,25,0.84)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.13)",
    shadowColor: "#000000",
    shadowOpacity: 0.48,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
    elevation: 14,
  },
  item: { borderRadius: 22, paddingVertical: 2 },
  label: {
    fontSize: 10,
    lineHeight: 13,
    fontWeight: "700",
  },
  iconWrap: {
    minWidth: 39,
    height: 29,
    borderRadius: 14.5,
    alignItems: "center",
    justifyContent: "center",
  },
  iconWrapActive: {
    backgroundColor: "rgba(147,51,234,0.18)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(216,180,254,0.30)",
  },
});
