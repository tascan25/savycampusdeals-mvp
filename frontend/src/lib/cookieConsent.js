export const COOKIE_CONSENT_KEY = "savvy_cookie_preferences_v1";
export const COOKIE_SETTINGS_EVENT = "savvy:open-cookie-settings";

export function readCookiePreferences() {
  try {
    const saved = JSON.parse(localStorage.getItem(COOKIE_CONSENT_KEY));
    if (saved && typeof saved.analytics === "boolean") return saved;
  } catch {}
  return null;
}

export function saveCookiePreferences(analytics) {
  const preferences = {
    necessary: true,
    analytics: Boolean(analytics),
    updatedAt: new Date().toISOString(),
  };
  localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(preferences));
  window.dispatchEvent(new CustomEvent("savvy:cookie-preferences-changed", { detail: preferences }));
  return preferences;
}

export function openCookieSettings() {
  window.dispatchEvent(new Event(COOKIE_SETTINGS_EVENT));
}
