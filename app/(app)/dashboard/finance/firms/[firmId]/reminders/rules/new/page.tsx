'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Skeleton, Spin, Button } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { useWorkspaceStore } from '@/lib/store';
import { ReminderRuleForm } from '@/components/finance/reminders/ReminderRuleForm';
import { listParties } from '@/lib/actions/finance.actions';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { ModuleLockedPage } from '@/components/subscription/ModuleLockedPage';

export default function NewReminderRulePage() {
  const router = useRouter();
  const { firmId } = useParams<{ firmId: string }>();
  const t = useTranslations('finance.reminders');
  const workspaceId = useWorkspaceStore((s) => s.currentWorkspace?._id);
  const isHydrated = useWorkspaceStore((s) => s.isHydrated);
  const remindersAccess = useFeatureAccess('reminders');

  const [parties, setParties] = useState<{ _id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!workspaceId || !isHydrated || !firmId || remindersAccess.isLocked) return;
    listParties(workspaceId, firmId)
      .then((p) =>
        setParties(
          Array.isArray(p) ? p : ((p as { items?: { _id: string; name: string }[] }).items ?? []),
        ),
      )
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [workspaceId, isHydrated, firmId, remindersAccess.isLocked]);

  const handleSuccess = () => {
    router.push(`/dashboard/finance/firms/${firmId}/reminders/rules`);
  };

  if (remindersAccess.isLoading) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <Spin />
      </div>
    );
  }
  if (remindersAccess.isLocked) {
    return <ModuleLockedPage module="reminders" />;
  }

  if (!workspaceId || loading) {
    return (
      <div style={{ padding: 24 }}>
        <Skeleton active paragraph={{ rows: 8 }} />
      </div>
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 800 }}>
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => router.push(`/dashboard/finance/firms/${firmId}/reminders/rules`)}
        >
          {t('common.back')}
        </Button>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{t('ruleNew.title')}</h2>
          <p style={{ margin: '2px 0 0', color: 'var(--cr-text-3)', fontSize: 13 }}>
            {t('ruleNew.subtitle')}
          </p>
        </div>
      </div>

      <ReminderRuleForm
        wsId={workspaceId}
        firmId={firmId}
        parties={parties}
        onSuccess={handleSuccess}
      />
    </div>
  );
}
