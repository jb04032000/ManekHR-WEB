import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { CONNECT_FAQ_ITEMS } from '@/components/marketing/content';
import { JsonLd } from '@/components/marketing/JsonLd';
import { MobileStickyCta } from '@/components/marketing/MobileStickyCta';
import { ScrollProgress } from '@/components/marketing/ScrollProgress';
import { breadcrumbJsonLd, faqPageJsonLd, softwareAppJsonLd } from '@/components/marketing/schema';
import { BoostExplainer } from '@/components/marketing/sections/BoostExplainer';
import { ConnectBuiltFor } from '@/components/marketing/sections/ConnectBuiltFor';
import { ConnectHero } from '@/components/marketing/sections/ConnectHero';
import { ConnectInstitutes } from '@/components/marketing/sections/ConnectInstitutes';
import { ConnectModules } from '@/components/marketing/sections/ConnectModules';
import { ConnectServices } from '@/components/marketing/sections/ConnectServices';
import { ConnectSteps } from '@/components/marketing/sections/ConnectSteps';
import { ConnectTrust } from '@/components/marketing/sections/ConnectTrust';
import { CtaBand } from '@/components/marketing/sections/CtaBand';
import { FaqBlock } from '@/components/marketing/sections/FaqBlock';
import { FinalCta } from '@/components/marketing/sections/FinalCta';
import { getConnectEntryState } from '@/features/connect/profile.actions';
import { marketingAlternates } from '@/lib/marketing/seo';

// This marketing landing reads the auth cookie to redirect signed-in members to
// the app, so it cannot be statically prerendered (owner decision: keep dynamic).
// It still gets locale routing + SEO; only this page stays SSR among the
// otherwise-static marketing surface.
export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations('marketing.pages.connect.meta');
  const title = t('title');
  const description = t('description');
  return {
    title,
    description,
    keywords: [
      'textile B2B marketplace India',
      'online textile market',
      'saree wholesale suppliers',
      'textile RFQ quotes',
      'free online store for textiles',
      'textile jobs',
      'karigar work',
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
    alternates: marketingAlternates('/connect', locale),
    openGraph: { type: 'website', title, description, url: '/connect', siteName: 'ManekHR' },
    twitter: { card: 'summary_large_image', title, description },
  };
}

export default async function ConnectPage() {
  // A signed-in Connect member skips the marketing pitch — straight to the app.
  // Only run the AUTHENTICATED entry check when the visitor actually has an auth
  // cookie. An anonymous visitor can never be redirected to the feed, so skipping
  // the call avoids an expected-401 console.error from the shared server-client
  // on every public hit (including Next.js prefetch of this route from /).
  const cookieStore = await cookies();
  const maybeSignedIn =
    cookieStore.has('z360_access_token') || cookieStore.has('z360_refresh_token');
  if (maybeSignedIn) {
    const entry = await getConnectEntryState();
    if (entry.ok && entry.data.connectEnabled) redirect('/connect/feed');
  }

  // English copy for the schema (JSON-LD is never localized).
  const tMetaEn = await getTranslations({
    locale: 'en',
    namespace: 'marketing.pages.connect.meta',
  });
  const tFaqEn = await getTranslations({ locale: 'en', namespace: 'marketing.pages.connect.faq' });
  const faqEn = CONNECT_FAQ_ITEMS.map((id) => ({
    q: tFaqEn(`items.${id}.q`),
    a: tFaqEn(`items.${id}.a`),
  }));

  return (
    <>
      <ScrollProgress />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'Home', path: '/' },
          { name: 'ManekHR Connect', path: '/connect' },
        ])}
      />
      <JsonLd
        data={softwareAppJsonLd({
          name: 'ManekHR Connect',
          path: '/connect',
          description: tMetaEn('description'),
        })}
      />
      <JsonLd data={faqPageJsonLd(faqEn)} />

      <ConnectHero />
      <ConnectSteps />
      <ConnectModules />
      <CtaBand band="shop" />
      {/* Trust lands before any monetization talk: ConnectTrust now sits above
          BoostExplainer so visitors see who they are dealing with first. */}
      <ConnectTrust />
      <BoostExplainer />
      <ConnectBuiltFor />
      {/* Institutes + students band (now-live feature) feeds the hire CTA below. */}
      <ConnectInstitutes />
      {/* Services / experts directory band: kept on cream so the run alternates
          BuiltFor(cream) -> Institutes(white) -> Services(cream) before the hire CTA. */}
      <ConnectServices />
      <CtaBand band="hire" />
      <FaqBlock
        page="connect"
        ns="marketing.pages.connect.faq"
        titleKey="title"
        items={CONNECT_FAQ_ITEMS}
      />
      <FinalCta page="connect" />
      <MobileStickyCta page="connect" />
    </>
  );
}
