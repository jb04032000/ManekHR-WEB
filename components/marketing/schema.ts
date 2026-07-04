/**
 * JSON-LD structured-data builders for the marketing site.
 *
 * Address carries country only — no locality/region, per the no-region
 * requirement. Schema content is always English (never localized): search +
 * answer engines read the default-locale render, and the visible FAQ text
 * matches these strings for the `en` build.
 */
import { env } from '@/lib/env';

const BASE = env.appUrl;

/**
 * Topical keyword signal for search + answer/generative engines, attached to the
 * site's schema entities (Organization, WebSite, SoftwareApplication, pricing).
 * INVISIBLE to visitors and locale-independent (schema is always English), so it
 * adds keyword context on every page without any change to on-page content.
 *
 * Covers ManekHR as it actually is: staff + salary management software for
 * diamond-polishing units in Surat (team directory, attendance, payroll,
 * role-based access). Extend here only with terms that match what ManekHR
 * actually does.
 */
export const SITE_KEYWORDS = [
  'staff management software',
  'salary software for diamond units',
  'payroll software India',
  'karigar attendance software',
  'HR software for diamond polishing units',
  'diamond unit staff management Surat',
  'employee attendance app',
  'role based access control software',
  'small business payroll software India',
  'HR software Gujarati',
].join(', ');

const ORGANIZATION = {
  '@type': 'Organization',
  '@id': `${BASE}/#organization`,
  name: 'ManekHR',
  url: BASE,
  logo: `${BASE}/icon-512.png`,
  description:
    'ManekHR is staff and salary management software for diamond-polishing units in Surat — team records, attendance, payroll, and role-based access in one place.',
  keywords: SITE_KEYWORDS,
  address: { '@type': 'PostalAddress', addressCountry: 'IN' },
  // contactPoint completes the brand entity for the SERP knowledge panel. Email is
  // the single support mailbox (lib/env.supportEmail, same source as content.ts
  // CONTACT_EMAIL); areaServed IN matches the India-only address above. Keep the
  // email in sync with content.ts.
  contactPoint: {
    '@type': 'ContactPoint',
    email: env.supportEmail,
    contactType: 'customer support',
    areaServed: 'IN',
    availableLanguage: ['en', 'gu', 'hi'],
  },
  // sameAs ties this entity to its official profiles so search + answer engines
  // resolve "ManekHR" to one knowledge-graph node. Only real, owned profiles —
  // the WhatsApp link is a placeholder number, so it is deliberately excluded.
  // The Instagram handle MUST match the real account in content.ts SOCIAL_LINKS
  // (manekhrapp); a wrong handle here points at a non-existent profile and splits
  // the brand entity, which is a direct cause of AI engines citing Instagram over
  // the site. Keep both handles in sync with content.ts.
  sameAs: [
    'https://www.linkedin.com/company/manekhr',
    'https://www.instagram.com/manekhrapp',
    // Wikidata entity (Q140377775) - the authoritative node Google's Knowledge
    // Graph + AI engines resolve "ManekHR" against; keep in sync with the
    // official-website (P856) statement on the Wikidata item (must point back here).
    'https://www.wikidata.org/wiki/Q140377775',
    // Crunchbase profile - a trusted source AI engines sample for company info.
    'https://www.crunchbase.com/organization/manekhr',
  ],
};

/** Home page graph: Organization + WebSite + SoftwareApplication. */
export function homeJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      ORGANIZATION,
      {
        '@type': 'WebSite',
        '@id': `${BASE}/#website`,
        name: 'ManekHR',
        url: BASE,
        keywords: SITE_KEYWORDS,
        publisher: { '@id': `${BASE}/#organization` },
      },
      {
        '@type': 'SoftwareApplication',
        name: 'ManekHR',
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Web',
        url: BASE,
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'INR' },
        publisher: { '@id': `${BASE}/#organization` },
      },
    ],
  };
}

/**
 * SoftwareApplication for a specific product page (e.g. /erp). ManekHR is a
 * free web application (no mobile app), so we use SoftwareApplication (not
 * Product) and model the free tier as a 0 INR Offer.
 */
export function softwareAppJsonLd(opts: { name: string; path: string; description: string }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: opts.name,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    url: `${BASE}${opts.path}`,
    description: opts.description,
    keywords: SITE_KEYWORDS,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'INR' },
    publisher: { '@id': `${BASE}/#organization` },
  };
}

/**
 * Pricing structured data for /pricing: ManekHR ERP modelled as a
 * SoftwareApplication whose `offers` is an AggregateOffer carrying the REAL plan
 * prices (one nested Offer per plan). This is what lets search + answer/generative
 * engines read and quote the actual prices ("Starter is ₹999/month") instead of
 * guessing. Built from the SAME live plans the cards render, so it never drifts.
 *
 * `monthlyPrice` is the per-month figure shown on the card (rupees; 0 = Free).
 * Returns null when no plans are available (DB hiccup) so we never publish empty
 * or fake pricing. Plan names are English (the schema is never localized).
 */
export function erpPricingJsonLd(plans: { name: string; monthlyPrice: number }[]) {
  if (plans.length === 0) return null;
  const prices = plans.map((p) => p.monthlyPrice);
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'ManekHR ERP',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    url: `${BASE}/pricing`,
    description:
      'Staff records, attendance, and payroll for diamond-polishing units. GST-ready, free to start.',
    keywords: SITE_KEYWORDS,
    publisher: { '@id': `${BASE}/#organization` },
    offers: {
      '@type': 'AggregateOffer',
      priceCurrency: 'INR',
      lowPrice: Math.min(...prices),
      highPrice: Math.max(...prices),
      offerCount: plans.length,
      offers: plans.map((p) => ({
        '@type': 'Offer',
        name: `${p.name} plan`,
        url: `${BASE}/pricing`,
        // UnitPriceSpecification makes the per-MONTH unit explicit (the plan is a
        // 1-year term billed in monthly parts), so engines say "₹X/month".
        priceSpecification: {
          '@type': 'UnitPriceSpecification',
          price: p.monthlyPrice,
          priceCurrency: 'INR',
          unitCode: 'MON',
        },
      })),
    },
  };
}

/**
 * FAQPage built from the page's VISIBLE questions/answers (pass English copy).
 * The answers should be self-contained statements an answer engine can quote.
 */
export function faqPageJsonLd(items: { q: string; a: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    })),
  };
}

/**
 * CollectionPage + ItemList for a directory-style landing page (e.g. /guides).
 * Emits the page's VISIBLE category labels as an ordered schema.org ItemList
 * so search + answer/generative engines read the page's taxonomy (each entry
 * a positioned ListItem). Pass the already-translated names the page renders
 * so the schema matches what users see; mirrors the faqPageJsonLd contract
 * (caller resolves the i18n, this builder is pure).
 *
 * Keep one ItemList per page (do not also emit a second list builder there).
 */
export function itemListJsonLd(opts: { name: string; path: string; items: string[] }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    url: `${BASE}${opts.path}`,
    name: opts.name,
    mainEntity: {
      '@type': 'ItemList',
      name: opts.name,
      numberOfItems: opts.items.length,
      itemListElement: opts.items.map((name, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name,
      })),
    },
  };
}

/** Breadcrumb trail for a marketing sub-page. */
export function breadcrumbJsonLd(items: { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: `${BASE}${item.path}`,
    })),
  };
}
