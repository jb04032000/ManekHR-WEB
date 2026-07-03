'use client';

import { Alert } from 'antd';
import { ClockCircleOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import dayjs from 'dayjs';
import { DELETION_CONTACT_PATH } from './constants';

/**
 * Pending-deletion notice. Shown in place of the delete action once a scope is
 * scheduled (ACCOUNT-DELETION-AND-DPDP-PLAN.md §7). States the recover-by date and
 * that recovery is by contacting Zari (admin-mediated; no self-cancel). Reused by
 * the account-security + Connect-profile danger zones and the success screens.
 */
export function DeletionScheduledNotice({ purgeAfter }: { purgeAfter: string }) {
  const t = useTranslations('accountDeletion.scheduled');
  const date = dayjs(purgeAfter).format('DD MMM YYYY');

  return (
    <Alert
      type="warning"
      showIcon
      icon={<ClockCircleOutlined />}
      className="rounded-[10px]"
      title={t('title')}
      description={
        <div className="text-[13px]">
          <p className="m-0">{t('body', { date })}</p>
          <p className="mt-1.5 mb-0">{t('recover')}</p>
          <a
            href={DELETION_CONTACT_PATH}
            className="mt-1.5 inline-block font-semibold text-primary hover:underline"
          >
            {t('contactCta')}
          </a>
        </div>
      }
    />
  );
}
