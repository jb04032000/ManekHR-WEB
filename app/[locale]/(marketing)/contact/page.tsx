import type { Metadata } from 'next';
import { marketingAlternates } from '@/lib/marketing/seo';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { CONTACT_EMAIL, SOCIAL_LINKS } from '@/components/marketing/content';
import { ContactForm } from '@/components/marketing/ContactForm';
import { JsonLd } from '@/components/marketing/JsonLd';
import { PageHero } from '@/components/marketing/PageHero';
import { breadcrumbJsonLd } from '@/components/marketing/schema';
import { Container } from '@/components/marketing/ui/Container';
import { SectionHeading } from '@/components/marketing/ui/SectionHeading';

// Empty when NEXT_PUBLIC_SUPPORT_PHONE is unset -> the WhatsApp method is hidden below.
const WHATSAPP_URL = SOCIAL_LINKS.find((s) => s.id === 'whatsapp')?.href ?? '';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('marketing.pages.contact.meta');
  return {
    title: t('title'),
    description: t('description'),
    alternates: marketingAlternates('/contact', locale),
    openGraph: { title: t('title'), description: t('description'), url: '/contact' },
  };
}

export default async function ContactPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('marketing.pages.contact');
  const methods = [
    { id: 'email', href: `mailto:${CONTACT_EMAIL}`, value: CONTACT_EMAIL },
    // WhatsApp option only appears when a number is configured (env.supportPhone).
    ...(WHATSAPP_URL
      ? [{ id: 'whatsapp', href: WHATSAPP_URL, value: t('methods.items.whatsapp.action') }]
      : []),
    { id: 'hours', href: null as string | null, value: null as string | null },
  ];

  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'Home', path: '/' },
          { name: 'Contact', path: '/contact' },
        ])}
      />
      <PageHero eyebrow={t('hero.eyebrow')} title={t('hero.title')} sub={t('hero.sub')} />

      <section className="bg-[var(--cr-cream)] py-16 sm:py-20 lg:py-24">
        <Container>
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-14">
            <div>
              <SectionHeading title={t('methods.heading')} />
              <div className="mt-7 flex flex-col gap-4">
                {methods.map((method) => (
                  <div
                    key={method.id}
                    className="rounded-2xl border border-[var(--cr-neutral-200)] bg-white p-5"
                  >
                    <p className="text-sm font-semibold text-[var(--cr-charcoal)]">
                      {t(`methods.items.${method.id}.label`)}
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-[var(--cr-neutral-600)]">
                      {t(`methods.items.${method.id}.desc`)}
                    </p>
                    {method.href && method.value ? (
                      <a
                        href={method.href}
                        className="mt-2 inline-block text-sm font-semibold text-[var(--cr-indigo-700)] transition-colors hover:text-[var(--cr-indigo-800)]"
                        {...(method.id === 'whatsapp'
                          ? { target: '_blank', rel: 'noopener noreferrer' }
                          : {})}
                      >
                        {method.value}
                      </a>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-[var(--cr-neutral-200)] bg-white p-7 sm:p-8">
              <h2 className="text-[1.45rem]">{t('form.heading')}</h2>
              <div className="mt-5">
                <ContactForm />
              </div>
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}
