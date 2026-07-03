import type { Metadata } from 'next';
import { marketingAlternates } from '@/lib/marketing/seo';
import { Link } from '@/i18n/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import {
  AUTH,
  SERVICES_CATEGORIES,
  SERVICES_FAQ_ITEMS,
  SERVICES_FEATURES,
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

/**
 * `/textile-services` - public, SEO-indexable landing for the services / experts
 * directory. The in-app browse (`/connect/services`) is gated and can't be
 * indexed; this page describes the directory + links to that browse. Honest:
 * the indexable per-service pages are `/products/[id]` (they emit schema.org
 * Service). Mirrors the `/textile-marketplace` template exactly, but ALSO emits
 * FAQPage JSON-LD from the start (like the home + /connect pages do). Cross-module
 * links: content.ts (SERVICES_* arrays + footer `services` link), schema.ts
 * (breadcrumb + faqPage builders), marketing.pages.services.* messages.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('marketing.pages.services.meta');
  return {
    title: t('title'),
    description: t('description'),
    alternates: marketingAlternates('/textile-services', locale),
    openGraph: { title: t('title'), description: t('description'), url: '/textile-services' },
  };
}

export default async function TextileServicesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('marketing.pages.services');

  // English copy for the FAQPage schema (JSON-LD is never localized). Built the
  // same way the home + /connect pages build their faqEn arrays.
  const tFaqEn = await getTranslations({ locale: 'en', namespace: 'marketing.pages.services.faq' });
  const faqEn = SERVICES_FAQ_ITEMS.map((id) => ({
    q: tFaqEn(`items.${id}.q`),
    a: tFaqEn(`items.${id}.a`),
  }));

  // English category labels for the ItemList JSON-LD (schema is never localized;
  // resolve the same `categories.items.*` keys the page renders, forced to en so
  // the schema names match the en build's visible chips). See schema.itemListJsonLd.
  const tCatEn = await getTranslations({
    locale: 'en',
    namespace: 'marketing.pages.services.categories',
  });
  const categoriesEn = SERVICES_CATEGORIES.map((id) => tCatEn(`items.${id}`));

  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'Home', path: '/' },
          { name: 'ManekHR Connect', path: '/connect' },
          { name: 'Textile Services', path: '/textile-services' },
        ])}
      />
      <JsonLd data={faqPageJsonLd(faqEn)} />
      <JsonLd
        data={itemListJsonLd({
          name: 'Textile services and experts',
          path: '/textile-services',
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
            {SERVICES_FEATURES.map((id, index) => (
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
            {SERVICES_CATEGORIES.map((id) => (
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
          {/* Link to the in-app Services browse. Honest copy: the browse lives
              inside the app; each service has its own public page at /products/<id>
              (which emits schema.org Service). Mirrors the marketplace page's
              servicesLead/servicesCta link block. */}
          <p className="mt-8 text-[1rem] text-[var(--cr-neutral-700)]">
            {t('categories.browseLead')}{' '}
            <Link
              href="/connect/services"
              className="font-semibold text-[var(--cr-indigo-700)] underline underline-offset-2"
            >
              {t('categories.browseCta')}
            </Link>
          </p>
        </Container>
      </section>

      <section className="bg-[var(--cr-cream)] py-16 sm:py-20 lg:py-24">
        <Container>
          <SectionHeading id="services-faq" eyebrow={t('faq.eyebrow')} title={t('faq.title')} />
          <div className="mt-11">
            <FaqAccordion
              items={SERVICES_FAQ_ITEMS.map((id) => ({
                q: t(`faq.items.${id}.q`),
                a: t(`faq.items.${id}.a`),
              }))}
            />
          </div>
        </Container>
      </section>

      <FinalCta signupIntent="connect" />
    </>
  );
}
