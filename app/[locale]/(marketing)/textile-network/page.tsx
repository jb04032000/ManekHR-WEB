import type { Metadata } from 'next';
import { marketingAlternates } from '@/lib/marketing/seo';
import { Link } from '@/i18n/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import {
  AUTH,
  NETWORK_CONNECTS,
  NETWORK_FAQ_ITEMS,
  NETWORK_FEATURES,
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
 * `/textile-network` - public, SEO-indexable landing targeting the "textile
 * network / surat textile networking" search intent. Answer-first: the opening
 * directly answers "what is a textile network / how to network in the Surat
 * textile trade" and positions ManekHR. Honest copy only (no invented metrics).
 * Mirrors the /textile-services page template (generateMetadata + breadcrumb +
 * FAQPage JSON-LD from English copy). ALSO emits an ItemList of WHO the network
 * connects. Internal links to /connect and /. Cross-module links: content.ts
 * (NETWORK_* arrays + AUTH.getStarted + footer `network` link), schema.ts
 * (breadcrumb + faqPage builders), marketing.pages.network.* messages, ICONS.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('marketing.pages.network.meta');
  return {
    title: t('title'),
    description: t('description'),
    alternates: marketingAlternates('/textile-network', locale),
    openGraph: { title: t('title'), description: t('description'), url: '/textile-network' },
  };
}

export default async function TextileNetworkPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('marketing.pages.network');

  // English copy for the FAQPage schema (JSON-LD is never localized). Built the
  // same way the home + /textile-services pages build their faqEn arrays.
  const tFaqEn = await getTranslations({ locale: 'en', namespace: 'marketing.pages.network.faq' });
  const faqEn = NETWORK_FAQ_ITEMS.map((id) => ({
    q: tFaqEn(`items.${id}.q`),
    a: tFaqEn(`items.${id}.a`),
  }));

  // ItemList of WHO the network connects (English; schema is never localized).
  // Names the trade roles so an answer engine can read what the network links.
  const tConnectsEn = await getTranslations({
    locale: 'en',
    namespace: 'marketing.pages.network.connects',
  });
  const connectsItemList = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Who the ManekHR textile network connects',
    itemListElement: NETWORK_CONNECTS.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: tConnectsEn(`items.${item.id}.title`),
    })),
  };

  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'Home', path: '/' },
          { name: 'ManekHR Connect', path: '/connect' },
          { name: 'Textile Network', path: '/textile-network' },
        ])}
      />
      <JsonLd data={faqPageJsonLd(faqEn)} />
      <JsonLd data={connectsItemList} />

      <PageHero
        badge={{ label: t('hero.badge'), tone: 'connect' }}
        title={t('hero.title')}
        sub={t('hero.sub')}
        primary={{ label: t('hero.ctaPrimary'), href: AUTH.getStartedConnect }}
        secondary={{ label: t('hero.ctaSecondary'), href: '/connect' }}
      />

      {/* Answer-first paragraph: what a textile network is + how to network in
          the Surat textile trade, with ManekHR positioned as the answer. Kept
          self-contained so an answer engine can quote it. */}
      <section className="bg-[var(--cr-cream)] py-16 sm:py-20 lg:py-24">
        <Container>
          <div className="max-w-3xl">
            <SectionHeading title={t('answer.heading')} />
            <p className="mt-5 text-[1.12rem] leading-relaxed text-pretty text-[var(--cr-neutral-700)]">
              {t('answer.body')}
            </p>
            {/* Internal links to the Connect product page + the home page. Same
                pattern as the /textile-services "browseLead" link block: plain
                text key + an explicit Link, so locale files stay free of rich
                placeholder syntax. */}
            <p className="mt-4 text-[1.02rem] leading-relaxed text-pretty text-[var(--cr-neutral-600)]">
              {t('answer.lead')}{' '}
              <Link
                href="/connect"
                className="font-semibold text-[var(--cr-indigo-700)] underline underline-offset-2"
              >
                {t('answer.connectLink')}
              </Link>{' '}
              <Link
                href="/"
                className="font-semibold text-[var(--cr-indigo-700)] underline underline-offset-2"
              >
                {t('answer.homeLink')}
              </Link>
            </p>
          </div>
        </Container>
      </section>

      {/* WHO the network connects - the visible list backed by the ItemList
          JSON-LD above. */}
      <section className="bg-white py-16 sm:py-20 lg:py-24">
        <Container>
          <SectionHeading
            eyebrow={t('connects.eyebrow')}
            title={t('connects.title')}
            sub={t('connects.sub')}
          />
          <div className="mt-12 grid grid-cols-1 gap-x-10 gap-y-9 sm:grid-cols-2 lg:grid-cols-3">
            {NETWORK_CONNECTS.map((item) => {
              const Icon = ICONS[item.icon];
              return (
                <div key={item.id}>
                  <span className="grid h-11 w-11 place-items-center rounded-[12px] bg-[var(--cr-indigo-50)] text-[var(--cr-indigo-700)]">
                    {Icon ? <Icon className="h-[21px] w-[21px]" /> : null}
                  </span>
                  <h3 className="pt-4 text-[1.12rem]">{t(`connects.items.${item.id}.title`)}</h3>
                  <p className="pt-2 text-[0.96rem] leading-relaxed text-[var(--cr-neutral-600)]">
                    {t(`connects.items.${item.id}.body`)}
                  </p>
                </div>
              );
            })}
          </div>
        </Container>
      </section>

      {/* How you network on ManekHR - three honest steps. */}
      <section className="bg-[var(--cr-cream)] py-16 sm:py-20 lg:py-24">
        <Container>
          <SectionHeading
            eyebrow={t('features.eyebrow')}
            title={t('features.title')}
            sub={t('features.sub')}
          />
          <div className="mt-12 grid grid-cols-1 gap-5 md:grid-cols-3">
            {NETWORK_FEATURES.map((item, index) => {
              const Icon = ICONS[item.icon];
              return (
                <div
                  key={item.id}
                  className="rounded-[16px] border border-[var(--cr-neutral-200)] bg-white p-7"
                >
                  <span className="mkt-mono text-[0.8rem] font-semibold tracking-[0.06em] text-[var(--cr-gold-700)]">
                    {`0${index + 1}`}
                  </span>
                  <span className="mt-3 grid h-11 w-11 place-items-center rounded-[12px] bg-[var(--cr-indigo-50)] text-[var(--cr-indigo-700)]">
                    {Icon ? <Icon className="h-[21px] w-[21px]" /> : null}
                  </span>
                  <h3 className="pt-4 text-[1.18rem]">{t(`features.items.${item.id}.title`)}</h3>
                  <p className="pt-2 text-[0.96rem] leading-relaxed text-[var(--cr-neutral-600)]">
                    {t(`features.items.${item.id}.body`)}
                  </p>
                </div>
              );
            })}
          </div>
        </Container>
      </section>

      {/* FAQ - "how do I network in Surat", "is it free", "who can join",
          mirrored into the FAQPage JSON-LD (faqEn above). */}
      <section className="bg-white py-16 sm:py-20 lg:py-24">
        <Container>
          <SectionHeading id="network-faq" eyebrow={t('faq.eyebrow')} title={t('faq.title')} />
          <div className="mt-11">
            <FaqAccordion
              items={NETWORK_FAQ_ITEMS.map((id) => ({
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
