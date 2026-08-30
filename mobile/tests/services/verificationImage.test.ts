import * as ImagePicker from "expo-image-picker";

import {
  captureFromCamera,
  MAX_VERIFICATION_IMAGE_BYTES,
  pickFromLibrary,
} from "@/services/verificationImage";

jest.mock("expo-image-picker", () => ({
  PermissionStatus: { GRANTED: "granted", DENIED: "denied", UNDETERMINED: "undetermined" },
  requestCameraPermissionsAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));

const mocked = jest.mocked(ImagePicker);

beforeEach(() => {
  jest.clearAllMocks();
});

describe("captureFromCamera", () => {
  it("fails with permission_denied without prompting the camera", async () => {
    mocked.requestCameraPermissionsAsync.mockResolvedValue({ status: "denied" } as never);

    const result = await captureFromCamera();

    expect(result).toEqual({ ok: false, error: "permission_denied" });
    expect(mocked.launchCameraAsync).not.toHaveBeenCalled();
  });

  it("returns a data: URI built from the asset's base64 and mime type", async () => {
    mocked.requestCameraPermissionsAsync.mockResolvedValue({ status: "granted" } as never);
    mocked.launchCameraAsync.mockResolvedValue({
      canceled: false,
      assets: [{ base64: "AAAA", mimeType: "image/png" }],
    } as never);

    const result = await captureFromCamera();

    expect(result).toEqual({
      ok: true,
      image: { dataUri: "data:image/png;base64,AAAA", sizeBytes: 3 },
    });
  });

  it("falls back to jpeg for an unsupported/missing mime type", async () => {
    mocked.requestCameraPermissionsAsync.mockResolvedValue({ status: "granted" } as never);
    mocked.launchCameraAsync.mockResolvedValue({
      canceled: false,
      assets: [{ base64: "AAAA", mimeType: "image/heic" }],
    } as never);

    const result = await captureFromCamera();

    expect(result).toEqual({
      ok: true,
      image: { dataUri: "data:image/jpeg;base64,AAAA", sizeBytes: 3 },
    });
  });

  it("rejects an image over the 5 MB backend limit", async () => {
    mocked.requestCameraPermissionsAsync.mockResolvedValue({ status: "granted" } as never);
    const oversizedBase64 = "A".repeat(Math.ceil((MAX_VERIFICATION_IMAGE_BYTES + 1) / 3) * 4);
    mocked.launchCameraAsync.mockResolvedValue({
      canceled: false,
      assets: [{ base64: oversizedBase64, mimeType: "image/jpeg" }],
    } as never);

    const result = await captureFromCamera();

    expect(result).toEqual({ ok: false, error: "too_large" });
  });

  it("treats a cancelled picker as cancelled, not an error", async () => {
    mocked.requestCameraPermissionsAsync.mockResolvedValue({ status: "granted" } as never);
    mocked.launchCameraAsync.mockResolvedValue({ canceled: true, assets: null } as never);

    const result = await captureFromCamera();

    expect(result).toEqual({ ok: false, error: "cancelled" });
  });
});

describe("pickFromLibrary", () => {
  it("fails with permission_denied without opening the library", async () => {
    mocked.requestMediaLibraryPermissionsAsync.mockResolvedValue({ status: "denied" } as never);

    const result = await pickFromLibrary();

    expect(result).toEqual({ ok: false, error: "permission_denied" });
    expect(mocked.launchImageLibraryAsync).not.toHaveBeenCalled();
  });
});
