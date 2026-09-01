import type { apiRegisterPushDevice } from "@/api/push";

type PushDeviceInput = Parameters<typeof apiRegisterPushDevice>[0];
type RegisterPushDevice = (input: PushDeviceInput) => Promise<void>;

/**
 * Deduplicates identical registrations and serializes token changes so a
 * native token event can never flood the API with concurrent requests.
 */
export function createPushDeviceRegistrar(registerPushDevice: RegisterPushDevice) {
  const completed = new Set<string>();
  const pending = new Map<string, Promise<void>>();
  let queue: Promise<void> = Promise.resolve();
  let accountScopeEnabled = false;
  let currentAccountId: string | undefined;

  const register = (accountId: string, input: PushDeviceInput): Promise<void> => {
    const key = [accountId, input.token, input.permission, input.app_version].join("\u0000");
    if (completed.has(key)) return Promise.resolve();

    const existing = pending.get(key);
    if (existing) return existing;

    const registration = queue
      .catch(() => undefined)
      .then(async () => {
        if (accountScopeEnabled && currentAccountId !== accountId) return false;
        await registerPushDevice(input);
        return true;
      })
      .then((registered) => {
        if (!registered) return;
        completed.add(key);
      })
      .finally(() => {
        pending.delete(key);
      });

    pending.set(key, registration);
    queue = registration;
    return registration;
  };

  register.setCurrentAccount = (accountId: string | undefined) => {
    accountScopeEnabled = true;
    currentAccountId = accountId;
  };

  return register;
}
