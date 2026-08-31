export type ResolvedCtaRoute =
  { external: string } | { push: string; params?: Record<string, string> };

/**
 * Announcements' CTA links (cta_url) are website routes authored by admins —
 * they don't map onto the app's route tree 1:1. This is a best-effort
 * mapping for the paths admins are likely to actually use; anything else
 * falls back to Home rather than doing nothing.
 */
export function resolveCtaRoute(ctaUrl: string): ResolvedCtaRoute {
  if (/^https?:\/\//i.test(ctaUrl)) return { external: ctaUrl };
  if (ctaUrl.startsWith("/verify")) return { push: "/verify" };
  const offer = ctaUrl.match(/^\/offers?\/([^/?#]+)/i);
  if (offer?.[1]) return { push: "/offer/[id]", params: { id: offer[1] } };
  const outlet = ctaUrl.match(/^\/outlets?\/([^/?#]+)/i);
  if (outlet?.[1]) return { push: "/outlet/[id]", params: { id: outlet[1] } };
  if (ctaUrl.startsWith("/outlets")) {
    return { push: "/(tabs)/explore", params: { tab: "outlets" } };
  }
  if (ctaUrl.startsWith("/offers")) {
    return { push: "/(tabs)/explore", params: { tab: "deals" } };
  }
  if (ctaUrl.startsWith("/rewards")) return { push: "/rewards" };
  if (ctaUrl.startsWith("/saved")) return { push: "/saved" };
  if (ctaUrl.startsWith("/brand-claims")) return { push: "/brand-claims" };
  if (ctaUrl.startsWith("/wallet")) return { push: "/(tabs)/wallet" };
  if (ctaUrl.startsWith("/profile")) return { push: "/(tabs)/profile" };
  return { push: "/(tabs)" };
}
