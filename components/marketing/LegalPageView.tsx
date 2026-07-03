import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import ReactMarkdown, { type Components } from 'react-markdown';
import { getPublishedLegalPage } from '@/lib/actions';
import { marketingAlternates } from '@/lib/marketing/seo';

/**
 * Renders an admin-managed legal/policy page (Terms or Privacy, per product) for
 * the public marketing site. Fetches the PUBLISHED version by slug; when none is
 * published yet it falls back to the localized placeholder copy.
 *
 * Cross-module links: getPublishedLegalPage -> legal-pages.public.controller
 * (@Public, published-only). Markdown body is authored in the admin CMS
 * (app/admin/legal-pages). Typography lives in the `.legal-prose` block in
 * app/globals.css.
 */

type LegalKind = 'terms' | 'privacy' | 'guidelines';
type LegalProduct = 'platform' | 'connect' | 'erp';

const PRODUCT_LABEL: Record<LegalProduct, string> = {
  platform: 'ManekHR',
  connect: 'Connect',
  erp: 'ERP',
};

/**
 * Slug scheme (keep in sync with the seed in crewroster-backend
 * src/migrations/seed-legal-pages.ts and the admin page's slug helper):
 *   platform -> `terms` / `privacy`  (company-wide canonical; /terms, /privacy)
 *   connect/erp -> `terms-connect`, `privacy-erp`, ...  (product-specific)
 */
function legalSlug(kind: LegalKind, product: LegalProduct): string {
  return product === 'platform' ? kind : `${kind}-${product}`;
}

/**
 * Route path for a legal page (matches the App Router segments + the canonical):
 *   platform -> `/terms`, `/privacy`
 *   connect/erp -> `/terms/connect`, `/privacy/erp`, ...
 * Keep in sync with the actual page locations under app/(marketing).
 */
function legalPath(kind: LegalKind, product: LegalProduct): string {
  return product === 'platform' ? `/${kind}` : `/${kind}/${product}`;
}

/**
 * Shared generateMetadata helper for the 7 legal routes (terms/privacy x
 * platform/connect/erp + guidelines/connect). Gives each route a UNIQUE,
 * scope-specific title + description and a self-canonical, which kills the
 * duplicate-title cannibalization the three identical "Privacy Policy" / "Terms"
 * titles caused.
 *
 * Thin-content guard: fetches the PUBLISHED doc by slug (the same
 * getPublishedLegalPage the view uses). When a real document exists we index it
 * (index:true) with its published title; until then the page only renders the
 * "will be published soon" placeholder, so we set robots noindex,follow so Google
 * does not index an empty page. Indexing turns on automatically once an admin
 * publishes real text in /admin/legal-pages (no code change needed).
 *
 * Titles/descriptions are i18n-driven (parity enforced by check:i18n), matching
 * how the rest of the marketing pages do meta - keys live under
 * `<kind>.meta.<product>` in app/messages/*.json.
 */
export async function legalPageMetadata({
  kind,
  product,
  locale,
}: {
  kind: LegalKind;
  product: LegalProduct;
  // Active URL locale (from the [locale] segment params). Drives per-locale
  // canonical + hreflang so /gu/privacy etc. are indexed distinctly.
  locale: string;
}): Promise<Metadata> {
  const t = await getTranslations(`${kind}.meta.${product}`);
  const alternates = marketingAlternates(legalPath(kind, product), locale);
  const page = await getPublishedLegalPage(legalSlug(kind, product));

  // Published: use the admin-authored title and allow indexing. Placeholder-only:
  // keep the localized scope title but noindex so the empty page stays out of the
  // index. `follow` stays true either way so link equity flows to other pages.
  const title = page ? page.title : t('title');
  return {
    title,
    description: t('description'),
    alternates,
    robots: { index: !!page, follow: true },
    openGraph: { title, description: t('description'), url: alternates.canonical },
  };
}

// Only override links: external links open in a new tab with a safe rel; internal
// links stay inline. Destructuring just children/href keeps the react-markdown
// `node` prop off the DOM element (no spread) without an unused-var.
const markdownComponents: Components = {
  a: ({ children, href }) => {
    const external = !!href && /^https?:\/\//i.test(href);
    return (
      <a href={href} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
        {children}
      </a>
    );
  },
};

export async function LegalPageView({ kind, product }: { kind: LegalKind; product: LegalProduct }) {
  const page = await getPublishedLegalPage(legalSlug(kind, product));
  const t = await getTranslations(`${kind}.placeholder`);

  if (!page) {
    // No published version yet — show the localized placeholder (same copy the
    // page showed before the CMS existed).
    return (
      <main className="mx-auto max-w-[680px] px-6 py-16">
        <h1 className="font-display text-2xl font-semibold text-heading">{t('title')}</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-muted">
          {t('body', { product: PRODUCT_LABEL[product] })}
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-[720px] px-6 py-16">
      <div className="legal-prose">
        <ReactMarkdown components={markdownComponents}>{page.body}</ReactMarkdown>
      </div>
    </main>
  );
}
