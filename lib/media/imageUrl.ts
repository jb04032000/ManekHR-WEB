/**
 * Connect image-delivery helper - turns a stored public image URL into a
 * right-sized CDN variant, or returns it untouched when CDN resizing is not
 * configured. Used by the heavy Connect image surfaces (feed grids, marketplace
 * cards, avatars/logos) so a 1600px upload is not shipped into a 200px cell.
 *
 * Cross-module links:
 *  - Reads `env.imageTransformBase` (NEXT_PUBLIC_IMAGE_TRANSFORM_BASE) from
 *    `lib/env.ts`. EMPTY = feature OFF: every call is a passthrough, so the app
 *    behaves exactly as before. The owner sets it once the public R2 bucket is
 *    served through a proxied Cloudflare custom domain (Image Resizing only
 *    works on a proxied zone, never an `r2.dev` URL fronted by another domain
 *    for the `/cdn-cgi/image/` worker - see the env doc).
 *  - Storage URLs originate from the backend uploads module (R2 public bucket).
 *
 * Gotchas / invariants:
 *  - NEVER transforms a private `r2-private://` ref. Private media is rendered
 *    via short-lived signed URLs that bypass this helper entirely; do not route
 *    them through the public resizer.
 *  - Only OUR storage hosts are rewritten (the custom domain + raw R2 hosts).
 *    Genuinely external URLs (e.g. a Google profile photo) pass through, so we
 *    never proxy a third-party image through our zone.
 *  - Idempotent: an already-wrapped `/cdn-cgi/image/` URL is returned as-is.
 */
import { env } from '@/lib/env';

/** Canonical private-media scheme - must match the backend `toPrivateRef`. */
const PRIVATE_REF_PREFIX = 'r2-private://';

/**
 * Raw Cloudflare R2 host suffixes. A URL on one of these (or on the configured
 * transform base host) is "our storage" and safe to resize. Keeps the helper
 * working whether the owner serves images from the custom domain directly or
 * still from an `r2.dev`/account endpoint behind the resizing zone.
 */
const R2_HOST_SUFFIXES = ['.r2.dev', '.r2.cloudflarestorage.com'];

export interface ImageVariantOptions {
  /** Target render width in CSS px. The resizer caps fetched pixels to ~this. */
  w: number;
  /** Output quality 1-100. Defaults to 75 (Cloudflare's recommended sweet spot). */
  q?: number;
}

function hostIsOurStorage(host: string, baseHost: string): boolean {
  if (host === baseHost) return true;
  return R2_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix));
}

/**
 * Return a CDN-resized variant of `url`, or `url` unchanged when resizing is
 * off or the URL is not a transformable public storage image.
 */
export function imageVariant<T extends string | null | undefined>(
  url: T,
  { w, q = 75 }: ImageVariantOptions,
): T {
  if (!url) return url;

  const base = env.imageTransformBase;
  if (!base) return url; // feature OFF -> behaviour is identical to before
  if (url.startsWith(PRIVATE_REF_PREFIX)) return url; // private media never goes here

  // Only absolute http(s) URLs can be resized. blob:, data:, relative paths and
  // anything unparseable pass through untouched.
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return url;
  // Already a CDN variant -> do not double-wrap.
  if (parsed.pathname.startsWith('/cdn-cgi/image/')) return url;

  let baseHost: string;
  try {
    baseHost = new URL(base).host;
  } catch {
    return url; // misconfigured base -> fail safe to passthrough
  }
  if (!hostIsOurStorage(parsed.host, baseHost)) return url; // external image -> leave it

  const trimmedBase = base.replace(/\/$/, '');
  // Cloudflare Image Resizing: /cdn-cgi/image/<options>/<source>. We pass the
  // full source URL (Cloudflare accepts an absolute source) so the same form
  // works whether the source is the custom domain or a raw R2 host.
  return `${trimmedBase}/cdn-cgi/image/w=${w},q=${q},f=auto/${url}` as T;
}
