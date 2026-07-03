import Image from 'next/image';
import { Link } from '@/i18n/navigation';
import { getTranslations } from 'next-intl/server';
import { CONTACT_EMAIL, FOOTER_COLUMNS, FOOTER_SOCIAL } from './content';
import { Container } from './ui/Container';

/** Coloured bullet on each product column's "Overview" link - Connect = indigo,
 *  ERP = gold. Keyed by link id (matches FOOTER_COLUMNS in content.ts). */
const DOT_COLOR: Record<string, string> = {
  connectOverview: 'var(--cr-indigo-600)',
  erpOverview: 'var(--cr-gold-500)',
};

export async function Footer() {
  const t = await getTranslations('marketing.footer');
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-[var(--cr-neutral-200)] bg-[var(--cr-cream)] pt-[70px] pb-10">
      <Container>
        <div className="grid gap-10 lg:grid-cols-[1.7fr_repeat(3,1fr)]">
          <div>
            {/* Two-color on-light brand lockup (navy "zari", gold "360"). Same
                asset as the marketing Navbar header; keep both in sync. */}
            <Image
              src="/manekhr-horizontal-on-light.svg"
              alt="ManekHR"
              width={160}
              height={80}
              className="h-10 w-auto"
            />
            <p className="max-w-[26ch] pt-4 text-[0.94rem] leading-relaxed text-[var(--cr-neutral-500)]">
              {t('tagline')}
            </p>
            <p className="mkt-mono inline-flex items-center gap-2 pt-4 text-[0.76rem] tracking-[0.04em] text-[var(--cr-neutral-500)]">
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: 'var(--cr-gold-500)' }}
                aria-hidden="true"
              />
              {t('madeIn')}
            </p>
          </div>

          {FOOTER_COLUMNS.map((column) => (
            <nav key={column.id} aria-label={t(`cols.${column.id}`)}>
              <h2 className="mkt-mono text-[0.72rem] font-semibold tracking-[0.12em] text-[var(--cr-neutral-500)] uppercase">
                {t(`cols.${column.id}`)}
              </h2>
              <ul className="mt-[17px] flex flex-col gap-3">
                {column.links.map((link) => (
                  <li key={link.id}>
                    <Link
                      href={link.href}
                      className="inline-flex items-center gap-2 text-[0.93rem] text-[var(--cr-neutral-600)] transition-colors hover:text-[var(--cr-indigo-700)]"
                    >
                      {DOT_COLOR[link.id] ? (
                        <span
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ background: DOT_COLOR[link.id] }}
                          aria-hidden="true"
                        />
                      ) : null}
                      {t(`links.${link.id}`)}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-2 border-t border-[var(--cr-neutral-200)] pt-7 text-[0.9rem] text-[var(--cr-neutral-500)] sm:flex-row sm:flex-wrap sm:gap-x-8">
          <span>
            {t('emailLabel')}:{' '}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="font-medium text-[var(--cr-indigo-700)] transition-colors hover:text-[var(--cr-indigo-800)]"
            >
              {CONTACT_EMAIL}
            </a>
          </span>
        </div>

        <p className="mt-4 max-w-[60ch] text-[0.85rem] leading-relaxed text-[var(--cr-neutral-500)]">
          {t('trust')}
        </p>

        <div className="mt-6 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          {/* Copyright + legal links. Re-added site-wide for AdSense + DPDP so the
              Privacy Policy is reachable from every signed-out page. Privacy/Terms
              point at the company-wide canonical pages (/privacy, /terms) served by
              the admin legal-pages CMS; Community Guidelines is the Connect UGC
              policy (/guidelines/connect) AdSense requires; Grievance is the DPDP
              grievance-officer page (/grievance). Keep these four in sync with the
              `marketing.footer.legal` keys in every locale. */}
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-5">
            <p className="text-[0.85rem] text-[var(--cr-neutral-500)]">{t('rights', { year })}</p>
            <ul className="flex flex-wrap items-center gap-4 text-[0.85rem]">
              <li>
                <Link
                  href="/privacy"
                  className="text-[var(--cr-neutral-500)] transition-colors hover:text-[var(--cr-indigo-700)]"
                >
                  {t('legal.privacy')}
                </Link>
              </li>
              <li>
                <Link
                  href="/terms"
                  className="text-[var(--cr-neutral-500)] transition-colors hover:text-[var(--cr-indigo-700)]"
                >
                  {t('legal.terms')}
                </Link>
              </li>
              <li>
                <Link
                  href="/guidelines/connect"
                  className="text-[var(--cr-neutral-500)] transition-colors hover:text-[var(--cr-indigo-700)]"
                >
                  {t('legal.guidelines')}
                </Link>
              </li>
              <li>
                <Link
                  href="/grievance"
                  className="text-[var(--cr-neutral-500)] transition-colors hover:text-[var(--cr-indigo-700)]"
                >
                  {t('legal.grievance')}
                </Link>
              </li>
            </ul>
          </div>
          <ul className="flex items-center gap-5">
            {FOOTER_SOCIAL.map((social) => (
              <li key={social.id}>
                <a
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[0.88rem] font-medium text-[var(--cr-neutral-500)] transition-colors hover:text-[var(--cr-indigo-700)]"
                >
                  {t(`social.${social.id}`)}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </Container>
    </footer>
  );
}
