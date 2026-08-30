import { StyleSheet, View } from "react-native";

import { AppText, Screen } from "@/design-system/components";
import { space } from "@/design-system/tokens";

/**
 * Used only for the Foundation-phase tab shell so navigation/build/theme can
 * be verified end to end before each tab's real screen lands in its own
 * phase (Discovery, Verification, Wallet & rewards, Account & privacy).
 * No interactive controls here on purpose — nothing to fake.
 */
export function PlaceholderScreen({ title, note }: { title: string; note: string }) {
  return (
    <Screen>
      <View style={styles.content}>
        <AppText variant="h1">{title}</AppText>
        <AppText variant="body" color="#A1A1AA" style={styles.note}>
          {note}
        </AppText>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, justifyContent: "center", paddingHorizontal: space.lg },
  note: { marginTop: space.sm },
});
