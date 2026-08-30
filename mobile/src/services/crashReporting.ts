/**
 * Provider-independent crash-reporting seam. No external provider is wired
 * up yet — that requires explicit owner approval (see docs, section on
 * analytics/crash reporting). Until then this only logs locally in dev and
 * is a no-op in production, so nothing here can ever leak a token, a
 * document URL, or a raw student id to a third party by accident: there is
 * no third party.
 */
export type ErrorContext = Record<string, string | number | boolean | undefined>;

export function reportError(error: Error, context?: ErrorContext): void {
  if (__DEV__) {
    console.error("[crash]", error, context);
  }
  // A future provider integration point: swap this body for e.g.
  // Sentry.captureException(error, { extra: context }) once approved —
  // never pass tokens/session data as context.
}
