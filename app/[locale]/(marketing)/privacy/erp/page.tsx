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
  return legalPageMetadata({ kind: 'privacy', product: 'erp', locale });
}

/**
 * ERP privacy policy - admin-managed (legal-pages CMS). Renders the published
 * Privacy Policy for ERP, falling back to the localized placeholder until an
 * admin publishes. See components/marketing/LegalPageView.
 */
export default function ErpPrivacyPage() {
  return <LegalPageView kind="privacy" product="erp" />;
}
