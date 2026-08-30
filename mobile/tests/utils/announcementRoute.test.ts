import { resolveCtaRoute } from "@/utils/announcementRoute";

describe("resolveCtaRoute", () => {
  it("treats an absolute URL as external", () => {
    expect(resolveCtaRoute("https://savvycampus.app/blog/launch")).toEqual({
      external: "https://savvycampus.app/blog/launch",
    });
  });

  it("maps /verify to the verification screen", () => {
    expect(resolveCtaRoute("/verify")).toEqual({ push: "/verify" });
  });

  it("maps /outlets to the Explore tab's outlets segment", () => {
    expect(resolveCtaRoute("/outlets")).toEqual({
      push: "/(tabs)/explore",
      params: { tab: "outlets" },
    });
  });

  it("maps /offers to the Explore tab's deals segment", () => {
    expect(resolveCtaRoute("/offers/some-offer-id")).toEqual({
      push: "/(tabs)/explore",
      params: { tab: "deals" },
    });
  });

  it("falls back to Home for an unmapped relative path", () => {
    expect(resolveCtaRoute("/dashboard")).toEqual({ push: "/(tabs)" });
  });
});
