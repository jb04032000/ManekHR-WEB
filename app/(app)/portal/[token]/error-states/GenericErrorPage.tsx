import { getTranslations } from 'next-intl/server';
import ErrorCard from './ErrorCard';

/**
 * Catch-all error landing - any 4xx/5xx the portal couldn't classify.
 * Copy lives in i18n `finance.portal.errors`.
 */
export default async function GenericErrorPage() {
  const t = await getTranslations('finance.portal');
  return <ErrorCard heading={t('errors.genericHeading')} body={t('errors.genericBody')} />;
}

export const metadata = { title: 'Something went wrong' };
