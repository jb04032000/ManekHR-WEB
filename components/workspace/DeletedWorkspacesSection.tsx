'use client';

// OQ-W3 (approved Option A) - 30-day self-serve workspace recovery.
// Lists the caller's recently soft-deleted, still-restorable workspaces and
// offers a one-tap Restore within the window. Lives on the workspace settings
// page next to the Danger Zone (restore is the inverse of delete). Owner-only:
// the BE filters to ownerId, so a non-owner simply sees an empty list.
//
// Cross-module links:
// - data: listDeletedWorkspaces / restoreWorkspace (lib/actions/workspaces.actions)
//   -> BE WorkspacesService.listRestorableWorkspaces / restore.
// - on restore success: refetches the workspace list and switches into the
//   restored workspace so the sidebar switcher reflects it immediately.
// Watch: restore deliberately leaves kiosk/ingest tokens OFF (BE strips them on
// delete), so copy must not promise device access "just works" after restore.

import { useCallback, useEffect, useState } from 'react';
import { App, Button, Popconfirm, Tag } from 'antd';
import { HistoryOutlined, BankOutlined, ReloadOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import dayjs from 'dayjs';
import {
  listDeletedWorkspaces,
  restoreWorkspace,
  listWorkspaces,
  type DeletedWorkspace,
} from '@/lib/actions/workspaces.actions';
import { useWorkspaceStore } from '@/lib/store';
import { normalizeWorkspaceList } from '@/lib/utils/workspace.utils';

export function DeletedWorkspacesSection() {
  const t = useTranslations('workspace.recovery');
  const { message: msgApi } = App.useApp();
  // Narrow selectors (AC-4.1) - restore mutates the full list, so we need both
  // setters but subscribe to nothing that re-renders this card needlessly.
  const setWorkspaces = useWorkspaceStore((s) => s.setWorkspaces);
  const setCurrentWorkspaceId = useWorkspaceStore((s) => s.setCurrentWorkspaceId);

  const [items, setItems] = useState<DeletedWorkspace[] | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await listDeletedWorkspaces();
    if (res.ok) {
      setItems(res.data);
    } else {
      // Soft-fail: a recovery panel that errors should not block the page. Show
      // an empty list + a toast so the owner is informed but not stuck.
      setItems([]);
      msgApi.error(res.error || t('loadFailed'));
    }
  }, [msgApi, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleRestore = async (ws: DeletedWorkspace) => {
    setRestoringId(ws.id);
    try {
      const res = await restoreWorkspace(ws.id);
      if (res.ok) {
        msgApi.success(t('restoreSuccess'));
        // Refetch the live list so the restored workspace re-enters the switcher,
        // then switch into it (mirrors the create / accept-invite flows).
        try {
          const listRes = await listWorkspaces();
          if (listRes.ok) {
            const list = normalizeWorkspaceList(listRes.data);
            setWorkspaces(list);
            setCurrentWorkspaceId(res.workspaceId);
          }
        } catch {
          // Best-effort; the dashboard layout reconciles on next navigation.
        }
        // Drop the restored row from the recovery list immediately.
        setItems((prev) => prev?.filter((w) => w.id !== ws.id) ?? null);
      } else if (res.code === 'WORKSPACE_RESTORE_WINDOW_EXPIRED') {
        // The 30-day window lapsed (e.g. the card was stale). Tell the owner to
        // contact support and refresh the list so the dead row drops off.
        msgApi.error(t('windowExpired'));
        await load();
      } else {
        msgApi.error(res.error || t('restoreFailed'));
      }
    } finally {
      setRestoringId(null);
    }
  };

  return (
    <>
      <div className="mt-2 !mb-[20px] flex items-center gap-2.5">
        <div className="h-5 w-1 flex-shrink-0 rounded-full bg-amber-400" />
        <div>
          <h2 className="m-0 mb-0.5 font-label text-[12px] font-bold text-heading">
            {t('sectionHeader')}
          </h2>
          <p className="m-0 text-[12px] text-muted">{t('sectionDescription')}</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-[var(--cr-border)] bg-white shadow-card">
        <div className="flex items-center gap-2 border-b border-[var(--cr-border)] bg-amber-50 px-4 py-2.5">
          <HistoryOutlined className="text-[13px] text-amber-600" />
          <p className="m-0 text-[12px] text-amber-800">{t('subtitle')}</p>
        </div>

        {/* Loading state - first fetch in flight. */}
        {items === null && (
          <div
            className="flex items-center gap-2 px-4 py-6 text-[12.5px] text-muted"
            role="status"
            aria-live="polite"
          >
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-gray-200 border-t-primary" />
            {t('loading')}
          </div>
        )}

        {/* Empty state - nothing to restore. */}
        {items !== null && items.length === 0 && (
          <p className="m-0 px-4 py-6 text-center text-[12.5px] text-subtle">{t('empty')}</p>
        )}

        {items !== null && items.length > 0 && (
          <ul className="m-0 list-none divide-y divide-[var(--cr-border)] p-0">
            {items.map((ws) => {
              const deletedLabel = ws.deletedAt
                ? t('deletedOn', { date: dayjs(ws.deletedAt).format('DD MMM YYYY') })
                : '';
              const daysLeft = ws.restorableUntil
                ? Math.max(
                    0,
                    dayjs(ws.restorableUntil).startOf('day').diff(dayjs().startOf('day'), 'day'),
                  )
                : null;
              return (
                <li key={ws.id} className="flex items-center gap-3 px-4 py-3">
                  {ws.logo ? (
                    // eslint-disable-next-line @next/next/no-img-element -- remote workspace logo, no fixed dims
                    <img
                      src={ws.logo}
                      alt={ws.name}
                      className="h-9 w-9 flex-shrink-0 rounded-[10px] object-cover"
                    />
                  ) : (
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[10px] bg-gray-100 text-gray-400">
                      <BankOutlined />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="m-0 truncate text-[13px] font-semibold text-heading">{ws.name}</p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      {deletedLabel && (
                        <span className="text-[11px] text-subtle">{deletedLabel}</span>
                      )}
                      {daysLeft !== null && (
                        <Tag
                          color={daysLeft <= 5 ? 'red' : 'default'}
                          className="!m-0 !text-[10.5px]"
                        >
                          {daysLeft <= 0 ? t('lastDay') : t('daysLeft', { count: daysLeft })}
                        </Tag>
                      )}
                    </div>
                  </div>
                  <Popconfirm
                    title={t('confirmTitle', { name: ws.name })}
                    description={
                      <span className="block max-w-[280px] text-[12px]">
                        {t('confirmDescription')}
                      </span>
                    }
                    okText={t('confirmOk')}
                    onConfirm={() => handleRestore(ws)}
                  >
                    <Button
                      size="small"
                      type="primary"
                      icon={<ReloadOutlined />}
                      loading={restoringId === ws.id}
                      className="shrink-0"
                    >
                      {t('restoreBtn')}
                    </Button>
                  </Popconfirm>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}
