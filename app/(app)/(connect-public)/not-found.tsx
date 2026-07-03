import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

/**
 * Branded 404 for the public Connect route group - shown when `notFound()`
 * fires on an unknown / non-public entity (e.g. a hidden `/u/[userId]`).
 */
export default async function ConnectPublicNotFound() {
  const t = await getTranslations('connect.profile');

  return (
    <div className="mx-auto flex w-full max-w-[480px] flex-col items-center px-4 py-20 text-center">
      <h1 className="m-0 font-display text-[24px] font-bold" style={{ color: 'var(--cr-text)' }}>
        {t('notFoundTitle')}
      </h1>
      <p className="mt-2 text-[14px] leading-relaxed" style={{ color: 'var(--cr-text-4)' }}>
        {t('notFoundBody')}
      </p>
      <Link
        href="/connect"
        className="mt-6 rounded-full px-5 py-2.5 text-[13px] font-semibold text-white no-underline"
        style={{ background: 'var(--cr-primary)' }}
      >
        {t('notFoundCta')}
      </Link>
    </div>
  );
}
