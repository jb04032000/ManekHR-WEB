import { getTranslations } from 'next-intl/server';
import ErrorCard from './ErrorCard';

/**
 * Token expired landing - backend returns 401 Unauthorized when the JWT's
 * exp has passed. Copy lives in i18n `finance.portal.errors` (server-fetched
 * via getTranslations); links to the portal page status mapping in page.tsx.
 */
export default async function ExpiredPage({ firmName }: { firmName?: string }) {
  const t = await getTranslations('finance.portal');
  const sender = firmName?.trim() ? firmName : t('errors.fallbackSender');
  return (
    <ErrorCard heading={t('errors.expiredHeading')} body={t('errors.expiredBody', { sender })} />
  );
}

export const metadata = { title: 'This link has expired' };
