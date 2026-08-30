import * as Location from "expo-location";

export type Coords = { lat: number; lng: number };

/**
 * Only ever called from a user-initiated action (the "Near me" toggle) —
 * never on screen mount — so the OS permission prompt appears with context,
 * per the brief's "contextual permission prompt" requirement. Returns null
 * on denial/unavailability instead of throwing; callers show a manual
 * city-filter fallback rather than blocking the screen.
 */
export async function requestCurrentCoords(): Promise<Coords | null> {
  const existing = await Location.getForegroundPermissionsAsync();
  let status = existing.status;

  if (status !== Location.PermissionStatus.GRANTED) {
    const requested = await Location.requestForegroundPermissionsAsync();
    status = requested.status;
  }

  if (status !== Location.PermissionStatus.GRANTED) {
    return null;
  }

  try {
    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    return { lat: position.coords.latitude, lng: position.coords.longitude };
  } catch {
    return null;
  }
}
