import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { LANDING_FAQ_ITEMS } from '@/components/marketing/content';
import { JsonLd } from '@/components/marketing/JsonLd';
import { MobileStickyCta } from '@/components/marketing/MobileStickyCta';
import { faqPageJsonLd, homeJsonLd } from '@/components/marketing/schema';
import { marketingAlternates } from '@/lib/marketing/seo';
import { AudienceStrip } from '@/components/marketing/sections/AudienceStrip';
import { ErpCompanion } from '@/components/marketing/sections/ErpCompanion';
import { FaqBlock } from '@/components/marketing/sections/FaqBlock';
import { FinalCta } from '@/components/marketing/sections/FinalCta';
import { Hero } from '@/components/marketing/sections/Hero';
import { IndustryStrip } from '@/components/marketing/sections/IndustryStrip';
import { LandingSteps } from '@/components/marketing/sections/LandingSteps';
import { PricingStory } from '@/components/marketing/sections/PricingStory';
import { ProductTour } from '@/components/marketing/sections/ProductTour';
import { TrustWedge } from '@/components/marketing/sections/TrustWedge';

// Brand-led AND keyword-aware home title: leads with the brand entity (so the
// "ManekHR" brand query resolves to us) and names the three core jobs + market.
// Keep consistent with the canonical positioning used across the marketing site.
const TITLE = 'ManekHR - Textile B2B network, marketplace & jobs for India';
// Names BOTH products: Connect's jobs first (the page's story), then a short
// ERP clause so brand queries from factory/shop owners see their product too.
const DESCRIPTION =
  'Open a free online shop, post your work, get quotes, and hire skilled people, in your own language. Plus ManekHR ERP for team, billing, and machines.';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const alternates = marketingAlternates('/', locale);
  return {
    title: { absolute: TITLE },
    description: DESCRIPTION,
    keywords: [
      'textile B2B marketplace India',
      'online textile market',
      'saree wholesale suppliers',
      'textile RFQ quotes',
      'textile jobs',
      'karigar work',
      'free online store for textiles',
      'textile ERP',
      // Institutes feature now live: course + training-institute discovery terms.
      'embroidery course',
      'textile training institute',
      'learn aari zardosi',
      'embroidery classes Surat',
      // Services/experts directory + broker (dalal) introductions now live: terms
      // a service-seeker or someone looking for an introduction would search.
      'textile services directory',
      'textile consultant',
      'embroidery machine repair',
      'dyeing job work',
      'fabric transport',
      'textile contractor',
      'dalal',
      'broker introductions',
    ],
    alternates,
    openGraph: {
      type: 'website',
      url: alternates.canonical,
      siteName: 'ManekHR',
      title: TITLE,
      description: DESCRIPTION,
    },
    twitter: {
      card: 'summary_large_image',
      title: TITLE,
      description: DESCRIPTION,
    },
  };
}

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  // FAQPage JSON-LD mirrors the visible FAQ; forced to English (schema is never
  // localized, and the en build's visible text matches these strings).
  const tFaqEn = await getTranslations({ locale: 'en', namespace: 'marketing.faq' });
  const faqEn = LANDING_FAQ_ITEMS.map((id) => ({
    q: tFaqEn(`items.${id}.q`),
    a: tFaqEn(`items.${id}.a`),
  }));

  return (
    <>
      <JsonLd data={homeJsonLd()} />
      <JsonLd data={faqPageJsonLd(faqEn)} />
      {/* Scene order (redesign 2026-06-18): one anchored product story instead of
          10 disparate blocks. ProductTour MERGES the old ThreePillars +
          ModuleShowcase (which told "what's inside" twice) into a single sticky
          tour. Background rhythm alternates and keeps the two dark bands
          (TrustWedge, FinalCta) far apart: Hero(tinted) -> Industry(cream) ->
          Tour(white) -> Steps(cream) -> Trust(dark) -> Audience(cream) ->
          Pricing(white) -> ERP(cream) -> FAQ(white) -> FinalCta(dark).
          IndustryStrip is honest market context (India textile-trade scale,
          NOT ManekHR's own metrics) right under the fold. */}
      <Hero />
      <IndustryStrip />
      <ProductTour />
      <LandingSteps />
      <TrustWedge />
      <AudienceStrip />
      <PricingStory />
      <ErpCompanion />
      <FaqBlock page="home" ns="marketing.faq" titleKey="headline" items={LANDING_FAQ_ITEMS} />
      <FinalCta page="home" />
      <MobileStickyCta page="home" />
    </>
  );
}
