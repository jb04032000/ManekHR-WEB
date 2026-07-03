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
  return legalPageMetadata({ kind: 'terms', product: 'connect', locale });
}

/**
 * Connect terms - admin-managed (legal-pages CMS). Renders the published Terms
 * for Connect, falling back to the localized placeholder until an admin publishes.
 * Content is edited at /admin/legal-pages. See components/marketing/LegalPageView.
 */
export default function ConnectTermsPage() {
  return <LegalPageView kind="terms" product="connect" />;
}
