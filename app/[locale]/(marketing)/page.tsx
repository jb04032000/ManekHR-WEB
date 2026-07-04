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
// "ManekHR" brand query resolves to us) and names the core job (staff + salary)
// + market (diamond-polishing units, Surat). Keep consistent with the canonical
// positioning used across the marketing site.
const TITLE = 'ManekHR - Staff & salary management for diamond-polishing units';
// Names the product plainly: staff directory, attendance, and payroll for
// diamond-polishing unit owners in Surat.
const DESCRIPTION =
  'Manage your karigars and staff, track attendance, and run payroll — all in one place, in your own language. Built for diamond-polishing units in Surat.';

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
      'diamond polishing staff management',
      'karigar attendance software',
      'diamond unit payroll software Surat',
      'staff management software India',
      'salary software for diamond units',
      'attendance tracking Surat',
      'karigar salary management',
      'HR software for diamond polishing units',
      'roles and permissions software',
      'staff directory app',
      'payroll software Gujarat',
      'diamond industry HR software',
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
          IndustryStrip is honest market context (Surat's diamond-polishing
          industry, NOT ManekHR's own metrics) right under the fold. */}
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
