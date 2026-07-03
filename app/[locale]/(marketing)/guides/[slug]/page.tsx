import type { Metadata } from 'next';
import { Link } from '@/i18n/navigation';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { GUIDES, getGuide } from '@/components/marketing/guides';
import { JsonLd } from '@/components/marketing/JsonLd';
import { PageHero } from '@/components/marketing/PageHero';
import { breadcrumbJsonLd, faqPageJsonLd } from '@/components/marketing/schema';
import { marketingAlternates } from '@/lib/marketing/seo';
import { FaqAccordion } from '@/components/marketing/sections/FaqAccordion';
import { FinalCta } from '@/components/marketing/sections/FinalCta';
import { Container } from '@/components/marketing/ui/Container';
import { env } from '@/lib/env';

interface PageProps {
  params: Promise<{ locale: string; slug: string }>;
}

export function generateStaticParams() {
  return GUIDES.map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const guide = getGuide(slug);
  if (!guide) return {};
  return {
    title: guide.metaTitle,
    description: guide.description,
    alternates: marketingAlternates(`/guides/${guide.slug}`, locale),
    openGraph: {
      title: guide.metaTitle,
      description: guide.description,
      url: `/guides/${guide.slug}`,
    },
  };
}

export default async function GuideArticlePage({ params }: PageProps) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const guide = getGuide(slug);
  if (!guide) notFound();

  const url = `${env.appUrl}/guides/${guide.slug}`;
  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: guide.title,
    description: guide.description,
    inLanguage: 'en',
    dateModified: guide.updated,
    mainEntityOfPage: url,
    author: { '@type': 'Organization', name: 'ManekHR' },
    publisher: { '@id': `${env.appUrl}/#organization` },
  };

  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'Home', path: '/' },
          { name: 'Guides', path: '/guides' },
          { name: guide.title, path: `/guides/${guide.slug}` },
        ])}
      />
      <JsonLd data={articleJsonLd} />
      <JsonLd data={faqPageJsonLd(guide.faq.map((f) => ({ q: f.q, a: f.a })))} />

      <PageHero
        badge={{ label: guide.badge, tone: 'connect' }}
        title={guide.title}
        sub={guide.intro}
        primary={{ label: guide.cta.label, href: guide.cta.href }}
      />

      <article className="bg-white py-14 sm:py-18 lg:py-20">
        <Container>
          <div className="mx-auto max-w-[72ch]">
            {guide.sections.map((s) => (
              <section key={s.heading} className="mt-10 first:mt-0">
                <h2 className="text-[1.5rem] font-semibold text-[var(--cr-neutral-900)]">
                  {s.heading}
                </h2>
                {s.body.map((p, i) => (
                  <p
                    key={i}
                    className="mt-3 text-[1.05rem] leading-relaxed text-[var(--cr-neutral-700)]"
                  >
                    {p}
                  </p>
                ))}
              </section>
            ))}

            <section className="mt-14">
              <h2 className="text-[1.5rem] font-semibold text-[var(--cr-neutral-900)]">
                Frequently asked questions
              </h2>
              <div className="mt-6">
                <FaqAccordion items={guide.faq.map((f) => ({ q: f.q, a: f.a }))} />
              </div>
            </section>

            <p className="mt-12 text-[1.05rem] text-[var(--cr-neutral-700)]">
              <Link
                href={guide.cta.href}
                className="font-semibold text-[var(--cr-indigo-700)] underline underline-offset-2"
              >
                {guide.cta.label}
              </Link>
            </p>
          </div>
        </Container>
      </article>

      <FinalCta />
    </>
  );
}
