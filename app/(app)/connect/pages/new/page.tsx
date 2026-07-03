import type { Metadata } from 'next';
import CompanyPageEditor from '@/features/connect/entities/CompanyPageEditor';

export const metadata: Metadata = {
  title: 'Create company page',
  robots: { index: false, follow: false },
};

/**
 * `/connect/pages/new` -- the dedicated create surface for a Company Page: the
 * sectioned form on the left, a live preview card on the right. Person-centric;
 * the BE sets the owner from the session, never the body.
 */
export default function ConnectCompanyPageCreateRoute() {
  return <CompanyPageEditor />;
}
