'use client';

import { Alert } from 'antd';
import { ClockCircleOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import { DELETION_CONTACT_PATH } from './constants';

/**
 * Login-screen notice for a suspended account scheduled for deletion
 * (ACCOUNT-DELETION-AND-DPDP-PLAN.md §A.2). The backend 403 carries a complete
 * "scheduled on {date} - contact us at {url} to recover" message; we show it as a
 * calm warning (not a hard error) plus an explicit recovery contact link. Recovery
 * is admin-mediated - there is no self-undo. Used by components/auth/modes/LoginMode.
 */
export function ScheduledDeletionLoginNotice({ message }: { message: string }) {
  const t = useTranslations('accountDeletion.scheduled');
  return (
    <Alert
      type="warning"
      showIcon
      icon={<ClockCircleOutlined />}
      className="mb-4 rounded-[10px]"
      title={message}
      description={
        <a href={DELETION_CONTACT_PATH} className="font-semibold text-primary hover:underline">
          {t('contactCta')}
        </a>
      }
    />
  );
}
