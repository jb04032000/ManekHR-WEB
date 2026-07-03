import type { Metadata } from 'next';
import { marketingAlternates } from '@/lib/marketing/seo';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { JsonLd } from '@/components/marketing/JsonLd';
import { PageHero } from '@/components/marketing/PageHero';
import { breadcrumbJsonLd } from '@/components/marketing/schema';
import { Container } from '@/components/marketing/ui/Container';
import { SectionHeading } from '@/components/marketing/ui/SectionHeading';
import { env } from '@/lib/env';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('marketing.pages.grievance.meta');
  return {
    title: t('title'),
    description: t('description'),
    alternates: marketingAlternates('/grievance', locale),
    openGraph: { title: t('title'), description: t('description'), url: '/grievance' },
  };
}

/**
 * DPDP grievance + account-deletion recovery surface (ACCOUNT-DELETION-AND-DPDP-PLAN.md
 * §8 / §12, DPDP Rule 13/14). Public + auth-free on purpose: a suspended/locked-out
 * user must be able to reach it. The deletion notices + the backend deletion messages
 * point here (web `DELETION_CONTACT_PATH` = `/grievance`; BE `env.accountDeletion.contactUrl`
 * default = `{WEB_APP_URL}/grievance`).
 *
 * The grievance mailbox is env-driven (`env.grievanceEmail` / NEXT_PUBLIC_GRIEVANCE_EMAIL):
 * NO email address is hardcoded. When it is set the page shows a mailto CTA; when it
 * is empty it routes users to in-app support instead, so the page is always usable.
 */
export default async function GrievancePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('marketing.pages.grievance');
  const email = env.grievanceEmail;

  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'Home', path: '/' },
          { name: 'Grievance', path: '/grievance' },
        ])}
      />
      <PageHero eyebrow={t('hero.eyebrow')} title={t('hero.title')} sub={t('hero.sub')} />

      <section className="bg-[var(--cr-cream)] py-16 sm:py-20 lg:py-24">
        <Container>
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-14">
            {/* Recover a deleted account (the 30-day window) */}
            <div className="rounded-2xl border border-[var(--cr-neutral-200)] bg-white p-7 sm:p-8">
              <SectionHeading title={t('recover.heading')} />
              <p className="mt-5 text-sm leading-relaxed text-[var(--cr-neutral-600)]">
                {t('recover.body')}
              </p>
            </div>

            {/* Grievance officer + contact (email is env-driven, never hardcoded) */}
            <div className="rounded-2xl border border-[var(--cr-neutral-200)] bg-white p-7 sm:p-8">
              <SectionHeading title={t('officer.heading')} />
              <dl className="mt-5 flex flex-col gap-4 text-sm">
                <div>
                  <dt className="font-semibold text-[var(--cr-charcoal)]">
                    {t('officer.roleLabel')}
                  </dt>
                  <dd className="mt-1 text-[var(--cr-neutral-600)]">{t('officer.role')}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-[var(--cr-charcoal)]">
                    {t('officer.slaLabel')}
                  </dt>
                  <dd className="mt-1 text-[var(--cr-neutral-600)]">{t('officer.sla')}</dd>
                </div>
              </dl>
              {email ? (
                <a
                  href={`mailto:${email}`}
                  className="mt-6 inline-block rounded-full bg-[var(--cr-indigo-700)] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--cr-indigo-800)]"
                >
                  {t('officer.emailCta')}
                </a>
              ) : (
                <p className="mt-6 text-sm leading-relaxed text-[var(--cr-neutral-600)]">
                  {t('officer.noEmail')}
                </p>
              )}
            </div>
          </div>

          {/* Out-of-band channel for users locked out of their account */}
          <div className="mt-10 rounded-2xl border border-[var(--cr-neutral-200)] bg-white p-7 sm:p-8 lg:mt-14">
            <SectionHeading title={t('lockedOut.heading')} />
            <p className="mt-5 text-sm leading-relaxed text-[var(--cr-neutral-600)]">
              {t('lockedOut.body')}
            </p>
          </div>
        </Container>
      </section>
    </>
  );
}
