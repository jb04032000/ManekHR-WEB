import type { Metadata } from 'next';
import { Link } from '@/i18n/navigation';
import AntdProvider from '@/components/AntdProvider';
import { marketingAlternates } from '@/lib/marketing/seo';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AUTH, PRICING_FAQ_ITEMS } from '@/components/marketing/content';
import { ErpPricingTable, type ErpPlanView } from '@/components/marketing/ErpPricingTable';
import { selectPublicErpPlans } from '@/components/marketing/erpPlans';
import { CheckIcon } from '@/components/marketing/icons';
import { JsonLd } from '@/components/marketing/JsonLd';
import { PageHero } from '@/components/marketing/PageHero';
import { PricingCard } from '@/components/marketing/PricingCard';
import { breadcrumbJsonLd, erpPricingJsonLd, faqPageJsonLd } from '@/components/marketing/schema';
import { FaqBlock } from '@/components/marketing/sections/FaqBlock';
import { FinalCta } from '@/components/marketing/sections/FinalCta';
import { Container } from '@/components/marketing/ui/Container';
import { MarketingButton } from '@/components/marketing/ui/MarketingButton';
import { SectionHeading } from '@/components/marketing/ui/SectionHeading';
import { getPlans, getTiers, getTrialBannerConfig } from '@/lib/actions';
import { monthlyInstallment } from '@/lib/pricing';

/**
 * Unified public pricing page (/pricing) - the site's main "Pricing" link.
 *
 * Sells BOTH products on one page (owner pick, 2026-06-26):
 *  1. ManekHR ERP - the real paid plans (Free/Starter/Growth/Business), rendered
 *     DYNAMICALLY from the catalogue via the shared ErpPricingTable, led by a
 *     prominent 45-day free-trial highlight (trial length is data-driven from the
 *     configured trial plan via getTrialBannerConfig().days).
 *  2. (Connect section removed 2026-07-04 with the Connect product.)
 *
 * Plus the supporting detail a complete pricing page needs: trial highlight,
 * team-size recommender (inside ErpPricingTable), GST clarity (on the cards),
 * a trust/assurances strip, a custom/contact block, and
 * an FAQ (with FAQPage JSON-LD for answer engines).
 *
 * Cross-module links:
 *  - Plans + trial: lib/actions getPlans / getTrialBannerConfig (Public BE
 *    endpoints). Plan filtering uses the SHARED selectPublicErpPlans (also used by
 *    app/(marketing)/erp/pricing/page.tsx) so the two surfaces never drift.
 *  - ERP plan cards + recommender: components/marketing/ErpPricingTable (reads the
 *    marketing.pages.erpPricing namespace, so the card copy is shared, not dup'd).

 *  - loading.tsx in this folder should mirror this layout (added alongside).
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
  const t = await getTranslations('marketing.pages.pricing.meta');
  const title = t('title');
  const description = t('description');
  return {
    title,
    description,
    alternates: marketingAlternates('/pricing', locale),
    openGraph: { type: 'website', title, description, url: '/pricing', siteName: 'ManekHR' },
    twitter: { card: 'summary_large_image', title, description },
  };
}

export default async function PricingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('marketing.pages.pricing');
  // ERP card copy + the Bill & Accounts / Custom blocks live in the shared ERP
  // pricing namespace (reused, not duplicated).
  const te = await getTranslations('marketing.pages.erpPricing');

  // English FAQ copy for the FAQPage JSON-LD (schema is never localized).
  const tFaqEn = await getTranslations({
    locale: 'en',
    namespace: 'marketing.pages.pricing.faq',
  });
  const faqEn = PRICING_FAQ_ITEMS.map((id) => ({
    q: tFaqEn(`items.${id}.q`),
    a: tFaqEn(`items.${id}.a`),
  }));

  // Fail soft: a plans/banner hiccup must not crash the marketing page. An empty
  // list renders the friendly "pricing unavailable" fallback; the trial highlight
  // simply hides when no trial is configured (days <= 0) or it's disabled.
  let erpPlans: ErpPlanView[] = [];
  let trial = { enabled: false, days: 0 };
  try {
    // Tiers drive the card order (admin displayOrder); shared with /erp/pricing
    // via selectPublicErpPlans. Fail-soft: a tiers hiccup falls back to the
    // selector's static ordering, never blanks the page.
    const [plans, tiers, banner] = await Promise.all([
      getPlans(),
      getTiers().catch(() => []),
      getTrialBannerConfig(),
    ]);
    erpPlans = selectPublicErpPlans(plans ?? [], tiers ?? []);
    trial = { enabled: banner.enabled, days: banner.days };
  } catch {
    erpPlans = [];
  }
  const showTrial = trial.enabled && trial.days > 0;

  // Machine-readable pricing (SoftwareApplication + AggregateOffer) so search /
  // answer / generative engines can quote the REAL plan prices. Built from the
  // same live plans the cards render, using the SAME per-month figure as the card
  // headline (installment of the yearly term; 0 = Free). Name = capitalized tier
  // (English; schema is never localized). Empty when the fetch failed -> no schema.
  const offerPlans = erpPlans.map((p) => ({
    name: p.tier.charAt(0).toUpperCase() + p.tier.slice(1),
    monthlyPrice:
      p.yearlyPrice <= 0
        ? 0
        : p.installmentsEnabled && p.installmentMonths > 0
          ? monthlyInstallment(p.yearlyPrice, p.installmentMonths)
          : p.yearlyPrice,
  }));
  const pricingSchema = erpPricingJsonLd(offerPlans);

  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'Home', path: '/' },
          { name: 'Pricing', path: '/pricing' },
        ])}
      />
      <JsonLd data={faqPageJsonLd(faqEn)} />
      {/* Real pricing as structured data (only when plans loaded; never fake). */}
      {pricingSchema ? <JsonLd data={pricingSchema} /> : null}

      <PageHero eyebrow={t('hero.eyebrow')} title={t('hero.title')} sub={t('hero.sub')} />

      {/* ManekHR ERP plans (the monetized tiers) */}
      <section className="bg-[var(--cr-cream)] py-16 sm:py-20 lg:py-24">
        <Container>
          <SectionHeading
            align="center"
            eyebrow={t('erpHeading.eyebrow')}
            title={t('erpHeading.title')}
            sub={t('erpHeading.sub')}
          />

          {/* Prominent 45-day free-trial highlight - the day count is data-driven
              (configured trial plan's length). Hidden when no trial / disabled. */}
          {showTrial ? (
            <div className="mx-auto mt-10 max-w-3xl overflow-hidden rounded-[20px] border-[1.5px] border-[var(--cr-gold-400)] bg-[var(--cr-gold-100)]">
              <div className="flex flex-col gap-6 p-7 sm:flex-row sm:items-center sm:justify-between sm:p-9">
                <div className="max-w-xl">
                  <span className="mkt-mono inline-block rounded-full bg-[var(--cr-gold-500)] px-3 py-1 text-[0.62rem] font-semibold tracking-[0.08em] text-[var(--cr-indigo-800)] uppercase">
                    {t('trial.eyebrow')}
                  </span>
                  <p className="pt-3 font-[family-name:var(--font-mkt-display)] text-[2.1rem] leading-none font-medium text-[var(--cr-charcoal)]">
                    {t('trial.title', { days: trial.days })}
                  </p>
                  <p className="pt-3 text-[0.95rem] leading-relaxed text-[var(--cr-neutral-700)]">
                    {t('trial.sub', { days: trial.days })}
                  </p>
                  <ul className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-x-6">
                    {(['b1', 'b2', 'b3'] as const).map((b) => (
                      <li
                        key={b}
                        className="flex items-center gap-2 text-[0.9rem] font-medium text-[var(--cr-neutral-800)]"
                      >
                        <CheckIcon className="h-4 w-4 shrink-0 text-[var(--cr-gold-700)]" />
                        <span>{t(`trial.${b}`)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="shrink-0">
                  <MarketingButton href={AUTH.getStartedErp} variant="solid-indigo" size="lg">
                    {t('trial.cta')}
                  </MarketingButton>
                  <p className="pt-2 text-center text-[0.78rem] text-[var(--cr-neutral-600)]">
                    {t('trial.noCard')}
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          <div className="mt-10">
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
                <h2 className="text-[1.4rem]">{te('unavailable.heading')}</h2>
                <p className="mx-auto mt-2 max-w-md text-[0.95rem] leading-relaxed text-[var(--cr-neutral-600)]">
                  {te('unavailable.body')}
                </p>
                <div className="mt-6 flex justify-center">
                  <Link href="/contact" className="mkt-btn mkt-btn--primary">
                    {te('unavailable.cta')}
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* Bill & Accounts - coming soon. Not selectable, not priced, no CTA
              (reuses the shared ERP pricing copy). */}
          <div className="mx-auto mt-12 max-w-3xl rounded-[16px] border border-dashed border-[var(--cr-neutral-300)] bg-[var(--cr-neutral-50)] p-6 sm:p-7">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-[1.2rem]">{te('billAccounts.name')}</h2>
              <span className="mkt-mono rounded-full bg-[var(--cr-indigo-50)] px-2.5 py-1 text-[0.62rem] font-semibold tracking-[0.08em] text-[var(--cr-indigo-700)] uppercase">
                {te('billAccounts.badge')}
              </span>
            </div>
            <p className="mt-2 text-[0.95rem] leading-relaxed text-[var(--cr-neutral-600)]">
              {te('billAccounts.body')}
            </p>
          </div>
        </Container>
      </section>

      {/* Assurances strip (trust + buying reassurance) */}
      <section className="border-y border-[var(--cr-neutral-200)] bg-white py-10">
        <Container>
          <ul className="mx-auto grid max-w-4xl grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {(['a1', 'a2', 'a3', 'a4'] as const).map((a) => (
              <li
                key={a}
                className="flex items-start gap-2.5 text-[0.92rem] leading-snug text-[var(--cr-neutral-700)]"
              >
                <CheckIcon className="mt-[3px] h-4 w-4 shrink-0 text-[var(--cr-indigo-600)]" />
                <span>{t(`assurances.${a}`)}</span>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      {/* Custom / contact-us (larger teams) */}
      <section className="bg-white py-16 sm:py-20">
        <Container>
          <div className="mx-auto max-w-3xl rounded-[20px] border border-[var(--cr-neutral-200)] bg-[var(--cr-cream)] p-8 text-center sm:p-10">
            <SectionHeading
              align="center"
              eyebrow={te('custom.eyebrow')}
              title={te('custom.heading')}
              sub={te('custom.body')}
            />
            <div className="mt-7 flex justify-center">
              <Link href="/contact" className="mkt-btn mkt-btn--primary mkt-btn--lg">
                {te('custom.cta')}
              </Link>
            </div>
          </div>
        </Container>
      </section>

      <FaqBlock page="pricing" ns="marketing.pages.pricing.faq" items={PRICING_FAQ_ITEMS} />

      <FinalCta page="pricing" />
    </>
  );
}
