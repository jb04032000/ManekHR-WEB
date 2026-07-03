import Script from 'next/script';
import { env } from '@/lib/env';

/**
 * AdSenseLoader - injects the Google AdSense loader script ONCE, and ONLY when
 * the owner has set a publisher id (env-gated on `env.adSenseClientId`).
 *
 * Mounted solely in the Connect shell layout (app/connect/layout.tsx), so the
 * script never loads on ERP / marketing / kiosk / portal / admin routes. Across
 * client-side navigations within /connect, next/script dedupes by `id`, so a
 * second copy is never mounted. `afterInteractive` loads the script async; the
 * explicit `async` + `crossOrigin="anonymous"` match the AdSense embed docs.
 *
 * Empty publisher id = returns null: no script tag, no network call, byte-
 * identical to a deploy with AdSense off. Links: GoogleAdUnit (fills <ins> via
 * adsbygoogle.push once this loader is ready).
 */
export default function AdSenseLoader() {
  if (!env.adSenseClientId) return null;

  return (
    <Script
      id="adsbygoogle-loader"
      strategy="afterInteractive"
      async
      crossOrigin="anonymous"
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${env.adSenseClientId}`}
    />
  );
}
