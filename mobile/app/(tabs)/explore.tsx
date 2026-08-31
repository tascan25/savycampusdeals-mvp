import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { DealsExplorer } from "@/components/DealsExplorer";
import { OutletsExplorer } from "@/components/OutletsExplorer";
import { AppText, Screen, SegmentedControl } from "@/design-system/components";
import { color, space } from "@/design-system/tokens";

type Segment = "deals" | "outlets";

export default function ExploreTab() {
  const params = useLocalSearchParams<{ tab?: string; category?: string }>();
  const [segment, setSegment] = useState<Segment>(params.tab === "deals" ? "deals" : "outlets");
  // Re-derive from a changed `tab` param (e.g. Home's "Find outlets" quick
  // action while this tab is already mounted) during render, not in an
  // effect — React's documented pattern for state that must reset when a
  // prop changes, without the extra render pass useEffect would cost.
  const [lastTabParam, setLastTabParam] = useState(params.tab);
  if (params.tab !== lastTabParam) {
    setLastTabParam(params.tab);
    if (params.tab === "outlets" || params.tab === "deals") {
      setSegment(params.tab);
    }
  }

  return (
    <Screen edges={["top"]}>
      <View style={styles.header}>
        <AppText variant="caption" color={color.textTertiary} style={styles.eyebrow}>
          EXPLORE
        </AppText>
        <AppText variant="h1">
          {segment === "outlets" ? "Nearby deals" : "All student deals"}
        </AppText>
        <View style={styles.segmentWrap}>
          <SegmentedControl
            options={[
              { value: "deals", label: "Deals" },
              { value: "outlets", label: "Outlets" },
            ]}
            value={segment}
            onChange={setSegment}
          />
        </View>
      </View>
      {segment === "deals" ? (
        <DealsExplorer initialCategory={params.category} key={params.category || "all"} />
      ) : (
        <OutletsExplorer />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: space.lg, paddingTop: space.lg, paddingBottom: space.md },
  eyebrow: { letterSpacing: 2 },
  segmentWrap: { marginTop: space.md },
});
