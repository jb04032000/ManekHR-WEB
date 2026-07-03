import { getTranslations } from 'next-intl/server';
import ErrorCard from './ErrorCard';

/**
 * Token revoked landing - backend returns 410 Gone when the token's
 * revokedAt is set. Copy lives in i18n `finance.portal.errors`.
 *
 * firmName may be unknown if revocation rejected the request before
 * /portal/context resolved -> fallback to the i18n "the sender" string.
 */
export default async function RevokedPage({ firmName }: { firmName?: string }) {
  const t = await getTranslations('finance.portal');
  const sender = firmName?.trim() ? firmName : t('errors.fallbackSender');
  return (
    <ErrorCard heading={t('errors.revokedHeading')} body={t('errors.revokedBody', { sender })} />
  );
}

export const metadata = { title: 'This link is no longer active' };
