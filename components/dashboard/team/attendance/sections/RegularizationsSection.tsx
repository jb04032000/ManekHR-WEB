'use client';

import { useState, useCallback, useEffect } from 'react';
import { App, Button, DatePicker } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useTranslations } from 'next-intl';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import {
  regularizationApi,
  getRegularizationErrorMessage,
} from '@/lib/api/modules/regularization.api';
import { RegularizationList } from '@/components/dashboard/attendance/RegularizationList';
import { RaiseRegularizationModal } from '@/components/dashboard/attendance/RaiseRegularizationModal';
import { RegularizationApproveModal } from '@/components/dashboard/attendance/RegularizationApproveModal';
import type { RegularizationRequest, TeamMember } from '@/types';

// ── Props ─────────────────────────────────────────────────────────────────────

export interface RegularizationsSectionProps {
  wsId: string;
  memberId: string;
  isOwnRecord: boolean;
  canViewAll: boolean;
  member?: TeamMember;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function RegularizationsSection({
  wsId,
  memberId,
  isOwnRecord,
  canViewAll,
  member,
}: RegularizationsSectionProps) {
  const t = useTranslations('team.attendanceWorkspace.regularizations');
  const { message: msgApi } = App.useApp();
  const { canPath } = useMyPermissions();

  // Permission gates (path-based, mirroring backend @RequirePermission decorators)
  // Raise: regularization.request.apply at scope 'self'.
  // For own record: any self-scoped grant suffices.
  // For another member's record (manager): scope 'all' is required so the BE
  // resolves the target memberId from the body rather than the caller's own row.
  const canRaise = isOwnRecord
    ? canPath('regularization.request.apply', 'self')
    : canPath('regularization.request.apply', 'all');
  // Approve / reject: regularization.approval.decide (no scope required by the controller)
  const canDecide = canPath('regularization.approval.decide');

  // List state
  const [rows, setRows] = useState<RegularizationRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Raise modal state
  const [raiseDate, setRaiseDate] = useState<dayjs.Dayjs | null>(null);
  const [raiseDatePickerOpen, setRaiseDatePickerOpen] = useState(false);
  const [raiseModalOpen, setRaiseModalOpen] = useState(false);

  // Approve/reject modal state
  const [selected, setSelected] = useState<RegularizationRequest | null>(null);

  // ── Data fetching ────────────────────────────────────────────────────────────

  // Refresh counter: bump to trigger a re-fetch without remounting.
  const [refreshTick, setRefreshTick] = useState(0);

  // Stable setter used by action handlers to request a refresh.
  const refresh = useCallback(() => setRefreshTick((n) => n + 1), []);

  useEffect(() => {
    if (!wsId) return;
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const data = await regularizationApi.listAll(wsId, { memberId });
        if (!cancelled) {
          setRows(data);
          setLoaded(true);
        }
      } catch (err) {
        if (!cancelled) void msgApi.error(getRegularizationErrorMessage(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // msgApi is a stable object from App.useApp() - safe to include.
  }, [wsId, memberId, refreshTick, msgApi]);

  // ── Raise: pick date then open modal ─────────────────────────────────────────

  function handleRaiseClick() {
    setRaiseDatePickerOpen(true);
  }

  function handleDateSelect(date: dayjs.Dayjs | null) {
    setRaiseDatePickerOpen(false);
    if (!date) return;
    setRaiseDate(date);
    setRaiseModalOpen(true);
  }

  // ── Row click: open decide modal for pending rows if canDecide ───────────────

  function handleRowClick(req: RegularizationRequest) {
    if (req.status === 'pending' && canDecide) {
      setSelected(req);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  const memberName = member?.name ?? memberId;

  const pendingCount = rows.filter((r) => r.status === 'pending').length;

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-[12px] text-slate-500">
          {loaded && rows.length > 0
            ? t('rowCount', { count: rows.length, pending: pendingCount })
            : null}
        </span>
        <div className="flex-1" />

        {canRaise && (
          <>
            {/* Hidden DatePicker used as a trigger; visible via open state */}
            <DatePicker
              open={raiseDatePickerOpen}
              onOpenChange={(open) => {
                if (!open) setRaiseDatePickerOpen(false);
              }}
              onChange={handleDateSelect}
              disabledDate={(d) => d.isAfter(dayjs(), 'day')}
              value={null}
              style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 0 }}
              styles={{ popup: { root: { zIndex: 1100 } } }}
            />
            <Button size="small" type="primary" icon={<PlusOutlined />} onClick={handleRaiseClick}>
              {t('raiseButton')}
            </Button>
          </>
        )}
      </div>

      {/* List */}
      <RegularizationList
        rows={rows}
        loading={loading}
        mode={canViewAll ? 'all' : 'myRequests'}
        emptyText={t('emptyText')}
        onRowClick={handleRowClick}
      />

      {/* Raise modal */}
      {raiseModalOpen && raiseDate && (
        <RaiseRegularizationModal
          open={raiseModalOpen}
          memberId={memberId}
          memberName={memberName}
          date={raiseDate.format('YYYY-MM-DD')}
          currentStatus="ABSENT"
          onClose={() => {
            setRaiseModalOpen(false);
            setRaiseDate(null);
          }}
          onSuccess={refresh}
        />
      )}

      {/* Approve / reject modal */}
      {selected && (
        <RegularizationApproveModal
          open={!!selected}
          request={selected}
          onClose={() => {
            setSelected(null);
            refresh();
          }}
        />
      )}
    </div>
  );
}
