import * as ImagePicker from "expo-image-picker";

/** Mirrors backend/services/cloudinary_service.py's MAX_VERIFICATION_IMAGE_BYTES. */
export const MAX_VERIFICATION_IMAGE_BYTES = 5 * 1024 * 1024;

const SUPPORTED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export type PickedImage = { dataUri: string; sizeBytes: number };
export type PickImageError = "permission_denied" | "cancelled" | "too_large";

type PickImageResult = { ok: true; image: PickedImage } | { ok: false; error: PickImageError };

function fromAsset(asset: ImagePicker.ImagePickerAsset): PickImageResult {
  if (!asset.base64) return { ok: false, error: "cancelled" };
  const mimeType =
    asset.mimeType && SUPPORTED_MIME_TYPES.has(asset.mimeType) ? asset.mimeType : "image/jpeg";
  const sizeBytes = Math.ceil((asset.base64.length * 3) / 4);
  if (sizeBytes > MAX_VERIFICATION_IMAGE_BYTES) {
    return { ok: false, error: "too_large" };
  }
  return { ok: true, image: { dataUri: `data:${mimeType};base64,${asset.base64}`, sizeBytes } };
}

export async function captureFromCamera(): Promise<PickImageResult> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (permission.status !== ImagePicker.PermissionStatus.GRANTED) {
    return { ok: false, error: "permission_denied" };
  }
  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ["images"],
    quality: 0.7,
    base64: true,
  });
  if (result.canceled || !result.assets?.[0]) return { ok: false, error: "cancelled" };
  return fromAsset(result.assets[0]);
}

export async function pickFromLibrary(): Promise<PickImageResult> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (permission.status !== ImagePicker.PermissionStatus.GRANTED) {
    return { ok: false, error: "permission_denied" };
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    quality: 0.7,
    base64: true,
  });
  if (result.canceled || !result.assets?.[0]) return { ok: false, error: "cancelled" };
  return fromAsset(result.assets[0]);
}
