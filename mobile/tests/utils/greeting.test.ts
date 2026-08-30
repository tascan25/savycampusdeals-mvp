import { getRotatingSalutation, getTimeGreeting } from "@/utils/greeting";

describe("Home greetings", () => {
  it.each([
    [2, "Good night"],
    [8, "Good morning"],
    [13, "Good afternoon"],
    [18, "Good evening"],
    [23, "Good night"],
  ])("uses local hour %s", (hour, expected) => {
    const date = new Date(2026, 7, 30, hour);
    expect(getTimeGreeting(date)).toBe(expected);
  });

  it("rotates the friendly salutation every five minutes", () => {
    const start = new Date(2026, 7, 30, 12, 0);
    const nextWindow = new Date(start.getTime() + 5 * 60 * 1000);
    expect(getRotatingSalutation(nextWindow)).not.toBe(getRotatingSalutation(start));
  });
});
