import type { Metadata } from 'next';
import { Link } from '@/i18n/navigation';
import AntdProvider from '@/components/AntdProvider';
import { marketingAlternates } from '@/lib/marketing/seo';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ErpPricingTable, type ErpPlanView } from '@/components/marketing/ErpPricingTable';
// Shared public-ERP-plan selector (single source of truth, also used by the
// unified /pricing page) so the two pricing surfaces never drift.
import { selectPublicErpPlans } from '@/components/marketing/erpPlans';
import { JsonLd } from '@/components/marketing/JsonLd';
import { PageHero } from '@/components/marketing/PageHero';
import { breadcrumbJsonLd } from '@/components/marketing/schema';
import { FinalCta } from '@/components/marketing/sections/FinalCta';
import { Container } from '@/components/marketing/ui/Container';
import { SectionHeading } from '@/components/marketing/ui/SectionHeading';
import { TrialPromoBanner } from '@/components/subscription/TrialPromoBanner';
import { getPlans, getTiers, getTrialBannerConfig } from '@/lib/actions';

/**
 * Public ERP pricing page (/erp/pricing) - nested under the ERP product page.
 *
 * What it does: server-fetches the catalogue plans, keeps only the publicly
 * visible NON-custom ERP plans, and hands them to the ErpPricingTable client
 * child (toggle + headcount recommender + cards). Prices + staff caps are
 * data-driven from the plans; only curated feature copy is i18n.
 *
 * Cross-module links:
 *  - Plans: lib/actions getPlans -> /subscriptions/plans (Public endpoint).
 *    That endpoint returns ALL active plans (no visibility filter), so the
 *    public/custom/product filtering happens HERE. Keep the filter in sync with
 *    the seed (seed-default-tiers-and-plans.ts): Custom is isPubliclyVisible:
 *    false + isCustom: true and must never render.
 *  - Linked from app/(marketing)/erp/page.tsx (hero "See pricing" CTA).
 *  - loading.tsx in this folder mirrors this layout section-for-section.
 *
 * Prices are in RUPEES (not paise) per the seed. Free = 0.
 */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('marketing.pages.erpPricing.meta');
  const title = t('title');
  const description = t('description');
  return {
    title,
    description,
    alternates: marketingAlternates('/erp/pricing', locale),
    openGraph: {
      type: 'website',
      title,
      description,
      url: '/erp/pricing',
      siteName: 'ManekHR',
    },
    twitter: { card: 'summary_large_image', title, description },
  };
}

export default async function ErpPricingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('marketing.pages.erpPricing');

  // Fail soft: a plans-endpoint hiccup must not crash the marketing page. An
  // empty list renders the friendly "pricing unavailable, contact us" fallback.
  // The banner config fetches in parallel and is itself fail-soft (hides on any
  // error), so it never blocks or breaks this render.
  let erpPlans: ErpPlanView[] = [];
  let trialBanner = { enabled: false, headlineOverride: '', days: 0 };
  try {
    // Tiers drive the card order (admin displayOrder). Fail-soft: a tiers hiccup
    // falls back to selectPublicErpPlans' static ordering, never blanks the page.
    const [plans, tiers, banner] = await Promise.all([
      getPlans(),
      getTiers().catch(() => []),
      getTrialBannerConfig(),
    ]);
    erpPlans = selectPublicErpPlans(plans ?? [], tiers ?? []);
    trialBanner = banner;
  } catch {
    erpPlans = [];
  }

  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'Home', path: '/' },
          { name: 'ManekHR ERP', path: '/erp' },
          { name: 'Pricing', path: '/erp/pricing' },
        ])}
      />

      <PageHero
        badge={{ label: t('hero.badge'), tone: 'erp' }}
        title={t('hero.title')}
        sub={t('hero.sub')}
      />

      <section className="bg-[var(--cr-cream)] py-16 sm:py-20 lg:py-24">
        <Container>
          {/* Admin-controlled trial-promo banner, above the plan cards. Hidden
              when disabled / days<=0, so it never disturbs the layout. */}
          <TrialPromoBanner {...trialBanner} />

          {/* Local antd boundary: antd lives in the (app) group (out of the
              static-marketing bundle), so this dynamic page mounts its own
              AntdProvider to render the antd-based ErpPricingTable. */}
          {erpPlans.length > 0 ? (
            <AntdProvider>
              <ErpPricingTable plans={erpPlans} />
            </AntdProvider>
          ) : (
            // Graceful fallback when the plans fetch is empty / errored.
            <div className="mx-auto max-w-xl rounded-[16px] border border-[var(--cr-neutral-200)] bg-white p-8 text-center">
              <h2 className="text-[1.4rem]">{t('unavailable.heading')}</h2>
              <p className="mx-auto mt-2 max-w-md text-[0.95rem] leading-relaxed text-[var(--cr-neutral-600)]">
                {t('unavailable.body')}
              </p>
              <div className="mt-6 flex justify-center">
                <Link href="/contact" className="mkt-btn mkt-btn--primary">
                  {t('unavailable.cta')}
                </Link>
              </div>
            </div>
          )}

          {/* Bill & Accounts - coming soon. Visually distinct, NOT selectable,
              NOT priced, no CTA. */}
          <div className="mx-auto mt-12 max-w-3xl rounded-[16px] border border-dashed border-[var(--cr-neutral-300)] bg-[var(--cr-neutral-50)] p-6 sm:p-7">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-[1.2rem]">{t('billAccounts.name')}</h2>
              <span className="mkt-mono rounded-full bg-[var(--cr-indigo-50)] px-2.5 py-1 text-[0.62rem] font-semibold tracking-[0.08em] text-[var(--cr-indigo-700)] uppercase">
                {t('billAccounts.badge')}
              </span>
            </div>
            <p className="mt-2 text-[0.95rem] leading-relaxed text-[var(--cr-neutral-600)]">
              {t('billAccounts.body')}
            </p>
          </div>
        </Container>
      </section>

      {/* Custom / contact-us block. The Custom plan is NOT publicly listed (it
          never comes back in the fetched plans), so this is hand-authored. */}
      <section className="bg-white py-16 sm:py-20">
        <Container>
          <div className="mx-auto max-w-3xl rounded-[20px] border border-[var(--cr-neutral-200)] bg-[var(--cr-cream)] p-8 text-center sm:p-10">
            <SectionHeading
              align="center"
              eyebrow={t('custom.eyebrow')}
              title={t('custom.heading')}
              sub={t('custom.body')}
            />
            <div className="mt-7 flex justify-center">
              <Link href="/contact" className="mkt-btn mkt-btn--primary mkt-btn--lg">
                {t('custom.cta')}
              </Link>
            </div>
          </div>
        </Container>
      </section>

      <FinalCta page="erp" />
    </>
  );
}
