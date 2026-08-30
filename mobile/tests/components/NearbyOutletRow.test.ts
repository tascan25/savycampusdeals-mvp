jest.mock("@/utils/media", () => ({ resolveMediaUrl: (value: string) => value }));

import { isOutletOpen } from "@/components/NearbyOutletRow";

describe("nearby outlet hours", () => {
  it("recognises a daytime opening window", () => {
    expect(isOutletOpen("8am – 11pm", new Date(2026, 7, 30, 18, 0))).toBe(true);
    expect(isOutletOpen("8am – 11pm", new Date(2026, 7, 30, 23, 30))).toBe(false);
  });

  it("supports opening windows that cross midnight", () => {
    expect(isOutletOpen("11am – 1am", new Date(2026, 7, 30, 23, 30))).toBe(true);
    expect(isOutletOpen("11am – 1am", new Date(2026, 7, 30, 2, 0))).toBe(false);
  });

  it("returns null when hours cannot be interpreted", () => {
    expect(isOutletOpen("Call for hours")).toBeNull();
  });
});
