import { resolveMediaUrl } from "@/utils/media";

jest.mock("@/config/env", () => ({
  env: {
    APP_ENV: "development",
    API_URL: "http://127.0.0.1:8000",
    WEB_URL: "http://127.0.0.1:3000",
  },
}));

describe("resolveMediaUrl", () => {
  it("passes absolute and data URIs through unchanged", () => {
    expect(resolveMediaUrl("https://images.example.com/a.jpg")).toBe(
      "https://images.example.com/a.jpg",
    );
    expect(resolveMediaUrl("data:image/png;base64,AAAA")).toBe("data:image/png;base64,AAAA");
  });

  it("serves public image paths from the API host", () => {
    expect(resolveMediaUrl("/images/outlets/foo/cover.webp")).toBe(
      "http://127.0.0.1:8000/images/outlets/foo/cover.webp",
    );
    expect(resolveMediaUrl("images/avatars/campus-cap.png")).toBe(
      "http://127.0.0.1:8000/images/avatars/campus-cap.png",
    );
  });

  it("keeps other legacy paths on the website host", () => {
    expect(resolveMediaUrl("/legacy/banner.webp")).toBe(
      "http://127.0.0.1:3000/legacy/banner.webp",
    );
  });

  it("returns an empty string for a missing path", () => {
    expect(resolveMediaUrl("")).toBe("");
    expect(resolveMediaUrl(undefined)).toBe("");
    expect(resolveMediaUrl(null)).toBe("");
  });
});
