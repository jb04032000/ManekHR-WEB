import { notFound } from 'next/navigation';

/**
 * Lowest-priority catch-all for `/connect/*`. Next.js only renders the ROOT
 * `app/not-found.tsx` for genuinely unmatched URLs (a nested not-found is used
 * only for explicit `notFound()` calls), so a typo'd `/connect/xyz` would
 * otherwise show the ERP 404. This page matches when nothing else does and
 * throws `notFound()`, which renders the Connect-scoped `app/connect/not-found.tsx`.
 *
 * Catch-all is the lowest route priority, so it never shadows a real Connect
 * route (static or `[id]`/`[slug]` dynamic segments win first).
 */
export default function ConnectCatchAll() {
  notFound();
}
