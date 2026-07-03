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
  return legalPageMetadata({ kind: 'privacy', product: 'connect', locale });
}

/**
 * Connect privacy policy - admin-managed (legal-pages CMS). Renders the published
 * Privacy Policy for Connect, falling back to the localized placeholder until an
 * admin publishes. Content edited at /admin/legal-pages.
 */
export default function ConnectPrivacyPage() {
  return <LegalPageView kind="privacy" product="connect" />;
}
