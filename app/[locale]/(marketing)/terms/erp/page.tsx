import type { Metadata } from 'next';
import { LegalPageView, legalPageMetadata } from '@/components/marketing/LegalPageView';

// Unique scope-specific title/description + self-canonical, and noindex while only
// the placeholder renders (indexes automatically once published). See legalPageMetadata.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return legalPageMetadata({ kind: 'terms', product: 'erp', locale });
}

/**
 * ERP terms - admin-managed (legal-pages CMS). Renders the published Terms for
 * ERP, falling back to the localized placeholder until an admin publishes. See
 * `terms/connect/page.tsx` + components/marketing/LegalPageView.
 */
export default function ErpTermsPage() {
  return <LegalPageView kind="terms" product="erp" />;
}
