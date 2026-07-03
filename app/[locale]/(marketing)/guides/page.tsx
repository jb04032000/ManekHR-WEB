import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { GUIDES } from '@/components/marketing/guides';
import { marketingAlternates } from '@/lib/marketing/seo';
import { JsonLd } from '@/components/marketing/JsonLd';
import { PageHero } from '@/components/marketing/PageHero';
import { breadcrumbJsonLd, itemListJsonLd } from '@/components/marketing/schema';
import { FinalCta } from '@/components/marketing/sections/FinalCta';
import { Container } from '@/components/marketing/ui/Container';

// Guides index. English content (informational/AEO queries are searched in
// English); the page chrome (navbar/footer) still localizes via the layout.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const alternates = marketingAlternates('/guides', locale);
  return {
    title: 'Guides — embroidery, machines & fabric | ManekHR',
    description:
      'Practical, no-jargon guides for the textile trade: an embroidery machine buying guide, an embroidery terms glossary, and a saree fabric guide.',
    alternates,
    openGraph: {
      title: 'Guides — embroidery, machines & fabric',
      description: 'Practical guides for the textile trade.',
      url: alternates.canonical,
    },
  };
}

export default function GuidesIndexPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'Home', path: '/' },
          { name: 'Guides', path: '/guides' },
        ])}
      />
      <JsonLd
        data={itemListJsonLd({
          name: 'ManekHR guides',
          path: '/guides',
          items: GUIDES.map((g) => g.title),
        })}
      />

      <PageHero
        badge={{ label: 'Guides', tone: 'connect' }}
        title="Guides for the textile trade."
        sub="Practical, no-jargon guides on embroidery machines, trade terms, and fabric — written for the people who run the trade."
      />

      <section className="bg-[var(--cr-cream)] py-16 sm:py-20 lg:py-24">
        <Container>
          <ul className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {GUIDES.map((g) => (
              <li key={g.slug}>
                <Link
                  href={`/guides/${g.slug}`}
                  className="flex h-full flex-col rounded-2xl border border-[var(--cr-neutral-200)] bg-white p-6 transition-colors hover:border-[var(--cr-indigo-300)]"
                >
                  <span className="mkt-mono text-[0.7rem] font-semibold tracking-[0.1em] text-[var(--cr-indigo-700)] uppercase">
                    {g.badge}
                  </span>
                  <h2 className="pt-3 text-[1.2rem] font-semibold text-[var(--cr-neutral-900)]">
                    {g.title}
                  </h2>
                  <p className="pt-2 text-[0.98rem] leading-relaxed text-[var(--cr-neutral-600)]">
                    {g.description}
                  </p>
                  <span className="pt-4 text-[0.92rem] font-semibold text-[var(--cr-indigo-700)]">
                    Read guide →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      <FinalCta />
    </>
  );
}
