import type { Metadata } from 'next';
import { marketingAlternates } from '@/lib/marketing/seo';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import {
  ABOUT_AUDIENCE,
  ABOUT_DO_ITEMS,
  ABOUT_FAQ_ITEMS,
  AUTH,
} from '@/components/marketing/content';
import { ICONS } from '@/components/marketing/icons';
import { JsonLd } from '@/components/marketing/JsonLd';
import { PageHero } from '@/components/marketing/PageHero';
import { breadcrumbJsonLd, faqPageJsonLd } from '@/components/marketing/schema';
import { FaqAccordion } from '@/components/marketing/sections/FaqAccordion';
import { FinalCta } from '@/components/marketing/sections/FinalCta';
import { Container } from '@/components/marketing/ui/Container';
import { SectionHeading } from '@/components/marketing/ui/SectionHeading';

/**
 * `/about` - the canonical "What is ManekHR?" ENTITY page: the page Google +
 * answer/generative engines should cite for the brand query. Rewritten (was a
 * company-story page) to lead with a direct, factual, quotable answer (category
 * + who it is for) in plain tone, then short self-contained sections (who it is
 * for, what you can do, languages, free to start) and a VISIBLE FAQ whose
 * English copy is mirrored into FAQPage JSON-LD via faqPageJsonLd(). Mirrors the
 * /textile-services page pattern (generateMetadata + breadcrumb + faqEn). Cross-
 * module links: content.ts (ABOUT_* arrays + AUTH.getStarted + footer `about`
 * link), schema.ts (breadcrumb + faqPage builders), marketing.pages.about.*
 * messages, ICONS for the card icons.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('marketing.pages.about.meta');
  return {
    title: t('title'),
    description: t('description'),
    alternates: marketingAlternates('/about', locale),
    openGraph: { title: t('title'), description: t('description'), url: '/about' },
  };
}

export default async function AboutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('marketing.pages.about');

  // English copy for the FAQPage schema (JSON-LD is never localized). Built the
  // same way the home + /textile-services pages build their faqEn arrays.
  const tFaqEn = await getTranslations({ locale: 'en', namespace: 'marketing.pages.about.faq' });
  const faqEn = ABOUT_FAQ_ITEMS.map((id) => ({
    q: tFaqEn(`items.${id}.q`),
    a: tFaqEn(`items.${id}.a`),
  }));

  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'Home', path: '/' },
          { name: 'About', path: '/about' },
        ])}
      />
      <JsonLd data={faqPageJsonLd(faqEn)} />

      <PageHero
        eyebrow={t('hero.eyebrow')}
        title={t('hero.title')}
        sub={t('hero.sub')}
        primary={{ label: t('hero.cta'), href: AUTH.getStarted }}
      />

      {/* The direct, quotable answer (category + who it is for) in plain tone.
          Kept as a single self-contained paragraph an answer engine can lift. */}
      <section className="bg-[var(--cr-cream)] py-16 sm:py-20 lg:py-24">
        <Container>
          <div className="max-w-3xl">
            <SectionHeading title={t('answer.heading')} />
            <p className="mt-5 text-[1.12rem] leading-relaxed text-pretty text-[var(--cr-neutral-700)]">
              {t('answer.body')}
            </p>
          </div>
        </Container>
      </section>

      {/* Who it is for - the real trade personas. */}
      <section className="bg-white py-16 sm:py-20 lg:py-24">
        <Container>
          <SectionHeading
            eyebrow={t('audience.eyebrow')}
            title={t('audience.heading')}
            sub={t('audience.sub')}
          />
          <div className="mt-12 grid grid-cols-1 gap-x-10 gap-y-9 sm:grid-cols-2 lg:grid-cols-3">
            {ABOUT_AUDIENCE.map((item) => {
              const Icon = ICONS[item.icon];
              return (
                <div key={item.id}>
                  <span className="grid h-11 w-11 place-items-center rounded-[12px] bg-[var(--cr-indigo-50)] text-[var(--cr-indigo-700)]">
                    {Icon ? <Icon className="h-[21px] w-[21px]" /> : null}
                  </span>
                  <h3 className="pt-4 text-[1.12rem]">{t(`audience.items.${item.id}.title`)}</h3>
                  <p className="pt-2 text-[0.96rem] leading-relaxed text-[var(--cr-neutral-600)]">
                    {t(`audience.items.${item.id}.body`)}
                  </p>
                </div>
              );
            })}
          </div>
        </Container>
      </section>

      {/* What you can do - the four jobs (network / marketplace / jobs / ERP). */}
      <section className="bg-[var(--cr-cream)] py-16 sm:py-20 lg:py-24">
        <Container>
          <SectionHeading
            eyebrow={t('doItems.eyebrow')}
            title={t('doItems.heading')}
            sub={t('doItems.sub')}
          />
          <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2">
            {ABOUT_DO_ITEMS.map((item) => {
              const Icon = ICONS[item.icon];
              return (
                <div
                  key={item.id}
                  className="rounded-[16px] border border-[var(--cr-neutral-200)] bg-white p-7"
                >
                  <span className="grid h-11 w-11 place-items-center rounded-[12px] bg-[var(--cr-indigo-50)] text-[var(--cr-indigo-700)]">
                    {Icon ? <Icon className="h-[21px] w-[21px]" /> : null}
                  </span>
                  <h3 className="pt-4 text-[1.18rem]">{t(`doItems.items.${item.id}.title`)}</h3>
                  <p className="pt-2 text-[0.96rem] leading-relaxed text-[var(--cr-neutral-600)]">
                    {t(`doItems.items.${item.id}.body`)}
                  </p>
                </div>
              );
            })}
          </div>
        </Container>
      </section>

      {/* Languages + free to start - two short, self-contained facts. */}
      <section className="bg-white py-16 sm:py-20 lg:py-24">
        <Container>
          <div className="grid grid-cols-1 gap-10 sm:grid-cols-2">
            <div>
              <SectionHeading title={t('languages.heading')} />
              <p className="mt-4 text-[1.02rem] leading-relaxed text-pretty text-[var(--cr-neutral-600)]">
                {t('languages.body')}
              </p>
            </div>
            <div>
              <SectionHeading title={t('free.heading')} />
              <p className="mt-4 text-[1.02rem] leading-relaxed text-pretty text-[var(--cr-neutral-600)]">
                {t('free.body')}
              </p>
            </div>
          </div>
        </Container>
      </section>

      {/* Visible FAQ - the brand-entity questions, mirrored into FAQPage JSON-LD
          (the faqEn array above). */}
      <section className="bg-[var(--cr-cream)] py-16 sm:py-20 lg:py-24">
        <Container>
          <SectionHeading id="about-faq" eyebrow={t('faq.eyebrow')} title={t('faq.title')} />
          <div className="mt-11">
            <FaqAccordion
              items={ABOUT_FAQ_ITEMS.map((id) => ({
                q: t(`faq.items.${id}.q`),
                a: t(`faq.items.${id}.a`),
              }))}
            />
          </div>
        </Container>
      </section>

      <FinalCta />
    </>
  );
}
