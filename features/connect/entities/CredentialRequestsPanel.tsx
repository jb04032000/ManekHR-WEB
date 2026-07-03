'use client';

/**
 * CredentialRequestsPanel - the institute manage console's "Credential requests"
 * review queue (Institutes Phase 2, Feature 3).
 *
 * What it does: lists the students who asked this institute to confirm a training
 * entry, each row showing the student identity (avatar + name + handle) and the
 * course / institute name from the entry, with Confirm (primary) and Decline
 * (danger) actions. On either action it calls the server action, then optimistically
 * removes the row (busyIds Set per row, message.success/error, router.refresh) so
 * the queue stays in sync without a refetch. A confirmed entry earns the
 * "Confirmed by [Institute]" badge on the student's public profile.
 *
 * Cross-module links: actions -> company-page.actions (listCredentialRequests is
 * SSR-seeded by the `[id]/page.tsx` route loader; confirmCredential /
 * declineCredential hit the BE credential-admin endpoints). The empty state links
 * to the sibling Invite tab (the acquisition mechanic). Pattern copied from
 * network/InvitationsTab.tsx (busyIds + optimistic remove).
 *
 * Keep in sync with: the BE PendingCredentialRequest shape (entities.types) and
 * the ManageCompanyPageScreen 'credentials' tab that mounts this. Owner-only:
 * the manage route 404s non-owners, so no extra in-component auth.
 */

import { useCallback, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { App as AntApp } from 'antd';
import { GraduationCap } from 'lucide-react';
import { useTranslations } from 'next-intl';
import ConnectAvatar from '@/components/connect/ConnectAvatar';
import { ConnectEmptyState } from '@/components/connect';
import DsButton from '@/components/ui/DsButton';
import { confirmCredential, declineCredential } from './company-page.actions';
import type { PendingCredentialRequest } from './entities.types';

interface Props {
  /** This institute page's id - the route param for the credential endpoints. */
  pageId: string;
  /** The pending requests, SSR-seeded by the manage route loader. */
  initialRequests: PendingCredentialRequest[];
  /** Switch the console to the Invite tab (the empty-state forward path). */
  onGoToInvite: () => void;
}

/** A stable per-row key: studentUserId + trainingId uniquely identifies a request
 *  (one student can have several training entries pending at once). */
function rowKey(req: PendingCredentialRequest): string {
  return `${req.student.userId}:${req.training.id}`;
}

export default function CredentialRequestsPanel({ pageId, initialRequests, onGoToInvite }: Props) {
  const t = useTranslations('connect.companyPageAdmin');
  const router = useRouter();
  const { message } = AntApp.useApp();

  const [requests, setRequests] = useState<PendingCredentialRequest[]>(initialRequests);
  /** Row keys with an action in flight - disables that row's buttons. */
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [, startRefresh] = useTransition();

  const setBusy = useCallback((key: string, on: boolean) => {
    setBusyIds((prev) => {
      const next = new Set(prev);
      if (on) next.add(key);
      else next.delete(key);
      return next;
    });
  }, []);

  /** Confirm or decline a request, then optimistically drop the row. */
  const act = useCallback(
    async (req: PendingCredentialRequest, action: 'confirm' | 'decline') => {
      const key = rowKey(req);
      setBusy(key, true);
      const res =
        action === 'confirm'
          ? await confirmCredential(pageId, req.student.userId, req.training.id)
          : await declineCredential(pageId, req.student.userId, req.training.id);
      setBusy(key, false);
      if (!res.ok) {
        message.error(res.error || t('credentials.actionError'));
        return;
      }
      message.success(
        action === 'confirm' ? t('credentials.confirmed') : t('credentials.declined'),
      );
      setRequests((prev) => prev.filter((r) => rowKey(r) !== key));
      // Refresh so the SSR-seeded list + any profile mirror stay in sync.
      startRefresh(() => router.refresh());
    },
    [message, pageId, router, setBusy, t],
  );

  if (requests.length === 0) {
    return (
      <ConnectEmptyState
        variant="inline"
        icon={<GraduationCap size={24} aria-hidden />}
        title={t('credentials.emptyTitle')}
        description={t('credentials.emptyBody')}
        primaryAction={{ label: t('credentials.emptyCta'), onClick: onGoToInvite }}
      />
    );
  }

  return (
    <section>
      <div className="mb-3">
        <h2 className="m-0 text-[16px] font-bold" style={{ color: 'var(--cr-text)' }}>
          {t('credentials.title')}
        </h2>
        <p className="m-0 mt-0.5 text-[12.5px]" style={{ color: 'var(--cr-text-4)' }}>
          {t('credentials.subtitle')}
        </p>
      </div>

      <ul
        aria-label={t('credentials.listAria')}
        className="m-0 flex list-none flex-col p-0"
        style={{ gap: 'var(--cr-space-sm)' }}
      >
        {requests.map((req) => {
          const key = rowKey(req);
          const busy = busyIds.has(key);
          return (
            <li
              key={key}
              className="flex flex-col gap-3 p-4"
              style={{
                border: '1px solid var(--cr-border)',
                borderRadius: 'var(--cr-radius-lg)',
                background: 'var(--cr-surface)',
              }}
            >
              <div className="flex items-start gap-3">
                <ConnectAvatar
                  name={req.student.name}
                  src={req.student.avatar ?? undefined}
                  size={40}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    {req.student.handle ? (
                      <Link
                        href={`/u/${req.student.handle}`}
                        className="text-[14px] font-semibold no-underline"
                        style={{ color: 'var(--cr-text)' }}
                      >
                        {req.student.name}
                      </Link>
                    ) : (
                      <span
                        className="text-[14px] font-semibold"
                        style={{ color: 'var(--cr-text)' }}
                      >
                        {req.student.name}
                      </span>
                    )}
                    {req.student.handle && (
                      <span className="text-[12px]" style={{ color: 'var(--cr-text-4)' }}>
                        @{req.student.handle}
                      </span>
                    )}
                  </div>
                  <p className="m-0 mt-0.5 text-[13px]" style={{ color: 'var(--cr-text-2)' }}>
                    {/* The course + institute name being claimed (from the entry). */}
                    <span className="font-medium">{req.training.course}</span>
                    {req.training.instituteName ? (
                      <span style={{ color: 'var(--cr-text-4)' }}>
                        {' '}
                        · {req.training.instituteName}
                      </span>
                    ) : null}
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <DsButton
                  dsVariant="danger"
                  dsSize="sm"
                  onClick={() => void act(req, 'decline')}
                  disabled={busy}
                >
                  {t('credentials.decline')}
                </DsButton>
                <DsButton
                  dsVariant="primary"
                  dsSize="sm"
                  onClick={() => void act(req, 'confirm')}
                  loading={busy}
                >
                  {t('credentials.confirm')}
                </DsButton>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
