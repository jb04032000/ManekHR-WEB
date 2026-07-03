import type { Metadata } from 'next';
import { marketingAlternates } from '@/lib/marketing/seo';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AUTH, JOBS_FAQ_ITEMS, JOBS_FEATURES, JOBS_TYPES } from '@/components/marketing/content';
import { FeatureBlock } from '@/components/marketing/FeatureBlock';
import { JsonLd } from '@/components/marketing/JsonLd';
import { JobsHeroMock } from '@/components/marketing/mockups';
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
  const t = await getTranslations('marketing.pages.jobs.meta');
  return {
    title: t('title'),
    description: t('description'),
    alternates: marketingAlternates('/textile-jobs', locale),
    openGraph: { title: t('title'), description: t('description'), url: '/textile-jobs' },
  };
}

export default async function TextileJobsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('marketing.pages.jobs');
  // FAQPage JSON-LD mirrors the VISIBLE jobs FAQ accordion (same item ids),
  // forced to English since schema is never localized and the en build's visible
  // text matches these strings. Mirrors app/(marketing)/textile-marketplace/page.tsx.
  const tFaqEn = await getTranslations({ locale: 'en', namespace: 'marketing.pages.jobs.faq' });
  const faqEn = JOBS_FAQ_ITEMS.map((id) => ({
    q: tFaqEn(`items.${id}.q`),
    a: tFaqEn(`items.${id}.a`),
  }));
  // English job-type labels for the ItemList JSON-LD (schema is never localized;
  // resolve the same `types.items.*` keys the page renders, forced to en so the
  // schema names match the en build's visible chips). See schema.itemListJsonLd.
  const tTypesEn = await getTranslations({
    locale: 'en',
    namespace: 'marketing.pages.jobs.types',
  });
  const typesEn = JOBS_TYPES.map((id) => tTypesEn(`items.${id}`));
  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'Home', path: '/' },
          { name: 'ManekHR Connect', path: '/connect' },
          { name: 'Textile Jobs', path: '/textile-jobs' },
        ])}
      />
      <JsonLd data={faqPageJsonLd(faqEn)} />
      <JsonLd
        data={itemListJsonLd({
          name: 'Textile job types',
          path: '/textile-jobs',
          items: typesEn,
        })}
      />
      <PageHero
        badge={{ label: t('hero.badge'), tone: 'connect' }}
        title={t('hero.title')}
        sub={t('hero.sub')}
        primary={{ label: t('hero.ctaPrimary'), href: AUTH.getStartedConnect }}
        secondary={{ label: t('hero.ctaSecondary'), href: '/connect' }}
        aside={<JobsHeroMock />}
      />

      <section className="bg-[var(--cr-cream)] py-16 sm:py-20 lg:py-24">
        <Container>
          <SectionHeading
            eyebrow={t('features.eyebrow')}
            title={t('features.title')}
            sub={t('features.sub')}
          />
          <div className="mt-12 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {JOBS_FEATURES.map((id, index) => (
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
            eyebrow={t('types.eyebrow')}
            title={t('types.title')}
            sub={t('types.sub')}
          />
          <ul className="mt-10 flex flex-wrap gap-3">
            {JOBS_TYPES.map((id) => (
              <li
                key={id}
                className="inline-flex items-center gap-2 rounded-full border border-[var(--cr-neutral-200)] bg-[var(--cr-cream)] px-4 py-2 text-[0.95rem] font-medium text-[var(--cr-neutral-700)]"
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: 'var(--cr-gold-500)' }}
                  aria-hidden="true"
                />
                {t(`types.items.${id}`)}
              </li>
            ))}
          </ul>
        </Container>
      </section>

      <section className="bg-[var(--cr-cream)] py-16 sm:py-20 lg:py-24">
        <Container>
          <SectionHeading id="jobs-faq" eyebrow={t('faq.eyebrow')} title={t('faq.title')} />
          <div className="mt-11">
            <FaqAccordion
              items={JOBS_FAQ_ITEMS.map((id) => ({
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
