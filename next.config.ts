import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';
import { withSentryConfig } from '@sentry/nextjs';

const withNextIntl = createNextIntlPlugin('./app/i18n.ts');

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Standalone output for Docker (launch — Workstream F): emits a self-contained
  // .next/standalone server with only the traced deps, so the runtime image stays
  // small. outputFileTracingRoot pins tracing to THIS repo so it doesn't try to
  // pull in the sibling repos of the multi-repo workspace. No effect on dev.
  //
  // OFF by default. `output: 'standalone'` bundles a full node_modules copy, which
  // pushed the build artifact past AWS Amplify's ~230MB deploy limit (Amplify hosts
  // the web app and packages its own right-sized SSR output, so it must NOT be
  // standalone). Standalone is ONLY for a self-hosted Docker image -> opt in there
  // with BUILD_STANDALONE=true. It also can't be produced on Windows (the Sentry
  // `node:inspector` externals chunk has a `:` that NTFS rejects with EINVAL).
  output:
    process.env.BUILD_STANDALONE === 'true' && process.platform !== 'win32'
      ? 'standalone'
      : undefined,
  outputFileTracingRoot: __dirname,
  // Don't emit browser source maps in the production build (they bloat the
  // deploy artifact; Amplify caps the SSR output at ~230MB). Sentry source-map
  // generation is also disabled below.
  productionBrowserSourceMaps: false,
  // Keep build-only / dev-only packages OUT of the traced SSR bundle so the
  // Amplify compute artifact stays under the size limit. None are needed at
  // runtime; this only trims the trace, it does not change behaviour.
  outputFileTracingExcludes: {
    '*': [
      '**/*.map',
      '**/node_modules/typescript/**',
      '**/node_modules/@swc/core/**',
      '**/node_modules/@swc/core-*/**',
      '**/node_modules/esbuild/**',
      '**/node_modules/@esbuild/**',
      '**/node_modules/terser/**',
      '**/node_modules/uglify-js/**',
      '**/node_modules/prettier/**',
      '**/node_modules/eslint/**',
      '**/node_modules/@typescript-eslint/**',
      '**/node_modules/.cache/**',
    ],
  },
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
  },
  experimental: {
    optimizePackageImports: ['antd', '@ant-design/icons', 'recharts'],
  },
  turbopack: {
    // Monorepo fix: tell Turbopack this subpackage is its own root,
    // not the parent repo. Prevents lockfile ambiguity warning and
    // ensures node_modules resolve from zari360-web/.
    root: __dirname,
  },
  async redirects() {
    return [
      // Bare /account → canonical landing (Profile), done at the ROUTING layer,
      // not by the runtime redirect() in app/(app)/account/page.tsx. Why: on a
      // client-side nav to /account (top-header "Settings"), the in-page
      // redirect() makes Next 16 render the account shell (DashboardLayout ->
      // useTranslations) across the redirect boundary, and its SSR-recovery can
      // mount that shell WITHOUT NextIntlClientProvider context -> client-side
      // exception (hard crash in prod; overlay-that-clears-on-refresh in dev). A
      // config redirect resolves /account before any page/layout renders, so the
      // shell never mounts in that broken transition. Same class of Next-16 intl-
      // context issue that keeps app/(app)/account/subscription/layout.tsx a
      // Server Component. Exact match only, so /account/profile, /account/security
      // and /account/subscription are untouched.
      {
        source: '/account',
        destination: '/account/profile',
        permanent: false,
      },
      // Legacy /dashboard/profile alias → canonical account-profile.
      {
        source: '/dashboard/profile',
        destination: '/account/profile',
        permanent: false,
      },
      // Account-level routes moved out of /dashboard/settings/* into the
      // product-neutral /account/* surface so Connect-only users don't get
      // flipped into the ERP shell + ERP policy gate when opening Settings.
      // Old bookmarks 301 to the new homes.
      {
        source: '/dashboard/settings',
        destination: '/account/profile',
        permanent: true,
      },
      {
        source: '/dashboard/settings/profile',
        destination: '/account/profile',
        permanent: true,
      },
      {
        source: '/dashboard/settings/security',
        destination: '/account/security',
        permanent: true,
      },
      {
        source: '/dashboard/settings/billing',
        destination: '/account/subscription',
        permanent: true,
      },
      {
        source: '/dashboard/settings/devices',
        destination: '/account/devices',
        permanent: true,
      },
      // Subscription/billing consolidated into the product-neutral account hub.
      // The full subscription experience (Overview + Plans + Add-Ons + Credits +
      // Invoices + Billing Info + Payment Method + Refunds + History) was
      // relocated from the ERP-gated /dashboard/subscription/* into
      // /account/subscription/* so ERP and Connect-only users share one complete
      // home. Old links 301 to the new homes; the deep paths keep their segment.
      {
        source: '/dashboard/subscription',
        destination: '/account/subscription',
        permanent: true,
      },
      {
        source: '/dashboard/subscription/:path*',
        destination: '/account/subscription/:path*',
        permanent: true,
      },
      // Bills module DEPRECATED - superseded by Finance/Purchases (audit pass-2 decision).
      // Redirect to /dashboard so users on plans without Finance access don't dead-end on a lock screen.
      // Finance-enabled users can navigate from there to the Finance module.
      {
        source: '/dashboard/bills',
        destination: '/dashboard',
        permanent: false,
      },
      {
        source: '/dashboard/bills/:path*',
        destination: '/dashboard',
        permanent: false,
      },
    ];
  },
};

// Sentry wrapper - tunnels client requests through /monitoring to bypass ad
// blockers. Source-map GENERATION is disabled (sourcemaps.disable) so the build
// artifact stays small for Amplify's ~230MB limit; without SENTRY_AUTH_TOKEN the
// maps were generated but never uploaded, just bloating the output. When Sentry
// is set up (org/project/authToken via env), drop `disable` to re-enable upload.
export default withSentryConfig(withNextIntl(nextConfig), {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  sourcemaps: {
    disable: true,
  },
  tunnelRoute: '/monitoring',
  disableLogger: true,
  automaticVercelMonitors: false,
});
