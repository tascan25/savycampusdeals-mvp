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

  it("maps a specific offer to its native detail screen", () => {
    expect(resolveCtaRoute("/offers/some-offer-id")).toEqual({
      push: "/offer/[id]",
      params: { id: "some-offer-id" },
    });
  });

  it("preserves an outlet identifier for notification deep links", () => {
    expect(resolveCtaRoute("/outlets/507f1f77bcf86cd799439011")).toEqual({
      push: "/outlet/[id]",
      params: { id: "507f1f77bcf86cd799439011" },
    });
  });

  it("falls back to Home for an unmapped relative path", () => {
    expect(resolveCtaRoute("/dashboard")).toEqual({ push: "/(tabs)" });
  });
});
