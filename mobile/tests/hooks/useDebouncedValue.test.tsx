import { act, renderHook } from "@testing-library/react-native";

import { useDebouncedValue } from "@/hooks/useDebouncedValue";

describe("useDebouncedValue", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("only reflects the latest value after the delay elapses", async () => {
    const { result, rerender } = await renderHook(({ value }) => useDebouncedValue(value, 300), {
      initialProps: { value: "a" },
    });
    expect(result.current).toBe("a");

    await rerender({ value: "ab" });
    await rerender({ value: "abc" });
    expect(result.current).toBe("a");

    await act(() => {
      jest.advanceTimersByTime(299);
    });
    expect(result.current).toBe("a");

    await act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(result.current).toBe("abc");
  });
});
