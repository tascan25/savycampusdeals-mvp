import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { PropsWithChildren } from "react";
import { useState } from "react";

import { toApiError } from "@/api/errors";

function isNonIdempotentMutationRetry() {
  // Coupon claims, redemptions, account deletion and password changes must
  // never be silently retried — those hooks set `retry: false` explicitly
  // where they're defined (Phases 4-6). This default only governs reads.
  return false;
}

export function QueryProvider({ children }: PropsWithChildren) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: (failureCount, error) => {
              const apiError = toApiError(error);
              if (apiError.status && apiError.status >= 400 && apiError.status < 500) {
                return false;
              }
              return failureCount < 2;
            },
            staleTime: 30_000,
          },
          mutations: {
            retry: isNonIdempotentMutationRetry,
          },
        },
      }),
  );

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
