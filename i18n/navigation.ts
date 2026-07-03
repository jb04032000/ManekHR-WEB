import { createNavigation } from 'next-intl/navigation';
import { routing } from './routing';

/**
 * Locale-aware navigation primitives for the PUBLIC marketing pages.
 *
 * What it does: wraps next/link + next/navigation so that internal links and
 * programmatic navigation on marketing pages keep the active locale prefix
 * (e.g. a `gu` visitor clicking `<Link href="/pricing">` stays on `/gu/pricing`
 * instead of falling back to `/`).
 *
 * Cross-module links:
 *  - built from `i18n/routing.ts`.
 *  - import these ONLY in `app/[locale]/(marketing)/**` pages and the shared
 *    `components/marketing/**` shell (Navbar, Footer, CtaButton, etc.). The
 *    authenticated app keeps plain `next/link` / `next/navigation` (it is
 *    cookie-based, not locale-prefixed).
 *
 * Watch: with `localePrefix: 'as-needed'`, `Link href="/pricing"` renders as
 * `/pricing` for `en` and `/gu/pricing` for `gu` automatically. Do not hand-build
 * locale prefixes.
 */
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
