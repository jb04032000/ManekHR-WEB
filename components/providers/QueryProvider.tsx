'use client';

/**
 * TanStack Query provider for ManekHR Connect.
 *
 * Server Components + server actions own initial page data loads. This client
 * provider powers the *interactive* Connect surfaces - feed, inbox, notification
 * counts, live badges - with caching, optimistic updates and polling.
 *
 * The QueryClient is created lazily in state so it is stable across re-renders
 * and is not shared between requests on the server (App Router requirement).
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';

export default function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Connect data is social/feed-style - short freshness, no focus spam.
            staleTime: 60_000,
            gcTime: 5 * 60_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
          mutations: {
            retry: 0,
          },
        },
      }),
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
