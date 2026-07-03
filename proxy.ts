import { NextRequest, NextResponse } from 'next/server';
import createMiddleware from 'next-intl/middleware';
import { env } from '@/lib/env';
import { routing } from '@/i18n/routing';
import { SUPPORTED_LOCALES } from '@/lib/locales';

// `/portal` is the customer-facing party portal (Phase 16 / FIN-15-03).
// Routes look like `/portal/{token}` - the JWT travels in the URL and is
// validated server-side by PortalTokenGuard. The route MUST NOT require an
// auth cookie (T-16-06c-02 mitigation).
//
// Phase 17 / Plan 08 note - `/dashboard/settings/party-intelligence` and
// `/dashboard/reports/party-pnl/[partyId]` are AUTHENTICATED dashboard
// routes. They are intentionally NOT in PUBLIC_PATHS so the standard JWT
// gate enforces auth. Subscription/feature gating happens at the page
// level via useFeatureAccess (`party_intelligence_rfm` /
// `party_intelligence_pnl`) and at the API level via @RequireSubscription.
const PUBLIC_PATHS = [
  '/',
  // Public marketing pages (the logged-out, convince-to-register surface).
  // These live in the app/(marketing) route group and carry no
  // authenticated data, so they must render for logged-out visitors
  // instead of bouncing to /auth.
  '/connect',
  '/textile-marketplace',
  '/textile-services',
  '/textile-jobs',
  '/textile-network',
  // SEO landing pages targeting specific trade intents (app/[locale]/(marketing)/*).
  // They are in sitemap.ts and meant to rank, so they MUST render logged-out for
  // crawlers; keep this list in lockstep with sitemap.ts STATIC_ROUTES or they
  // bounce to /auth (allowlist omission bug).
  '/saree-wholesalers',
  '/zari-manufacturers',
  '/embroidery-job-work',
  '/fabric-suppliers',
  '/dress-material-wholesalers',
  '/erp',
  '/pricing',
  '/about',
  '/contact',
  // SEO/knowledge content (app/(marketing)/guides/* and guidelines/*). Public,
  // logged-out, crawler-indexable - keep in lockstep with the other marketing
  // pages above or they bounce to /auth (allowlist omission bug).
  '/guides',
  '/guidelines',
  // Legal / compliance pages (privacy, terms, grievance + their /connect and
  // /erp variants via prefix match). MUST be public: AdSense review and DPDP
  // require a reachable privacy policy and grievance route, and the logged-out
  // signup / consent screen links here. They carry no authenticated data.
  '/privacy',
  '/terms',
  '/grievance',
  '/auth',
  // PWA offline fallback. The service worker (public/sw.js) serves this from
  // cache on a failed navigation; it must also render logged-out (an offline
  // visitor has no usable session) and carries no authenticated data.
  '/offline',
  '/invite',
  // Accountant invite accept link from email. Public so a logged-out invitee can
  // reach the page and be prompted to sign in; the accept itself is still
  // authenticated + email-matched on the backend (SEC-3).
  '/accept-invite',
  '/setup-admin',
  '/platform-restricted',
  '/upgrade',
  '/kiosk',
  '/portal',
  // Zari360 Connect - public, SEO-indexable entity pages must render
  // logged-out (crawlers + WhatsApp/share links). These are the
  // `(connect-public)` route group: `/u` (profile), `/company` (company
  // page), `/store` (storefront), `/p` (post), `/products` (listing detail),
  // `/jobs` (job detail). The authenticated product lives under `/connect/*`
  // and stays gated.
  '/u',
  '/company',
  '/store',
  '/p',
  '/products',
  '/jobs',
];

// Paths exempt from the `mobile_only` device-tier redirect below.
//
// Two unrelated things both read as "platform" in this app:
//   • the *device* platform (mobile app vs web) - an ERP subscription tier
//     (`platformAccess`); the upgrade page is `/platform-restricted`.
//   • the Zari360 Connect product - the authenticated app at `/connect/*`.
// They are NOT related. Connect is feature-flagged (`connectEnabled`), never
// subscription-gated - so `/connect/*` (authed) and `/u/*` (public profiles)
// are exempt here: a `mobile_only` ERP subscriber may still use Connect.
const DEVICE_TIER_EXEMPT_PATHS = [
  '/platform-restricted',
  '/api/',
  '/_next/',
  // Offline fallback is a network-error screen, never a device-tier upsell.
  '/offline',
  '/connect',
  '/u',
  '/company',
  '/store',
  '/p',
  '/products',
  '/jobs',
];
const ACCESS_COOKIE = 'z360_access_token';
const REFRESH_COOKIE = 'z360_refresh_token';
const PLATFORM_ACCESS_COOKIE = 'z360_platform_access';
// Last product surface the user visited ('connect' | 'erp'). Stamped below on
// authenticated /connect/* and /dashboard* navigations, read by the landing
// redirect so an installed-PWA launch (start_url '/', see app/manifest.ts)
// reopens the product the user was in last session instead of the marketing
// page. UX hint only, never used for authorization.
const LAST_PRODUCT_COOKIE = 'z360_last_product';
const LAST_PRODUCT_COOKIE_OPTS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 60 * 60 * 24 * 365, // outlives the 7-day session on purpose
};

/**
 * Which product surface a pathname belongs to, for the last-product stamp.
 * Only called AFTER the marketing early-return, so a `/connect...` here is the
 * authenticated Connect app (the marketing landing is exact '/connect' and
 * never reaches the stamp).
 */
function lastProductOf(pathname: string): 'connect' | 'erp' | null {
  if (pathname.startsWith('/connect')) return 'connect';
  if (pathname.startsWith('/dashboard')) return 'erp';
  return null;
}

/**
 * Where an ALREADY-AUTHENTICATED hit on /auth* should bounce to. Was a
 * hardcoded '/dashboard', which dumped Connect-only users (who never accepted
 * the ERP policy) onto the ERP PolicyGate - the "accept T&C again" bug.
 * Product-aware via the z360_last_product cookie: 'connect' -> the feed,
 * 'erp' or no cookie -> '/dashboard' (the pre-existing behaviour, so users
 * without the cookie see no change). Only these two fixed in-app URLs are
 * ever returned - the cookie value is a hint, never an open redirect.
 * Keep in sync with the '/' landing redirect above, which reads the same
 * cookie. -> app/(app)/dashboard/layout.tsx (ERP gate), connect/layout.tsx.
 */
function authedAuthBounceTarget(request: NextRequest): string {
  return request.cookies.get(LAST_PRODUCT_COOKIE)?.value === 'connect'
    ? '/connect/feed'
    : '/dashboard';
}

// next-intl middleware for the PUBLIC marketing surface only. It performs the
// locale prefix redirect/rewrite (`/pricing` -> rewrite `/en/pricing`; `/gu/...`
// stays) so those pages can be statically pre-rendered per locale. We run it
// INSIDE this proxy (Next 16 allows a single edge entry point: `proxy.ts`) only
// for marketing paths - the authenticated app keeps the cookie-based auth flow
// below. See i18n/routing.ts.
const intlMiddleware = createMiddleware(routing);

// All site locales, INCLUDING the default `en`. `en` normally has no prefix
// (localePrefix 'as-needed'), but a request CAN still arrive at `/en` - e.g. the
// language switcher navigating to the default locale. We must strip it too so the
// path is recognised as marketing and handed to next-intl, which redirects
// `/en` -> `/` (and `/en/pricing` -> `/pricing`). Without `en` here, `/en` is
// treated as a protected route and bounces to /auth. Longest-first so `gu-en`
// matches before `gu`.
const LOCALE_PREFIXES = [...SUPPORTED_LOCALES].sort((a, b) => b.length - a.length);

/**
 * Remove a leading locale prefix so the auth checks below treat `/gu/pricing`
 * exactly like `/pricing` (otherwise a `gu` visitor on a public page would be
 * bounced to /auth - the PUBLIC_PATHS allowlist is keyed on unprefixed paths).
 */
function stripLocale(pathname: string): string {
  for (const loc of LOCALE_PREFIXES) {
    if (pathname === `/${loc}` || pathname.startsWith(`/${loc}/`)) {
      return pathname.slice(loc.length + 1) || '/';
    }
  }
  return pathname;
}

// The public marketing surface (app/[locale]/(marketing)/**), keyed on the
// LOCALE-STRIPPED path. `/connect` is EXACT only: it is the marketing landing,
// whereas `/connect/*` is the authenticated Connect app and must NOT be routed
// through next-intl. Keep in sync with the (marketing) route group.
const MARKETING_EXACT = new Set(['/', '/connect']);
const MARKETING_PREFIXES = [
  '/about',
  '/contact',
  '/pricing',
  '/erp',
  '/guides',
  '/grievance',
  '/privacy',
  '/terms',
  '/guidelines',
  '/textile-marketplace',
  '/textile-services',
  '/textile-jobs',
  '/textile-network',
  '/saree-wholesalers',
  '/zari-manufacturers',
  '/embroidery-job-work',
  '/fabric-suppliers',
  '/dress-material-wholesalers',
];

function isMarketingPath(barePathname: string): boolean {
  if (MARKETING_EXACT.has(barePathname)) return true;
  return MARKETING_PREFIXES.some((p) => barePathname === p || barePathname.startsWith(p + '/'));
}

/** Decode JWT payload without signature verification - Edge-safe */
function jwtExpiry(token: string): number | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    // base64url → base64
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(base64);
    const { exp } = JSON.parse(json) as { exp?: number };
    return exp ?? null;
  } catch {
    return null;
  }
}

function isExpired(token: string): boolean {
  const exp = jwtExpiry(token);
  if (!exp) return false; // can't decode → assume valid, let backend decide
  return Date.now() / 1000 >= exp - 30; // 30s buffer
}

async function tryRefresh(
  refreshToken: string,
): Promise<{ accessToken: string; refreshToken: string; platformAccess?: string } | null> {
  const apiBase = env.backendApiUrl;
  try {
    const res = await fetch(`${apiBase}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-platform': 'web' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as {
      data?: { accessToken?: string; refreshToken?: string; platformAccess?: string };
      accessToken?: string;
      refreshToken?: string;
      platformAccess?: string;
    };
    const newAccess = body?.data?.accessToken ?? body?.accessToken ?? null;
    const newRefresh = body?.data?.refreshToken ?? body?.refreshToken ?? refreshToken;
    const platformAccess = body?.data?.platformAccess ?? body?.platformAccess;
    if (!newAccess) return null;
    return { accessToken: newAccess, refreshToken: newRefresh, platformAccess };
  } catch {
    return null;
  }
}

function isDeviceTierExempt(pathname: string): boolean {
  return DEVICE_TIER_EXEMPT_PATHS.some((p) => pathname.startsWith(p));
}

/**
 * Map a public Connect profile path to its in-app mirror, or null when the path
 * is not a public profile route. An authenticated visitor on `/u/*` (the public,
 * logged-out, SEO surface) is sent to `/connect/u/*` (the same content inside the
 * Connect shell + rails), so a shared or direct link keeps a signed-in member
 * in-app instead of the bare public page. Logged-out visitors never reach this
 * (the caller only invokes it once the session is known-authenticated), so the
 * public page still renders for crawlers + conversion. No loop: `/connect/*` is
 * not `/u/*`, so the mirror target is never itself remapped.
 */
function connectMirrorPath(pathname: string): string | null {
  // Never remap an already in-app path. This guards against producing
  // `/connect/connect/*` (a redirect loop).
  if (pathname.startsWith('/connect')) return null;
  // Public person profiles -> in-app mirror.
  if (pathname === '/u' || pathname.startsWith('/u/')) return `/connect${pathname}`;
  // Public company pages -> in-app mirror, so a signed-in member tapping a
  // workshop lands in the Connect shell instead of the logged-out page.
  if (pathname === '/company' || pathname.startsWith('/company/')) return `/connect${pathname}`;
  // Public storefronts -> in-app mirror (same reason as company pages).
  if (pathname === '/store' || pathname.startsWith('/store/')) return `/connect${pathname}`;
  // Public product detail -> the in-app marketplace listing (different path
  // shape, so map explicitly). Only the detail form (`/products/<id>`) mirrors;
  // a bare `/products` has no in-app equivalent and falls through to public.
  if (pathname.startsWith('/products/')) {
    return pathname.replace('/products/', '/connect/marketplace/listing/');
  }
  // Public job detail -> the in-app job (apply / hiring-funnel) experience.
  if (pathname.startsWith('/jobs/')) {
    return pathname.replace('/jobs/', '/connect/jobs/');
  }
  return null;
}

function isValidReturnTo(url: string | null): boolean {
  if (!url) return false;
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return false;
  }
  if (url.startsWith('//') || url.startsWith('/')) {
    return url.startsWith('/') && !url.startsWith('//');
  }
  return false;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Locale-routing: marketing pages live under app/[locale]. Strip any locale
  // prefix so the auth/public checks match `/gu/pricing` the same as `/pricing`.
  const barePathname = stripLocale(pathname);

  // '/connect' is EXACT-only here (the marketing landing): '/connect/*' is the
  // authenticated Connect app and must go through the auth gate. Without this
  // carve-out the generic prefix match made every /connect/* page public, so a
  // logged-out visitor rendered the whole Connect shell (empty/sample data).
  // Keep in sync with MARKETING_EXACT above. Public SEO entity pages stay on
  // their own prefixes ('/u', '/company', '/store', '/p', '/products', '/jobs').
  const isPublic = PUBLIC_PATHS.some(
    (p) =>
      barePathname === p || (p !== '/connect' && p !== '/' && barePathname.startsWith(p + '/')),
  );

  const accessToken = request.cookies.get(ACCESS_COOKIE)?.value;
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;
  const platformAccess = request.cookies.get(PLATFORM_ACCESS_COOKIE)?.value;

  const hasValidAccess = accessToken && !isExpired(accessToken);

  // Platform check for mobile_only plans (barePathname so /gu/* matches too)
  if (hasValidAccess && platformAccess === 'mobile_only' && !isDeviceTierExempt(barePathname)) {
    const returnTo = request.nextUrl.searchParams.get('return_to');
    const redirectUrl = new URL('/platform-restricted', request.url);
    if (returnTo && isValidReturnTo(returnTo)) {
      redirectUrl.searchParams.set('return_to', returnTo);
    }
    return NextResponse.redirect(redirectUrl);
  }

  // Logged-in landing redirect: a signed-in user opening '/launch' (the
  // installed PWA's start_url - see app/manifest.ts) or the marketing landing
  // ('/') is sent back to the product they used last session
  // (z360_last_product cookie, stamped on authed /connect* and /dashboard*
  // navigations below). Deliberately conservative: no last-product cookie ->
  // no redirect for '/', and '/launch' falls back to '/'.
  //
  // WHY '/launch' exists: production '/' is statically prerendered and cached
  // by CloudFront (s-maxage=1y) with a cookie-less cache key, so this proxy
  // NEVER RUNS for '/' on a warm edge - a signed-in PWA launch got the cached
  // anonymous marketing page (the "PWA reopens on landing" bug). '/launch' is
  // not a page: every response from it is a redirect stamped Cache-Control
  // no-store, so the edge can never cache it and the proxy always decides.
  // Keep the '/' branch too - it still works on cache misses / local dev.
  if (barePathname === '/' || barePathname === '/launch') {
    const isLaunch = barePathname === '/launch';
    // Redirects here MUST be no-store: the CDN cache key ignores cookies, so a
    // cached per-user redirect would be served to everyone (incl. logged-out).
    const redirectNoStore = (target: string) => {
      const res = NextResponse.redirect(new URL(target, request.url));
      res.headers.set('Cache-Control', 'no-store');
      return res;
    };
    const lastProduct = request.cookies.get(LAST_PRODUCT_COOKIE)?.value;
    const target =
      lastProduct === 'erp' ? '/dashboard' : lastProduct === 'connect' ? '/connect/feed' : null;
    if (target) {
      if (hasValidAccess) {
        return redirectNoStore(target);
      }
      // Expired access + live refresh token: the common installed-PWA case
      // (reopened after days idle). Refresh here, carry the new cookies on the
      // redirect. Refresh failure falls through to the normal marketing render.
      if (refreshToken) {
        const tokens = await tryRefresh(refreshToken);
        if (tokens) {
          const cookieOpts = {
            httpOnly: true,
            secure: env.isProd,
            sameSite: 'lax' as const,
            path: '/',
            maxAge: 60 * 60 * 24 * 7,
          };
          const res = redirectNoStore(target);
          res.cookies.set(ACCESS_COOKIE, tokens.accessToken, cookieOpts);
          res.cookies.set(REFRESH_COOKIE, tokens.refreshToken, cookieOpts);
          if (tokens.platformAccess) {
            res.cookies.set(PLATFORM_ACCESS_COOKIE, tokens.platformAccess, {
              ...cookieOpts,
              httpOnly: false,
            });
          }
          return res;
        }
      }
    }
    // '/launch' is a decision point, never a page: no session / no cookie /
    // refresh failed -> land on the marketing page. '/' falls through to the
    // normal marketing render below.
    if (isLaunch) {
      return redirectNoStore('/');
    }
  }

  // Public marketing pages are locale-routed: hand off to next-intl for the
  // prefix redirect/rewrite. They render logged-out (no auth gate), so this runs
  // BEFORE the auth fast-path - locale routing applies to authed + anon alike.
  // (A token-expired visitor here skips the silent cookie refresh below; it runs
  // on their next non-marketing request. Acceptable for public pages.)
  if (isMarketingPath(barePathname)) {
    return intlMiddleware(request);
  }

  // Fast path: valid access token - let through
  if (hasValidAccess) {
    // Authed users viewing a public Connect profile / activity (`/u/*`) are sent
    // to the in-app mirror (`/connect/u/*`) so shared links keep them in the
    // shell + rails. Logged-out visitors fall through to the public page below.
    const mirror = connectMirrorPath(pathname);
    if (mirror) {
      return NextResponse.redirect(new URL(mirror + request.nextUrl.search, request.url));
    }
    // Redirect authenticated users away from /auth, but allow token-bearing
    // pages (reset-password, verify-email, setup-pin, setup-workspace) to
    // render - those flows can be triggered while a session is already active
    // (e.g. immediately after `/auth/verify-otp` issues tokens but before the
    // user has finished workspace + PIN setup). Mirrors the refresh-path list
    // below; the two lists must stay in lockstep so an authed user with a
    // fresh access token doesn't get bounced to `/dashboard` and trip the
    // workspace + PIN gate cascade before they can reach the setup screen
    // the orchestrator just routed them to.
    const isTokenBearingAuthRoute =
      pathname === '/auth/reset-password' ||
      pathname.startsWith('/auth/reset-password/') ||
      pathname === '/auth/verify-email' ||
      pathname.startsWith('/auth/verify-email/') ||
      pathname === '/auth/setup-pin' ||
      pathname.startsWith('/auth/setup-pin/') ||
      pathname === '/auth/setup-workspace' ||
      pathname.startsWith('/auth/setup-workspace/');
    if (pathname.startsWith('/auth') && !isTokenBearingAuthRoute) {
      // Product-aware bounce (see authedAuthBounceTarget): a Connect-only
      // session goes back to the feed, not the ERP shell + its policy gate.
      return NextResponse.redirect(new URL(authedAuthBounceTarget(request), request.url));
    }
    // Stamp the last-product cookie (only when it changes, to avoid a
    // Set-Cookie header on every app request). Read by the '/' landing
    // redirect above so the installed PWA reopens the same product.
    const product = lastProductOf(pathname);
    if (product && request.cookies.get(LAST_PRODUCT_COOKIE)?.value !== product) {
      const res = NextResponse.next();
      res.cookies.set(LAST_PRODUCT_COOKIE, product, {
        ...LAST_PRODUCT_COOKIE_OPTS,
        secure: env.isProd,
      });
      return res;
    }
    return NextResponse.next();
  }

  // Access token missing or expired - try silent refresh
  if (refreshToken) {
    const tokens = await tryRefresh(refreshToken);
    if (tokens) {
      const cookieOpts = {
        httpOnly: true,
        secure: env.isProd,
        sameSite: 'lax' as const,
        path: '/',
        maxAge: 60 * 60 * 24 * 7, // 7 days
      };
      const platformCookieOpts = { ...cookieOpts, httpOnly: false };

      // Same in-app mirror redirect as the fast path, for an authed member whose
      // access token had expired (e.g. a shared `/u/<slug>` link opened after an
      // idle spell): bounce to `/connect/u/*` and carry the refreshed cookies so
      // the next request is already authenticated.
      const mirror = connectMirrorPath(pathname);
      if (mirror) {
        const res = NextResponse.redirect(new URL(mirror + request.nextUrl.search, request.url));
        res.cookies.set(ACCESS_COOKIE, tokens.accessToken, cookieOpts);
        res.cookies.set(REFRESH_COOKIE, tokens.refreshToken, cookieOpts);
        if (tokens.platformAccess) {
          res.cookies.set(PLATFORM_ACCESS_COOKIE, tokens.platformAccess, platformCookieOpts);
        }
        return res;
      }

      const isTokenBearingAuthRoute =
        pathname === '/auth/reset-password' ||
        pathname.startsWith('/auth/reset-password/') ||
        pathname === '/auth/verify-email' ||
        pathname.startsWith('/auth/verify-email/') ||
        pathname === '/auth/setup-pin' ||
        pathname.startsWith('/auth/setup-pin/') ||
        pathname === '/auth/setup-workspace' ||
        pathname.startsWith('/auth/setup-workspace/');
      if (pathname.startsWith('/auth') && !isTokenBearingAuthRoute) {
        // Refreshed, authenticated - product-aware bounce (see
        // authedAuthBounceTarget), carrying the refreshed cookies.
        const res = NextResponse.redirect(new URL(authedAuthBounceTarget(request), request.url));
        res.cookies.set(ACCESS_COOKIE, tokens.accessToken, cookieOpts);
        res.cookies.set(REFRESH_COOKIE, tokens.refreshToken, cookieOpts);
        if (tokens.platformAccess) {
          res.cookies.set(PLATFORM_ACCESS_COOKIE, tokens.platformAccess, platformCookieOpts);
        }
        return res;
      }

      if (!isPublic) {
        // Refreshed, continue to protected page with new cookies
        const res = NextResponse.next();
        res.cookies.set(ACCESS_COOKIE, tokens.accessToken, cookieOpts);
        res.cookies.set(REFRESH_COOKIE, tokens.refreshToken, cookieOpts);
        if (tokens.platformAccess) {
          res.cookies.set(PLATFORM_ACCESS_COOKIE, tokens.platformAccess, platformCookieOpts);
        }
        // Same last-product stamp as the fast path (see lastProductOf).
        const product = lastProductOf(pathname);
        if (product && request.cookies.get(LAST_PRODUCT_COOKIE)?.value !== product) {
          res.cookies.set(LAST_PRODUCT_COOKIE, product, {
            ...LAST_PRODUCT_COOKIE_OPTS,
            secure: env.isProd,
          });
        }
        return res;
      }

      return NextResponse.next();
    }
    // Refresh failed - fall through to redirect
  }

  // No valid token and no usable refresh token
  if (!isPublic) {
    const loginUrl = new URL('/auth', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Public SEO assets bypass the auth proxy entirely (like robots.txt /
    // ads.txt / sitemap.xml): ads.txt MUST be reachable logged-out or Google
    // AdSense cannot verify the site (served by app/ads.txt/route.ts); llms.txt
    // for AI indexers, and the root marketing OG /
    // Twitter image routes (hashed names start with opengraph-image /
    // twitter-image) so social + answer-engine scrapers can fetch them.
    // `sw.js` (the PWA service worker) is added so the auth proxy never runs for
    // it: a logged-out visitor must be able to fetch /sw.js (a static file) to
    // register the worker, instead of being redirected to /auth.
    '/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|robots.txt|ads.txt|sitemap.xml|llms.txt|llms-full.txt|opengraph-image|twitter-image|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
