import type { Viewport } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import { getLocaleDirection } from '../i18n';
import { HtmlLangSync } from '@/components/HtmlLangSync';
import AntdProvider from '@/components/AntdProvider';
import QueryProvider from '@/components/providers/QueryProvider';
import { KeyboardShortcutProvider } from '@/components/providers/KeyboardShortcutProvider';
import { MobileVerificationGate } from '@/components/auth/MobileVerificationGate';
import InstallPrompt from '@/components/pwa/InstallPrompt';
import EnablePushBanner from '@/components/push/EnablePushBanner';

/**
 * i18n boundary for the AUTHENTICATED app (dashboard, connect, auth, account,
 * admin, kiosk, portal, the public Connect entity pages, setup/invite flows, ...).
 *
 * Why this layer exists: the global root layout (`app/layout.tsx`) was made
 * locale-NEUTRAL + static so the public marketing pages under `app/[locale]/**`
 * can be statically pre-rendered (the locale-routing perf migration). This group
 * layout re-establishes the COOKIE-based locale for everything that is NOT
 * marketing - reading getLocale()/getMessages() here resolves the locale from the
 * `z360_locale` cookie (via `app/i18n.ts` fallback) and keeps these routes dynamic,
 * exactly as before the migration.
 *
 * Cross-module links:
 *  - locale source: `app/i18n.ts` (cookie fallback when no `[locale]` URL segment).
 *  - `HtmlLangSync` corrects <html lang> on the client (the static root renders
 *    `lang="en"`); see `components/HtmlLangSync.tsx` + `app/layout.tsx`.
 *
 * Watch: this is a route-group layout - it adds NO URL segment, so every authed
 * URL (`/dashboard`, `/connect`, `/auth`, `/u/...`, ...) is unchanged. The auth
 * gate itself lives in `proxy.ts`, not here.
 */
// The authenticated app is cookie-personalised and has no SEO value, so it is
// always server-rendered. Declaring it here (instead of relying on the implicit
// cookies() bail) keeps it reliably dynamic now that the root layout is static -
// otherwise Next attempts to statically prerender these cookie-using routes and
// hard-errors. This is the pre-migration behavior (the whole app was dynamic).
export const dynamic = 'force-dynamic';

// Native-app feel for the SIGNED-IN app: lock the viewport so pinch / double-tap
// can't scale the UI (an app shell shouldn't zoom like a webpage). Scoped to
// this (app) route group ONLY - the public marketing/legal pages keep the root
// layout's default zoomable viewport for readability + accessibility. This
// child viewport export merges over the root's (which only sets themeColor), so
// themeColor is preserved. Trade-off: user pinch-zoom is disabled here; system
// font-size scaling still applies.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default async function AppGroupLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();
  const dir = getLocaleDirection(locale);
  // antd (ConfigProvider/App + GoogleOAuth + the heavy rc-* deps), react-query,
  // keyboard shortcuts, the PWA install/push prompt UI, and the dormant mobile
  // verification gate ALL live here (not in the root) so they ship ONLY with the
  // authed app and stay out of the static marketing JS bundle. Behaviour for the
  // authed app is unchanged - same providers, just mounted one layer down.
  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <HtmlLangSync locale={locale} dir={dir} />
      <AntdProvider>
        <QueryProvider>
          <KeyboardShortcutProvider>{children}</KeyboardShortcutProvider>
          <InstallPrompt />
          <EnablePushBanner />
          <MobileVerificationGate />
        </QueryProvider>
      </AntdProvider>
    </NextIntlClientProvider>
  );
}
