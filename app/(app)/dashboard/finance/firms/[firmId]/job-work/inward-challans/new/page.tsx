'use client';
// Finance polish (job-work): i18n via finance.jobWork.inward; DsPageHeader title with a back
// button (titleAside). No data logic changed.
import { useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import Link from 'next/link';
import { DsPageHeader } from '@/components/ui';
import { useWorkspaceStore, useSubscriptionStore } from '@/lib/store';
import JwInwardChallanForm from '@/components/finance/job-work/JwInwardChallanForm';
import type { JobWorkInwardChallan } from '@/types';

function useModuleEnabled(module: string): boolean {
  const { entitlements, isHydrated } = useSubscriptionStore();
  return useMemo(() => {
    if (!isHydrated) return true;
    if (!entitlements?.moduleAccess?.length) return false;
    return entitlements.moduleAccess.find((m) => m.module === module)?.enabled ?? false;
  }, [entitlements, isHydrated, module]);
}

export default function NewInwardChallanPage() {
  const params = useParams<{ firmId: string }>();
  const firmId = params.firmId;
  const router = useRouter();
  const t = useTranslations('finance.jobWork');
  const wsId = useWorkspaceStore((s) => s.currentWorkspace?._id ?? '');
  const jobWorkEnabled = useModuleEnabled('job_work');

  if (!jobWorkEnabled) {
    return (
      <div className="p-6" style={{ textAlign: 'center', padding: 48 }}>
        <h2 style={{ fontSize: 22, fontFamily: 'var(--font-display)', fontWeight: 700 }}>
          {t('inward.moduleDisabledTitle')}
        </h2>
        <Button type="primary" href="/dashboard/workspace?tab=subscription">
          {t('inward.viewPlans')}
        </Button>
      </div>
    );
  }

  function handleSaved(challan: JobWorkInwardChallan) {
    router.push(`/dashboard/finance/firms/${firmId}/job-work/inward-challans/${challan._id}`);
  }

  return (
    <div className="p-6">
      <DsPageHeader
        title={t('inward.newTitle')}
        style={{ marginBottom: 24 }}
        titleAside={
          <Link href={`/dashboard/finance/firms/${firmId}/job-work/inward-challans`}>
            <Button type="text" icon={<ArrowLeftOutlined />} />
          </Link>
        }
      />
      <JwInwardChallanForm wsId={wsId} firmId={firmId} onSaved={handleSaved} />
    </div>
  );
}
