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
  return legalPageMetadata({ kind: 'guidelines', product: 'connect', locale });
}

/**
 * Connect Community Guidelines - admin-managed (legal-pages CMS). Renders the
 * published Community Guidelines for Connect, falling back to the localized
 * placeholder until an admin publishes. Content edited at /admin/legal-pages.
 * Required for Google AdSense approval (UGC code of conduct). Linked from the
 * Connect footer.
 */
export default function ConnectGuidelinesPage() {
  return <LegalPageView kind="guidelines" product="connect" />;
}
