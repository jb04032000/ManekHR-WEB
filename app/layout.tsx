import type { Metadata, Viewport } from 'next';
import { NextIntlClientProvider } from 'next-intl';
// NOTE: the full `en` catalog is intentionally NOT imported here. The root
// provider serves only routes that render outside the (app)/[locale] groups
// (error.tsx, not-found.tsx, AnalyticsProvider, ServiceWorkerRegistrar) - none
// of which use translations. Marketing re-wraps with the `marketing` namespace
// (app/[locale]/layout.tsx) and the authed app re-wraps with the full catalog
// (app/(app)/layout.tsx). Passing the whole 672KB catalog here inlined it into
// every prerendered marketing page x4 locales -> 746MB Amplify build output.
import './globals.css';
import { DM_Sans } from 'next/font/google';
import Script from 'next/script';
import AnalyticsProvider from '@/components/AnalyticsProvider';
import ServiceWorkerRegistrar from '@/components/pwa/ServiceWorkerRegistrar';
import { Suspense } from 'react';
import { env } from '@/lib/env';

// Dashboard UI is all-sans (2026-05-16). DM Sans covers body + headings;
// `--font-display` aliases this in globals.css. 700 is loaded for headings.
const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
  weight: ['300', '400', '500', '600', '700'],
});

export const metadata: Metadata = {
  metadataBase: new URL(env.appUrl),
  applicationName: 'ManekHR',
  // Google Search Console site-ownership proof. Next renders this as
  // <meta name="google-site-verification"> in <head> on every page (incl. the
  // public homepage), which is the reliable method here since the auth proxy
  // (proxy.ts) blocks stray verification .html files. Keep this token; removing
  // it un-verifies the property in Search Console.
  verification: { google: 'ce2nk3J46PHsg_ElzhlGn4fmUab9ztNGMoeEBqpjuaQ' },
  title: {
    default: 'ManekHR',
    template: '%s | ManekHR',
  },
  description: 'ManekHR - staff and salary, made simple',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-48x48.png', sizes: '48x48', type: 'image/png' },
    ],
    apple: [{ url: '/apple-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  openGraph: {
    type: 'website',
    siteName: 'ManekHR',
    title: 'ManekHR',
    description: 'ManekHR - staff and salary, made simple',
    images: [
      {
        url: '/opengraph-image.png',
        width: 1200,
        height: 630,
        alt: 'ManekHR',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ManekHR',
    description: 'ManekHR - staff and salary, made simple',
    images: ['/twitter-image.png'],
  },
  appleWebApp: {
    title: 'ManekHR',
    capable: true,
    statusBarStyle: 'default',
  },
};

export const viewport: Viewport = {
  themeColor: '#0B6E4F',
};

// ── Dev-only Suspense boundary violation tracer ──────────────────
// Remove this block before deploying to production.
// When the "async info not on parent Suspense boundary" warning fires,
// this prints the full component stack trace to the console so you
// can identify the exact component and line causing it.
if (typeof window !== 'undefined' && env.isDev) {
  const _origError = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    const msg = typeof args[0] === 'string' ? args[0] : '';
    if (
      msg.includes('async info') ||
      msg.includes('Suspense boundary') ||
      msg.includes('was not on the parent Suspense') ||
      msg.includes('cleanup async')
    ) {
      console.trace('🔴 [Suspense Violation] Full stack trace:');
    }
    // Silence AntD v6 "static message can not consume context" warning.
    // Root is wrapped in <App> from antd (components/AntdProvider.tsx), and our
    // theme is static via ConfigProvider - dynamic-theme warning is informational
    // only and does not indicate a functional bug. 348 static `message.X` callsites
    // would need refactor to App.useApp() hook to fully eliminate; not worth the
    // risk for a no-op contextual warning.
    if (msg.includes('[antd: message] Static function can not consume context')) {
      return;
    }
    _origError(...args);
  };
}
// ─────────────────────────────────────────────────────────────────

// LOCALE-NEUTRAL, STATIC root layout. It deliberately does NOT call
// getLocale()/getMessages() (which read cookies and would taint every route as
// dynamic) so the public marketing pages under `app/[locale]/**` can be
// statically pre-rendered (the locale-routing perf migration). It renders a
// static `lang="en"` + a static `en` NextIntlClientProvider as the BASE context.
// The two real locale sources re-wrap their own subtrees:
//   - marketing: `app/[locale]/layout.tsx` (URL locale, static per locale)
//   - authed app: `app/(app)/layout.tsx` (z360_locale cookie, dynamic)
// It deliberately does NOT mount antd here: antd (ConfigProvider/App + rc-*, the
// biggest chunk) lives in app/(app)/layout.tsx so it stays OUT of the static
// marketing JS bundle. Only the antd-free ServiceWorkerRegistrar + analytics are
// global. All current locales are LTR, so `dir="ltr"` is always correct.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" dir="ltr" data-scroll-behavior="smooth" suppressHydrationWarning>
      <body className={`${dmSans.variable} font-body antialiased`} suppressHydrationWarning>
        {/* `now`/`timeZone`/`formats` are passed EXPLICITLY so this server provider
            does NOT call getConfig() (which reads cookies and would taint every
            marketing route dynamic, since the root renders before the [locale]
            segment's setRequestLocale). Static `en` base; marketing + authed app
            re-wrap with their own locale-correct provider. */}
        <NextIntlClientProvider
          locale="en"
          messages={{}}
          now={new Date()}
          timeZone="Asia/Kolkata"
          formats={{}}
        >
          <Suspense fallback={null}>
            <AnalyticsProvider>{children}</AnalyticsProvider>
          </Suspense>
          {/* PWA service worker registration only (antd-free) so marketing pages
              still register the SW for offline/install. The install + push prompt
              UI (antd) and the dormant MobileVerificationGate live in the (app)
              group to keep antd out of the static marketing bundle. */}
          <ServiceWorkerRegistrar />
        </NextIntlClientProvider>
        {/* GA4 deferred to `lazyOnload` (loads on browser idle, after the page is
            interactive) so the ~160KB gtag bundle stays off the critical path and
            does not hurt FCP/LCP/TBT. window.gtag is used null-safely in
            lib/analytics.ts, and the standard snippet queues via dataLayer, so
            events still land once it loads. PostHog (primary analytics) is
            unaffected. Replaces @next/third-parties GoogleAnalytics, which forces
            afterInteractive with no strategy override. */}
        {env.ga4MeasurementId ? (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${env.ga4MeasurementId}`}
              strategy="lazyOnload"
            />
            <Script id="ga4-init" strategy="lazyOnload">
              {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${env.ga4MeasurementId}');`}
            </Script>
          </>
        ) : null}
      </body>
    </html>
  );
}
