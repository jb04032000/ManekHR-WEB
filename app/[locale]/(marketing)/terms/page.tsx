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
  return legalPageMetadata({ kind: 'terms', product: 'platform', locale });
}

/**
 * Company-wide Terms & Conditions - the canonical document the footer links to.
 * Admin-managed (legal-pages CMS, product `platform`, slug `terms`); links out to
 * the product-specific terms (/terms/connect, /terms/erp). Falls back to the
 * localized placeholder until an admin publishes. See LegalPageView.
 */
export default function TermsPage() {
  return <LegalPageView kind="terms" product="platform" />;
}
