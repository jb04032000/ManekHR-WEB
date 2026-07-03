import type { Metadata } from 'next';
import { marketingAlternates } from '@/lib/marketing/seo';
import { Link } from '@/i18n/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AUTH, MARKETPLACE_FAQ_ITEMS } from '@/components/marketing/content';
import { JsonLd } from '@/components/marketing/JsonLd';
import { MarketplaceHeroMock } from '@/components/marketing/mockups';
import { PageHero } from '@/components/marketing/PageHero';
import { breadcrumbJsonLd, faqPageJsonLd } from '@/components/marketing/schema';
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
  const t = await getTranslations('marketing.pages.fabricSuppliers.meta');
  return {
    title: t('title'),
    description: t('description'),
    alternates: marketingAlternates('/fabric-suppliers', locale),
    openGraph: { title: t('title'), description: t('description'), url: '/fabric-suppliers' },
  };
}

// SEO landing for "fabric suppliers / grey fabric" intent. Reuses the marketplace
// FAQ (already localized) and its own meta + hero + intro block
// (marketing.pages.fabricSuppliers.*). Mirrors saree-wholesalers/page.tsx.
export default async function FabricSuppliersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('marketing.pages.fabricSuppliers');
  const tFaq = await getTranslations('marketing.pages.marketplace.faq');
  const tFaqEn = await getTranslations({
    locale: 'en',
    namespace: 'marketing.pages.marketplace.faq',
  });
  const faqEn = MARKETPLACE_FAQ_ITEMS.map((id) => ({
    q: tFaqEn(`items.${id}.q`),
    a: tFaqEn(`items.${id}.a`),
  }));

  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'Home', path: '/' },
          { name: 'Textile Marketplace', path: '/textile-marketplace' },
          { name: 'Fabric Suppliers', path: '/fabric-suppliers' },
        ])}
      />
      <JsonLd data={faqPageJsonLd(faqEn)} />

      <PageHero
        badge={{ label: t('hero.badge'), tone: 'connect' }}
        title={t('hero.title')}
        sub={t('hero.sub')}
        primary={{ label: t('hero.ctaPrimary'), href: AUTH.getStartedConnect }}
        secondary={{ label: t('hero.ctaSecondary'), href: '/textile-marketplace' }}
        aside={<MarketplaceHeroMock />}
      />

      <section className="bg-[var(--cr-cream)] py-16 sm:py-20 lg:py-24">
        <Container>
          <SectionHeading
            eyebrow={t('intro.eyebrow')}
            title={t('intro.title')}
            sub={t('intro.sub')}
          />
          <ul className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2">
            {['p1', 'p2', 'p3', 'p4'].map((id) => (
              <li
                key={id}
                className="rounded-xl border border-[var(--cr-neutral-200)] bg-white p-5 text-[1rem] leading-relaxed text-[var(--cr-neutral-700)]"
              >
                {t(`intro.points.${id}`)}
              </li>
            ))}
          </ul>
          <p className="mt-8 text-[1rem] text-[var(--cr-neutral-700)]">
            {t('intro.lead')}{' '}
            <Link
              href="/textile-marketplace"
              className="font-semibold text-[var(--cr-indigo-700)] underline underline-offset-2"
            >
              {t('intro.cta')}
            </Link>
          </p>
        </Container>
      </section>

      <section className="bg-white py-16 sm:py-20 lg:py-24">
        <Container>
          <SectionHeading
            id="fabric-suppliers-faq"
            eyebrow={tFaq('eyebrow')}
            title={tFaq('title')}
          />
          <div className="mt-11">
            <FaqAccordion
              items={MARKETPLACE_FAQ_ITEMS.map((id) => ({
                q: tFaq(`items.${id}.q`),
                a: tFaq(`items.${id}.a`),
              }))}
            />
          </div>
        </Container>
      </section>

      <FinalCta signupIntent="connect" />
    </>
  );
}
