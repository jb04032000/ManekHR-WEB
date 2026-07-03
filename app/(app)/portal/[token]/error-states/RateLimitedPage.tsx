import { getTranslations } from 'next-intl/server';
import ErrorCard from './ErrorCard';

/**
 * Rate-limited landing - backend PortalThrottlerGuard returns 429 when the
 * (jti, ip) tracker exceeds 60 req/min (CONTEXT.md D-27). Copy lives in i18n
 * `finance.portal.errors`.
 */
export default async function RateLimitedPage() {
  const t = await getTranslations('finance.portal');
  return <ErrorCard heading={t('errors.rateLimitedHeading')} body={t('errors.rateLimitedBody')} />;
}

export const metadata = { title: 'Too many requests' };
