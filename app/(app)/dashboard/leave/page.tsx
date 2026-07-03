'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Skeleton } from 'antd';
import { useMyPermissions } from '@/hooks/useMyPermissions';

/**
 * Leave module index - redirects by role. Owner / HR (`manage_leave`) land on
 * the approvals inbox; everyone else (workers) on their self-service page.
 */
export default function LeaveIndexPage() {
  const router = useRouter();
  const { canPath, data, loading } = useMyPermissions();

  useEffect(() => {
    if (loading || !data) return;
    const admin = data.isOwner || canPath('leave.approval.decide');
    router.replace(admin ? '/dashboard/leave/approvals' : '/dashboard/leave/me');
  }, [loading, data, canPath, router]);

  return (
    <div className="mx-auto max-w-5xl p-6" aria-busy="true">
      <Skeleton active paragraph={{ rows: 4 }} />
    </div>
  );
}
