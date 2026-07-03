import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getMyCompanyPage } from '@/features/connect/entities/company-page.actions';
import CompanyPageEditor from '@/features/connect/entities/CompanyPageEditor';

export const metadata: Metadata = {
  title: 'Edit company page',
  robots: { index: false, follow: false },
};

interface Props {
  params: Promise<{ id: string }>;
}

/**
 * `/connect/pages/[id]/edit` -- edit one of the owner's Company Pages. Seeded
 * server-side via `getMyCompanyPage(id)`; the BE 404s a page the caller does
 * not own (no existence leak), which surfaces here as notFound().
 */
export default async function ConnectCompanyPageEditRoute({ params }: Props) {
  const { id } = await params;
  const res = await getMyCompanyPage(id);
  if (!res.ok) notFound();
  return <CompanyPageEditor initial={res.data} />;
}
