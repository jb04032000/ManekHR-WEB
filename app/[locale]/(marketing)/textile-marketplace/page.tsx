import type { Metadata } from 'next';
import { marketingAlternates } from '@/lib/marketing/seo';
import { Link } from '@/i18n/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import {
  AUTH,
  MARKETPLACE_CATEGORIES,
  MARKETPLACE_FAQ_ITEMS,
  MARKETPLACE_FEATURES,
} from '@/components/marketing/content';
import { FeatureBlock } from '@/components/marketing/FeatureBlock';
import { JsonLd } from '@/components/marketing/JsonLd';
import { MarketplaceHeroMock } from '@/components/marketing/mockups';
import { PageHero } from '@/components/marketing/PageHero';
import { breadcrumbJsonLd, faqPageJsonLd, itemListJsonLd } from '@/components/marketing/schema';
import { FaqAccordion } from '@/components/marketing/sections/FaqAccordion';
import { FinalCta } from '@/components/marketing/sections/FinalCta';
import { Container } from '@/components/marketing/ui/Container';
import { SectionHeading } from '@/components/marketing/ui/SectionHeading';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('marketing.pages.marketplace.meta');
  return {
    title: t('title'),
    description: t('description'),
    alternates: marketingAlternates('/textile-marketplace', locale),
    openGraph: { title: t('title'), description: t('description'), url: '/textile-marketplace' },
  };
}

export default async function TextileMarketplacePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('marketing.pages.marketplace');
  // FAQPage JSON-LD mirrors the VISIBLE marketplace FAQ accordion (same item
  // ids), forced to English since schema is never localized and the en build's
  // visible text matches these strings. Mirrors app/(marketing)/page.tsx (home)
  // and app/(marketing)/connect/page.tsx.
  const tFaqEn = await getTranslations({
    locale: 'en',
    namespace: 'marketing.pages.marketplace.faq',
  });
  const faqEn = MARKETPLACE_FAQ_ITEMS.map((id) => ({
    q: tFaqEn(`items.${id}.q`),
    a: tFaqEn(`items.${id}.a`),
  }));
  // English category labels for the ItemList JSON-LD (schema is never localized;
  // resolve the same `categories.items.*` keys the page renders, forced to en so
  // the schema names match the en build's visible chips). See schema.itemListJsonLd.
  const tCatEn = await getTranslations({
    locale: 'en',
    namespace: 'marketing.pages.marketplace.categories',
  });
  const categoriesEn = MARKETPLACE_CATEGORIES.map((id) => tCatEn(`items.${id}`));
  // Internal links to the SEO landing pages. Labels reuse each page's hero badge
  // (already localized), so this needs no new label keys — only `popular.title`.
  // Keeps the pages discoverable without cluttering the footer.
  const tSaree = await getTranslations('marketing.pages.sareeWholesalers.hero');
  const tZari = await getTranslations('marketing.pages.zariManufacturers.hero');
  const tEmb = await getTranslations('marketing.pages.embroideryJobWork.hero');
  const tFab = await getTranslations('marketing.pages.fabricSuppliers.hero');
  const tDress = await getTranslations('marketing.pages.dressMaterialWholesalers.hero');
  const popularLinks = [
    { href: '/saree-wholesalers', label: tSaree('badge') },
    { href: '/zari-manufacturers', label: tZari('badge') },
    { href: '/embroidery-job-work', label: tEmb('badge') },
    { href: '/fabric-suppliers', label: tFab('badge') },
    { href: '/dress-material-wholesalers', label: tDress('badge') },
  ];
  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'Home', path: '/' },
          { name: 'ManekHR Connect', path: '/connect' },
          { name: 'Textile Marketplace', path: '/textile-marketplace' },
        ])}
      />
      <JsonLd data={faqPageJsonLd(faqEn)} />
      <JsonLd
        data={itemListJsonLd({
          name: 'Textile marketplace categories',
          path: '/textile-marketplace',
          items: categoriesEn,
        })}
      />
      <PageHero
        badge={{ label: t('hero.badge'), tone: 'connect' }}
        title={t('hero.title')}
        sub={t('hero.sub')}
        primary={{ label: t('hero.ctaPrimary'), href: AUTH.getStartedConnect }}
        secondary={{ label: t('hero.ctaSecondary'), href: '/connect' }}
        aside={<MarketplaceHeroMock />}
      />

      <section className="bg-[var(--cr-cream)] py-16 sm:py-20 lg:py-24">
        <Container>
          <SectionHeading
            eyebrow={t('features.eyebrow')}
            title={t('features.title')}
            sub={t('features.sub')}
          />
          <div className="mt-12 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {MARKETPLACE_FEATURES.map((id, index) => (
              <FeatureBlock
                key={id}
                no={`0${index + 1}`}
                title={t(`features.items.${id}.title`)}
                desc={t(`features.items.${id}.desc`)}
                bullets={[
                  t(`features.items.${id}.b1`),
                  t(`features.items.${id}.b2`),
                  t(`features.items.${id}.b3`),
                ]}
              />
            ))}
          </div>
        </Container>
      </section>

      <section className="bg-white py-16 sm:py-20 lg:py-24">
        <Container>
          <SectionHeading
            eyebrow={t('categories.eyebrow')}
            title={t('categories.title')}
            sub={t('categories.sub')}
          />
          <ul className="mt-10 flex flex-wrap gap-3">
            {MARKETPLACE_CATEGORIES.map((id) => (
              <li
                key={id}
                className="inline-flex items-center gap-2 rounded-full border border-[var(--cr-neutral-200)] bg-[var(--cr-cream)] px-4 py-2 text-[0.95rem] font-medium text-[var(--cr-neutral-700)]"
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: 'var(--cr-gold-500)' }}
                  aria-hidden="true"
                />
                {t(`categories.items.${id}`)}
              </li>
            ))}
          </ul>
          {/* Slice B3: link to the in-app Services browse so a buyer looking for
              a service provider (not a product) lands on the right surface.
              Honest copy: services are real listings with a service category. */}
          <p className="mt-8 text-[1rem] text-[var(--cr-neutral-700)]">
            {t('categories.servicesLead')}{' '}
            <Link
              href="/connect/services"
              className="font-semibold text-[var(--cr-indigo-700)] underline underline-offset-2"
            >
              {t('categories.servicesCta')}
            </Link>
          </p>
        </Container>
      </section>

      <section className="bg-[var(--cr-cream)] py-16 sm:py-20 lg:py-24">
        <Container>
          <SectionHeading id="marketplace-faq" eyebrow={t('faq.eyebrow')} title={t('faq.title')} />
          <div className="mt-11">
            <FaqAccordion
              items={MARKETPLACE_FAQ_ITEMS.map((id) => ({
                q: t(`faq.items.${id}.q`),
                a: t(`faq.items.${id}.a`),
              }))}
            />
          </div>
        </Container>
      </section>

      <section className="bg-[var(--cr-cream)] py-12 sm:py-14">
        <Container>
          <h2 className="mkt-mono text-[0.72rem] font-semibold tracking-[0.12em] text-[var(--cr-neutral-500)] uppercase">
            {t('popular.title')}
          </h2>
          <ul className="mt-5 flex flex-wrap gap-3">
            {popularLinks.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className="inline-flex items-center gap-2 rounded-full border border-[var(--cr-neutral-200)] bg-white px-4 py-2 text-[0.95rem] font-medium text-[var(--cr-neutral-700)] transition-colors hover:text-[var(--cr-indigo-700)]"
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: 'var(--cr-gold-500)' }}
                    aria-hidden="true"
                  />
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      <FinalCta signupIntent="connect" />
    </>
  );
}
