/**
 * Shared metadata builder for the PUBLIC Connect entity pages. Standardizes the
 * SEO + social fields every public page needs so they never drift: a canonical
 * URL, robots index policy, an OpenGraph block, and a Twitter summary card. The
 * og/twitter image falls back to the static brand image when the entity has no
 * cover/logo, so a shared link always unfurls with a picture.
 *
 * Cross-module: used by app/(connect-public)/* generateMetadata. The static
 * fallback is app/opengraph-image.png (the same brand card the root layout uses).
 * metadataBase (root layout) makes the relative canonical/image absolute.
 */
import type { Metadata } from 'next';

/** The brand OG card shipped at app/opengraph-image.png (1200x630). */
const STATIC_OG = '/opengraph-image.png';

export type EntityOgType = 'website' | 'article' | 'profile';

/**
 * Build the title/description/canonical/robots/openGraph/twitter block for a
 * public entity page. Pass `index: false` for empty/not-found/suppressed states
 * so crawlers skip them. `image` is the entity cover/logo; omit/null falls back
 * to the brand card.
 */
export function entitySeo(opts: {
  path: string;
  title: string;
  description: string;
  image?: string | null;
  ogType?: EntityOgType;
  index?: boolean;
}): Metadata {
  const img = opts.image || STATIC_OG;
  const robots =
    opts.index === false ? { index: false, follow: false } : { index: true, follow: true };
  return {
    title: opts.title,
    description: opts.description,
    alternates: { canonical: opts.path },
    robots,
    openGraph: {
      type: opts.ogType ?? 'website',
      title: opts.title,
      description: opts.description,
      url: opts.path,
      images: [{ url: img }],
    },
    twitter: {
      card: 'summary_large_image',
      title: opts.title,
      description: opts.description,
      images: [img],
    },
  };
}

/** Metadata for a not-found / unresolved public entity (noindex, generic title). */
export function notFoundSeo(title: string): Metadata {
  return { title, robots: { index: false, follow: false } };
}
