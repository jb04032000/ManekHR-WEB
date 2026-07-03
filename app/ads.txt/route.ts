import { env } from '@/lib/env';

/**
 * /ads.txt - the IAB "Authorized Digital Sellers" file AdSense requires at the
 * domain root to verify this domain is authorised to sell its ad inventory.
 *
 * Driven by the publisher id (NEXT_PUBLIC_ADSENSE_CLIENT_ID, read via lib/env):
 *   - SET   -> emit the single standard Google DIRECT line.
 *   - UNSET -> 404 (no file), so an unconfigured deploy is byte-identical to
 *              today (mirrors how app/robots.ts is env-driven).
 *
 * Line format (IAB ads.txt v1.1 + AdSense docs):
 *   google.com, pub-0000000000000000, DIRECT, f08c47fec0942fa0
 *   <ad system>, <publisher id>,       <rel>,  <certification authority id>
 * The publisher id in ads.txt is the bare `pub-...`; our env carries the AdSense
 * `ca-pub-...` form, so we strip the `ca-` prefix. The trailing TAG-ID is
 * Google's fixed certification-authority id. Sources:
 *   https://support.google.com/adsense/answer/12171612
 *   https://iabtechlab.com/ads-txt/
 */

/** Google's fixed certification-authority id for ads.txt (per AdSense docs). */
const GOOGLE_CERT_AUTHORITY_ID = 'f08c47fec0942fa0';

export function GET(): Response {
  const clientId = env.adSenseClientId; // 'ca-pub-...' when configured, else ''
  if (!clientId) {
    // Unconfigured: behave as if the file does not exist (no DIRECT line to leak).
    return new Response('Not found', { status: 404 });
  }

  const publisherId = clientId.replace(/^ca-/, ''); // 'ca-pub-...' -> 'pub-...'
  const body = `google.com, ${publisherId}, DIRECT, ${GOOGLE_CERT_AUTHORITY_ID}\n`;

  return new Response(body, {
    status: 200,
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
}
