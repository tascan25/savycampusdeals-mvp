import { createPushDeviceRegistrar } from "@/services/pushDeviceRegistration";

const input = {
  token: "fcm-token",
  installation_id: "installation-123",
  platform: "android" as const,
  app_version: "1.0.0",
  permission: "granted" as const,
};

describe("push device registration", () => {
  it("coalesces concurrent duplicates and remembers a successful registration", async () => {
    const register = jest.fn().mockResolvedValue(undefined);
    const registrar = createPushDeviceRegistrar(register);

    await Promise.all([
      registrar("user-1", input),
      registrar("user-1", input),
      registrar("user-1", input),
    ]);
    await registrar("user-1", input);

    expect(register).toHaveBeenCalledTimes(1);
  });

  it("serializes different token registrations", async () => {
    let active = 0;
    let maximumActive = 0;
    const releases: Array<() => void> = [];
    const register = jest.fn(async () => {
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      await new Promise<void>((resolve) => releases.push(resolve));
      active -= 1;
    });
    const registrar = createPushDeviceRegistrar(register);

    const first = registrar("user-1", input);
    const second = registrar("user-1", { ...input, token: "rotated-token" });
    await Promise.resolve();
    await Promise.resolve();

    expect(register).toHaveBeenCalledTimes(1);
    releases.shift()?.();
    await first;
    await Promise.resolve();
    expect(register).toHaveBeenCalledTimes(2);
    releases.shift()?.();
    await second;

    expect(maximumActive).toBe(1);
  });

  it("allows a failed registration to be retried", async () => {
    const register = jest
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(undefined);
    const registrar = createPushDeviceRegistrar(register);

    await expect(registrar("user-1", input)).rejects.toThrow("offline");
    await expect(registrar("user-1", input)).resolves.toBeUndefined();

    expect(register).toHaveBeenCalledTimes(2);
  });

  it("does not deduplicate the same installation across different accounts", async () => {
    const register = jest.fn().mockResolvedValue(undefined);
    const registrar = createPushDeviceRegistrar(register);

    await registrar("user-1", input);
    await registrar("user-2", input);

    expect(register).toHaveBeenCalledTimes(2);
  });

  it("drops queued work when its account is no longer active", async () => {
    const register = jest.fn().mockResolvedValue(undefined);
    const registrar = createPushDeviceRegistrar(register);

    registrar.setCurrentAccount("user-2");
    await registrar("user-1", input);

    expect(register).not.toHaveBeenCalled();
  });
});
