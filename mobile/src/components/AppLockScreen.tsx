import { useCallback, useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

import { AppText, Button } from "@/design-system/components";
import { color, space } from "@/design-system/tokens";
import { requestUnlock } from "@/services/appLock";

export function AppLockScreen({ onUnlocked }: { onUnlocked: () => void }) {
  const [attempting, setAttempting] = useState(false);
  const [failed, setFailed] = useState(false);

  const attempt = useCallback(async () => {
    setAttempting(true);
    setFailed(false);
    const ok = await requestUnlock();
    setAttempting(false);
    if (ok) onUnlocked();
    else setFailed(true);
  }, [onUnlocked]);

  useEffect(() => {
    // Auto-prompt exactly once on mount, mirroring AuthProvider's mount-time
    // hydrate — an async external call whose setState happens inside its own
    // promise resolution, not synchronously in the effect body. Deliberately
    // NOT depending on `attempt` (its identity changes with each `onUnlocked`
    // from the parent) — re-running on every render would re-trigger the
    // biometric prompt. Repeat attempts are user-initiated via the button.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    attempt();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={[StyleSheet.absoluteFill, styles.overlay]}>
      <AppText variant="h2">Locked</AppText>
      <AppText variant="body" color={color.textSecondary} style={styles.subtitle}>
        {failed ? "Verification failed or was cancelled." : "Verify it's you to continue."}
      </AppText>
      <Button label={attempting ? "Verifying…" : "Unlock"} onPress={attempt} loading={attempting} />
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    backgroundColor: color.background,
    alignItems: "center",
    justifyContent: "center",
    padding: space.lg,
    gap: space.md,
    zIndex: 999,
  },
  subtitle: { textAlign: "center" },
});
