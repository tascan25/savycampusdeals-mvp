import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useState } from "react";
import { Animated, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { color, radius } from "@/design-system/tokens";

export function LoadingShimmer({ style }: { style?: StyleProp<ViewStyle> }) {
  const [progress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(progress, { toValue: 1, duration: 1050, useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [progress]);

  const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [-260, 260] });
  return (
    <View style={[styles.base, style]} accessibilityLabel="Loading content">
      <Animated.View style={[styles.sheen, { transform: [{ translateX }] }]}>
        <LinearGradient
          colors={["transparent", "rgba(255,255,255,0.11)", "transparent"]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  base: { overflow: "hidden", borderRadius: radius.md, backgroundColor: color.surfaceElevated },
  sheen: { width: 180, height: "100%" },
});
