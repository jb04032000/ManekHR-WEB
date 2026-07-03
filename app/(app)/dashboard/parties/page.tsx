'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Skeleton } from 'antd';
import { useWorkspaceStore } from '@/lib/store';
import { getCurrentFirm } from '@/lib/actions/finance.actions';

// Stable entry point for Parties. Parties (customers / vendors / brokers) are
// firm-scoped, so the list lives at /dashboard/finance/firms/{firmId}/parties
// and individual parties at /dashboard/parties/{id}. There was no index at the
// bare /dashboard/parties, so that URL 404'd. This resolves the workspace's
// firm and redirects to its parties list, giving a stable, link-able entry
// (used by the Billing & Accounts guide and direct navigation).
export default function PartiesIndexPage() {
  const router = useRouter();
  const wsId = useWorkspaceStore((s) => s.currentWorkspace?._id ?? '');

  useEffect(() => {
    if (!wsId) return;
    let active = true;
    getCurrentFirm(wsId)
      .then((firm) => {
        if (!active) return;
        router.replace(
          firm?._id ? `/dashboard/finance/firms/${firm._id}/parties` : '/dashboard/finance',
        );
      })
      .catch(() => {
        if (active) router.replace('/dashboard/finance');
      });
    return () => {
      active = false;
    };
  }, [wsId, router]);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 md:px-6">
      <Skeleton active paragraph={{ rows: 6 }} />
    </div>
  );
}
