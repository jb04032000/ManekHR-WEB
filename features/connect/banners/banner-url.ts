/**
 * Normalise a user-entered banner link to an ABSOLUTE URL.
 *
 * Why: the carousel renders `<a href={linkUrl}>`. A bare domain like
 * "manekhr.in" (no scheme) is treated by the browser as RELATIVE, so it opens
 * as `/connect/manekhr.in` instead of the external site. Prepending `https://`
 * makes it a real external destination. Empty stays empty (banner is
 * non-clickable). Existing http(s)/mailto/tel schemes and protocol-relative
 * `//host` forms are respected. Used at render (FeedBannerCarousel, defensive)
 * and on save (AdminBannersConsole, cleans stored data going forward).
 */
export function toAbsoluteBannerUrl(url: string | null | undefined): string {
  const trimmed = (url ?? '').trim();
  if (!trimmed) return '';
  if (/^(https?:\/\/|mailto:|tel:)/i.test(trimmed)) return trimmed;
  if (trimmed.startsWith('//')) return `https:${trimmed}`;
  return `https://${trimmed}`;
}
