'use client';

import { useCallback, useState } from 'react';
import { Button, message } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import dayjs from 'dayjs';
import { useAuthStore } from '@/lib/store';
import { clearAuthCookie } from '@/lib/actions/cookies';
import {
  getErpDeletionPreview,
  type ErpDeletionImpact,
} from '@/lib/actions/account-deletion.actions';
import type { AccountDeletionMarker, User } from '@/types';
import { DangerDeleteModal, type DeletionScope } from './DangerDeleteModal';
import { DeletionScheduledNotice } from './DeletionScheduledNotice';
import { ErpDeletionImpactSummary } from './ErpDeletionImpactSummary';

/**
 * Danger-zone section on /account/security (ACCOUNT-DELETION-AND-DPDP-PLAN.md §7).
 * Hosts all three scopes - Connect (mirror of the Connect-profile zone), ERP, and the
 * whole account - over the shared DangerDeleteModal. Whole-account success logs the
 * user out + redirects (the backend suspends + revokes sessions); Connect/ERP success
 * flips the card to the scheduled notice and offers the "also delete my whole profile"
 * cross-link. Recovery is admin-mediated (contact-to-recover; no self-cancel).
 */
export function AccountSecurityDeletionSection() {
  const t = useTranslations('accountDeletion');
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);
  const logout = useAuthStore((s) => s.logout);
  const [msgApi, ctx] = message.useMessage();

  const [activeScope, setActiveScope] = useState<DeletionScope | null>(null);
  const [erpImpact, setErpImpact] = useState<ErpDeletionImpact | null>(null);
  const [erpLoading, setErpLoading] = useState(false);

  // Only show a scope's card when the user actually has that surface (or already
  // scheduled it). The whole-account card always shows.
  const showConnect = !!(user?.connectPolicyAcceptedAt || user?.connectDeletion);
  const showErp = !!(user?.hasWorkspace || user?.erpPolicyAcceptedAt || user?.erpDeletion);

  const markerFor = (scope: DeletionScope): AccountDeletionMarker | null | undefined =>
    scope === 'connect'
      ? user?.connectDeletion
      : scope === 'erp'
        ? user?.erpDeletion
        : user?.accountDeletion;
  const isPending = (scope: DeletionScope) => markerFor(scope)?.state === 'pending';
  const accountPending = isPending('account');

  // Open a scope's confirm modal. The ERP scope additionally fetches the impact
  // preview so the consequences block can render affected workspaces + warnings.
  const openScope = useCallback((scope: DeletionScope) => {
    setActiveScope(scope);
    if (scope === 'erp') {
      setErpImpact(null);
      setErpLoading(true);
      void getErpDeletionPreview().then((res) => {
        setErpImpact(res.ok ? res.data : null);
        setErpLoading(false);
      });
    }
  }, []);

  const handleScheduled = useCallback(
    async ({ scope, purgeAfter }: { scope: DeletionScope; purgeAfter: string }) => {
      if (scope === 'account') {
        // Backend already suspended + revoked sessions. Clear the cookie + local
        // state and bounce to the login screen (which shows the contact-to-recover
        // message on the next attempt).
        setActiveScope(null);
        await clearAuthCookie().catch(() => {});
        logout();
        router.replace('/auth?from=deletion-scheduled');
        return;
      }
      const marker: AccountDeletionMarker = {
        state: 'pending',
        requestedAt: new Date().toISOString(),
        purgeAfter,
      };
      const patch: Partial<User> =
        scope === 'connect' ? { connectDeletion: marker } : { erpDeletion: marker };
      updateUser(patch);
      setActiveScope(null);
      msgApi.success(t('toast.scheduled', { date: dayjs(purgeAfter).format('DD MMM YYYY') }));
    },
    [router, logout, updateUser, msgApi, t],
  );

  const consequencesFor = (scope: DeletionScope) => {
    if (scope === 'erp') {
      return (
        <>
          <p className="m-0 mb-3 text-[13px] text-muted">{t('scope.erp.lead')}</p>
          <ErpDeletionImpactSummary impact={erpImpact} loading={erpLoading} />
        </>
      );
    }
    return <p className="m-0 text-[13px] text-muted">{t(`scope.${scope}.lead`)}</p>;
  };

  const renderCard = (scope: DeletionScope) => {
    const marker = markerFor(scope);
    const pending = marker?.state === 'pending';
    return (
      <div key={scope} className="rounded-[14px] border border-red-200 bg-red-50/40 px-5 py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 className="m-0 text-[15px] font-bold text-heading">
              {t(`scope.${scope}.cardTitle`)}
            </h3>
            <p className="mt-0.5 mb-0 text-[13px] text-muted">{t(`scope.${scope}.cardDesc`)}</p>
          </div>
          {!pending && (
            <Button danger icon={<DeleteOutlined />} onClick={() => openScope(scope)}>
              {t(`scope.${scope}.button`)}
            </Button>
          )}
        </div>
        {pending && marker && (
          <div className="mt-3">
            <DeletionScheduledNotice purgeAfter={marker.purgeAfter} />
            {scope !== 'account' && !accountPending && (
              <Button type="link" className="mt-2 !px-0" onClick={() => openScope('account')}>
                {t('crossLink.label')}
              </Button>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {ctx}
      <section id="delete-account" className="mt-2" style={{ scrollMarginTop: 24 }}>
        <div className="mb-3 flex items-center gap-2.5">
          <div className="h-5 w-1 flex-shrink-0 rounded-full bg-red-500" />
          <div>
            <h2 className="m-0 mb-0.5 font-label text-[12px] font-bold text-red-700">
              {t('section.title')}
            </h2>
            <p className="m-0 text-[12px] text-muted">{t('section.desc')}</p>
          </div>
        </div>

        <div className="space-y-3">
          {showConnect && renderCard('connect')}
          {showErp && renderCard('erp')}
          {renderCard('account')}
        </div>
      </section>

      <DangerDeleteModal
        open={activeScope !== null}
        scope={activeScope ?? 'account'}
        title={activeScope ? t(`scope.${activeScope}.modalTitle`) : undefined}
        consequences={activeScope ? consequencesFor(activeScope) : null}
        onClose={() => setActiveScope(null)}
        onScheduled={handleScheduled}
      />
    </>
  );
}
