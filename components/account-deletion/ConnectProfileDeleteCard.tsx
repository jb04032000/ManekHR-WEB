'use client';

import { useCallback, useState } from 'react';
import { Button, message } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import dayjs from 'dayjs';
import { useAuthStore } from '@/lib/store';
import type { AccountDeletionMarker } from '@/types';
import { DangerDeleteModal } from './DangerDeleteModal';
import { DeletionScheduledNotice } from './DeletionScheduledNotice';

/**
 * Scope-1 danger zone on the Connect own-profile page (OwnProfileClient owner-only
 * `limits` slot, ACCOUNT-DELETION-AND-DPDP-PLAN.md §7). Deletes only the Connect
 * profile - the login and any ERP workspaces stay. On success it shows the scheduled
 * notice and a cross-link to /account/security to also delete the whole profile.
 * The same scope also has a mirror card on /account/security. Cross-link:
 * components/account-deletion/AccountSecurityDeletionSection.tsx.
 */
export function ConnectProfileDeleteCard() {
  const t = useTranslations('accountDeletion');
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);
  const [msgApi, ctx] = message.useMessage();
  const [open, setOpen] = useState(false);

  const marker = user?.connectDeletion;
  const pending = marker?.state === 'pending';

  const handleScheduled = useCallback(
    ({ purgeAfter }: { scope: string; purgeAfter: string }) => {
      const next: AccountDeletionMarker = {
        state: 'pending',
        requestedAt: new Date().toISOString(),
        purgeAfter,
      };
      updateUser({ connectDeletion: next });
      setOpen(false);
      msgApi.success(t('toast.scheduled', { date: dayjs(purgeAfter).format('DD MMM YYYY') }));
    },
    [updateUser, msgApi, t],
  );

  return (
    <div className="mb-3 rounded-[var(--cr-radius-md)] border border-red-200 bg-red-50/40 px-3.5 py-3">
      {ctx}
      <h3 className="m-0 text-[14px] font-bold text-heading">{t('scope.connect.cardTitle')}</h3>
      <p className="mt-0.5 mb-0 text-[12.5px] text-muted">{t('scope.connect.cardDesc')}</p>

      {pending && marker ? (
        <div className="mt-2.5">
          <DeletionScheduledNotice purgeAfter={marker.purgeAfter} />
          <a
            href="/account/security#delete-account"
            className="mt-2 inline-block text-[12.5px] font-semibold text-primary hover:underline"
          >
            {t('crossLink.label')}
          </a>
        </div>
      ) : (
        <Button
          danger
          size="small"
          icon={<DeleteOutlined />}
          className="mt-2.5"
          onClick={() => setOpen(true)}
        >
          {t('scope.connect.button')}
        </Button>
      )}

      <DangerDeleteModal
        open={open}
        scope="connect"
        title={t('scope.connect.modalTitle')}
        consequences={<p className="m-0 text-[13px] text-muted">{t('scope.connect.lead')}</p>}
        onClose={() => setOpen(false)}
        onScheduled={handleScheduled}
      />
    </div>
  );
}
