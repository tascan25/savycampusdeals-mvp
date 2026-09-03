import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";

import { apiLogin, apiLogout, apiLogoutAll, apiMe, apiRegister } from "@/api/auth";
import { apiDeleteAccount, apiUpdateProfile, type ProfileUpdate } from "@/api/profile";
import {
  endSession,
  onSessionExpired,
  readCachedUser,
  readSession,
  saveCachedUser,
  saveSessionFromResponse,
} from "@/services/session";
import { getPushInstallationId } from "@/services/installation";
import { cancelAllManagedLocalNotifications } from "@/services/localNotifications";
import { unregisterNativePushToken } from "@/services/pushLifecycle";
import type { User } from "@/types/user";

type RegisterInput = Parameters<typeof apiRegister>[0];

type AuthContextValue = {
  /** undefined = still resolving the stored session, null = signed out. */
  user: User | null | undefined;
  ready: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (input: RegisterInput) => Promise<{ user: User; emailSent: boolean; devOtp?: string }>;
  logout: () => Promise<void>;
  logoutAllDevices: () => Promise<void>;
  refreshUser: () => Promise<void>;
  updateProfile: (input: ProfileUpdate) => Promise<User>;
  deleteAccount: (password: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<User | null | undefined>(undefined);

  const hydrate = useCallback(async () => {
    const session = await readSession();
    if (!session) {
      setUser(null);
      return;
    }
    const cachedUser = await readCachedUser();
    if (cachedUser) setUser(cachedUser);
    try {
      const freshUser = await apiMe();
      await saveCachedUser(freshUser).catch(() => undefined);
      setUser(freshUser);
    } catch {
      // A confirmed invalid refresh token calls endSession() and the listener
      // below routes to login. Temporary network/server failures retain the
      // encrypted cached identity instead of impersonating a logout.
      if (!(await readSession())) setUser(null);
    }
  }, []);

  useEffect(() => {
    // `hydrate` is async — its setState calls happen inside its own promise
    // resolution, not synchronously here. This is the standard mount-time
    // "resolve the stored session" fetch (same pattern as the website's
    // AuthContext), which the react-hooks rule can't distinguish from a
    // literal synchronous setState call in the effect body.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    hydrate();
    return onSessionExpired(() => setUser(null));
  }, [hydrate]);

  const login = useCallback(async (email: string, password: string) => {
    const result = await apiLogin({ email, password });
    await saveSessionFromResponse(result);
    await saveCachedUser(result.user).catch(() => undefined);
    setUser(result.user);
    return result.user;
  }, []);

  const register = useCallback(async (input: RegisterInput) => {
    const result = await apiRegister(input);
    await saveSessionFromResponse(result);
    await saveCachedUser(result.user).catch(() => undefined);
    setUser(result.user);
    return { user: result.user, emailSent: result.email_sent, devOtp: result.dev_otp };
  }, []);

  const logout = useCallback(async () => {
    const session = await readSession();
    if (session) {
      // Best-effort: even if this fails (offline), still clear locally —
      // the session is gone for the user regardless of server ack.
      const installationId = await getPushInstallationId().catch(() => undefined);
      await apiLogout(session.refreshToken, installationId).catch(() => undefined);
    }
    await cancelAllManagedLocalNotifications().catch(() => undefined);
    await unregisterNativePushToken().catch(() => undefined);
    await endSession();
    setUser(null);
  }, []);

  const logoutAllDevices = useCallback(async () => {
    await apiLogoutAll().catch(() => undefined);
    await cancelAllManagedLocalNotifications().catch(() => undefined);
    await unregisterNativePushToken().catch(() => undefined);
    await endSession();
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    const freshUser = await apiMe();
    await saveCachedUser(freshUser).catch(() => undefined);
    setUser(freshUser);
  }, []);

  const updateProfile = useCallback(async (input: ProfileUpdate) => {
    const updated = await apiUpdateProfile(input);
    await saveCachedUser(updated).catch(() => undefined);
    setUser(updated);
    return updated;
  }, []);

  const deleteAccount = useCallback(async (password: string) => {
    await apiDeleteAccount(password, "DELETE");
    await cancelAllManagedLocalNotifications().catch(() => undefined);
    await unregisterNativePushToken().catch(() => undefined);
    await endSession();
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      ready: user !== undefined,
      login,
      register,
      logout,
      logoutAllDevices,
      refreshUser,
      updateProfile,
      deleteAccount,
    }),
    [user, login, register, logout, logoutAllDevices, refreshUser, updateProfile, deleteAccount],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
