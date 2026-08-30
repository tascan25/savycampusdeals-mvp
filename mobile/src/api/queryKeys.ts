/**
 * Central query-key registry. Every TanStack Query hook added in later
 * phases must derive its key from here (never inline array literals) so
 * cache invalidation stays consistent — e.g. approving verification
 * invalidates `queryKeys.auth.me()` and `queryKeys.studentCard.root()`
 * together instead of each screen guessing at a matching key shape.
 */
export const queryKeys = {
  auth: {
    me: () => ["auth", "me"] as const,
    sessions: () => ["auth", "sessions"] as const,
  },
  offers: {
    all: () => ["offers"] as const,
    list: (filters: Record<string, unknown>) => ["offers", "list", filters] as const,
    categories: () => ["offers", "categories"] as const,
    detail: (offerId: string) => ["offers", "detail", offerId] as const,
    saved: () => ["offers", "saved"] as const,
  },
  outlets: {
    all: () => ["outlets"] as const,
    list: (filters: Record<string, unknown>) => ["outlets", "list", filters] as const,
    cities: () => ["outlets", "cities"] as const,
    detail: (outletId: string) => ["outlets", "detail", outletId] as const,
  },
  coupons: {
    mine: () => ["coupons", "mine"] as const,
    brandClaims: () => ["coupons", "brand-claims"] as const,
  },
  verification: {
    status: () => ["verification", "status"] as const,
  },
  studentCard: {
    root: () => ["student-card"] as const,
  },
  rewards: {
    overview: () => ["savvy-points", "overview"] as const,
  },
  announcements: {
    list: () => ["announcements"] as const,
  },
} as const;
