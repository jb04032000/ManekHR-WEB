'use client';
import { useTranslations } from 'next-intl';

/**
 * Footer credit shown on every portal page (incl. error states) per UI-SPEC
 * Public Portal copy. Copy lives in i18n `finance.portal.common.footerCredit`.
 *
 * Client component: rendered both by the client PortalShell and by the
 * server-rendered ErrorCard. NextIntlClientProvider in the root layout makes
 * useTranslations available on the public portal route.
 */
export default function PortalFooter() {
  const t = useTranslations('finance.portal');
  return (
    <footer
      className="py-6 text-center text-xs"
      style={{ color: 'var(--cr-text-3, var(--cr-text-3))' }}
    >
      <a
        href="https://manekhr.in"
        target="_blank"
        rel="noopener noreferrer"
        style={{ color: 'inherit' }}
      >
        {t('common.footerCredit')}
      </a>
    </footer>
  );
}
