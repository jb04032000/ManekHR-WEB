import { notFound } from 'next/navigation';

/**
 * Lowest-priority catch-all for `/dashboard/*`. Next.js only renders the ROOT
 * `app/not-found.tsx` for genuinely unmatched URLs (a nested not-found is used
 * only for explicit `notFound()` calls), and that root 404 is now a neutral,
 * public-facing screen (Home + Connect, no ERP push). A typo'd `/dashboard/xyz`
 * would otherwise show that public 404 instead of an ERP-first one, so this
 * page matches when nothing else does and throws `notFound()`, which renders
 * the ERP-scoped `app/dashboard/not-found.tsx`. Mirrors
 * `app/connect/[...notFound]/page.tsx`.
 *
 * Catch-all is the lowest route priority, so it never shadows a real ERP route
 * (static or `[id]`/`[firmId]` dynamic segments win first).
 */
export default function DashboardCatchAll() {
  notFound();
}
