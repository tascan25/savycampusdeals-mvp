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
import { AppState, type AppStateStatus } from "react-native";

import { AppLockScreen } from "@/components/AppLockScreen";
import { useAuth } from "@/providers/AuthProvider";
import {
  isAppLockEnabled,
  isBiometricSupported,
  requestUnlock,
  setAppLockEnabled as persistAppLockEnabled,
} from "@/services/appLock";

/**
 * A local UI curtain rendered over the signed-in app, not a backend auth
 * mechanism — see src/services/appLock.ts. Locks on backgrounding and on
 * cold start when enabled; never shown pre-login, since the login screen
 * already gates access.
 */

type AppLockContextValue = {
  supported: boolean;
  enabled: boolean;
  /** Whether the curtain is currently up. Native Modals (e.g. an
   * announcement spotlight) render above everything regardless of component
   * nesting, so anything that must never show over the curtain needs this
   * to suppress itself explicitly. */
  locked: boolean;
  /** Resolves false if the user cancelled/failed the confirmation prompt
   * required to turn the lock on — caller should not treat it as applied. */
  setEnabled: (enabled: boolean) => Promise<boolean>;
};

const AppLockContext = createContext<AppLockContextValue | null>(null);

export function AppLockProvider({ children }: PropsWithChildren) {
  const { user } = useAuth();
  const [ready, setReady] = useState(false);
  const [supported, setSupported] = useState(false);
  const [enabled, setEnabledState] = useState(false);
  const [locked, setLocked] = useState(true);
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [supportedResult, enabledResult] = await Promise.all([
        isBiometricSupported(),
        isAppLockEnabled(),
      ]);
      if (cancelled) return;
      const effectiveEnabled = enabledResult && supportedResult;
      setSupported(supportedResult);
      setEnabledState(effectiveEnabled);
      setLocked(effectiveEnabled);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (next: AppStateStatus) => {
      const prev = appState.current;
      appState.current = next;
      if (enabled && prev === "active" && next !== "active") {
        setLocked(true);
      }
    });
    return () => subscription.remove();
  }, [enabled]);

  const setEnabled = useCallback(async (next: boolean) => {
    if (next) {
      const confirmed = await requestUnlock("Enable app lock");
      if (!confirmed) return false;
    }
    await persistAppLockEnabled(next);
    setEnabledState(next);
    return true;
  }, []);

  // `ready` resolves from a local SecureStore read, which in practice
  // finishes well before AuthProvider's network round-trip to /auth/me —
  // so by the time `user` is truthy, whether to show the curtain is known.
  const showCurtain = ready && enabled && locked && Boolean(user);

  const value = useMemo<AppLockContextValue>(
    () => ({ supported, enabled, locked: showCurtain, setEnabled }),
    [supported, enabled, showCurtain, setEnabled],
  );

  return (
    <AppLockContext.Provider value={value}>
      {children}
      {showCurtain ? <AppLockScreen onUnlocked={() => setLocked(false)} /> : null}
    </AppLockContext.Provider>
  );
}

export function useAppLock(): AppLockContextValue {
  const ctx = useContext(AppLockContext);
  if (!ctx) throw new Error("useAppLock must be used within AppLockProvider");
  return ctx;
}
