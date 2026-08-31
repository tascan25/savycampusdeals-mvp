import { getSecureValue, secureStorageKeys, setSecureValue } from "@/storage/secureStore";

let inMemoryId: string | null = null;

function createInstallationId(): string {
  // This is an opaque database correlation id, not a credential. Combining
  // time and two random components is sufficient without adding a native UUID
  // dependency solely for this value.
  return `install_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}_${Math.random().toString(36).slice(2)}`;
}

export async function getPushInstallationId(): Promise<string> {
  if (inMemoryId) return inMemoryId;
  const stored = await getSecureValue(secureStorageKeys.pushInstallationId);
  if (stored) {
    inMemoryId = stored;
    return stored;
  }
  const created = createInstallationId();
  await setSecureValue(secureStorageKeys.pushInstallationId, created);
  inMemoryId = created;
  return created;
}
