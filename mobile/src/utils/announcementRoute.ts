export type ResolvedCtaRoute = { external: string } | { push: string; params?: { tab: string } };

/**
 * Announcements' CTA links (cta_url) are website routes authored by admins —
 * they don't map onto the app's route tree 1:1. This is a best-effort
 * mapping for the paths admins are likely to actually use; anything else
 * falls back to Home rather than doing nothing.
 */
export function resolveCtaRoute(ctaUrl: string): ResolvedCtaRoute {
  if (/^https?:\/\//i.test(ctaUrl)) return { external: ctaUrl };
  if (ctaUrl.startsWith("/verify")) return { push: "/verify" };
  if (ctaUrl.startsWith("/outlets")) {
    return { push: "/(tabs)/explore", params: { tab: "outlets" } };
  }
  if (ctaUrl.startsWith("/offers")) {
    return { push: "/(tabs)/explore", params: { tab: "deals" } };
  }
  return { push: "/(tabs)" };
}
