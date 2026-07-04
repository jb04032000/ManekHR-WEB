import type { Metadata } from 'next';
import { marketingAlternates } from '@/lib/marketing/seo';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AUTH } from '@/components/marketing/content';
import { FeatureBlock } from '@/components/marketing/FeatureBlock';
import { JsonLd } from '@/components/marketing/JsonLd';
import { PageHero } from '@/components/marketing/PageHero';
import { breadcrumbJsonLd } from '@/components/marketing/schema';
import { FinalCta } from '@/components/marketing/sections/FinalCta';
import { Container } from '@/components/marketing/ui/Container';
import { SectionHeading } from '@/components/marketing/ui/SectionHeading';

const PILLARS = ['team', 'attendance', 'salary', 'roles'] as const;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('marketing.pages.erp.meta');
  const title = t('title');
  const description = t('description');
  return {
    title,
    description,
    alternates: marketingAlternates('/erp', locale),
    openGraph: { type: 'website', title, description, url: '/erp', siteName: 'ManekHR' },
    twitter: { card: 'summary_large_image', title, description },
  };
}

export default async function ErpPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('marketing.pages.erp');
  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'Home', path: '/' },
          { name: 'ManekHR ERP', path: '/erp' },
        ])}
      />
      <PageHero
        badge={{ label: t('hero.badge'), tone: 'erp' }}
        title={t('hero.title')}
        sub={t('hero.sub')}
        primary={{ label: t('hero.ctaPrimary'), href: AUTH.getStartedErp }}
        // Pricing now sits IN the hero CTA row (it used to float alone in a
        // white strip below the hero, which read as a broken leftover). Order:
        // start trial > see pricing.
        secondary={{ label: t('hero.ctaPricing'), href: '/erp/pricing' }}
      />
      <section className="bg-[var(--cr-cream)] py-16 sm:py-20 lg:py-24">
        <Container>
          <SectionHeading
            eyebrow={t('features.eyebrow')}
            title={t('features.title')}
            sub={t('features.sub')}
          />
          <div className="mt-12 grid grid-cols-1 gap-5 md:grid-cols-2">
            {PILLARS.map((id, index) => (
              // `id` anchors each pillar (#team / #attendance / #salary / #roles)
              // so the marketing footer's ERP feature links scroll straight here.
              // scroll-mt offsets the sticky navbar so the heading is not hidden.
              <div key={id} id={id} className="scroll-mt-24">
                <FeatureBlock
                  no={`0${index + 1}`}
                  title={t(`features.items.${id}.title`)}
                  desc={t(`features.items.${id}.desc`)}
                  bullets={[
                    t(`features.items.${id}.b1`),
                    t(`features.items.${id}.b2`),
                    t(`features.items.${id}.b3`),
                  ]}
                />
              </div>
            ))}
          </div>
        </Container>
      </section>
      <FinalCta page="erp" />
    </>
  );
}
