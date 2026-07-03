'use client';

// Daily / Monthly attendance marking console. Was previously the default
// landing at /dashboard/attendance; relocated here so the top-level
// /dashboard/attendance can land on Overview instead (which is what most
// managers want to see first). The "Attendance" tab in AttendanceWorkspaceNav
// now points at this path.
//
// Self-scoped members (Karigar) continue to see their own MyAttendance
// surface, mirroring the prior scope-gate behaviour.

import Link from 'next/link';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { App, Card, Button, Skeleton, Modal, TimePicker } from 'antd';
import { CalendarOutlined, CloseOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useWorkspaceStore, useSubscriptionStore } from '@/lib/store';
import { anomaliesApi } from '@/lib/api';
import { todayISO } from '@/lib/utils';
import { DsPageHeader, StatTile, InfoTooltip } from '@/components/ui';
import { UpcomingEventsBar } from '@/components/dashboard/attendance/UpcomingEventsBar';
import { AttendanceFeatureBanner } from '@/components/dashboard/attendance/AttendanceFeatureBanner';
import { AttendanceExportModal } from '@/components/dashboard/attendance/AttendanceExportModal';
import { AttendanceHeader } from '@/components/dashboard/attendance/AttendanceHeader';
import { AttendanceFilters } from '@/components/dashboard/attendance/AttendanceFilters';
import { AttendanceDailyTable } from '@/components/dashboard/attendance/AttendanceDailyTable';
import { AttendanceMonthlyGrid } from '@/components/dashboard/attendance/AttendanceMonthlyGrid';
import { AttendanceDetailDrawer } from '@/components/dashboard/attendance/AttendanceDetailDrawer';
import { useAttendanceData } from '@/components/dashboard/attendance/hooks/useAttendanceData';
import { MyAttendance } from '@/components/dashboard/attendance/MyAttendance';
import { MemberCapNotice } from '@/components/dashboard/MemberCapNotice';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import BulkMarkMonthModal from '@/components/dashboard/attendance/BulkMarkMonthModal';
import type { StaleSession } from '@/lib/actions';

function AttendanceConsole() {
  const t = useTranslations('attendance');
  const tCommon = useTranslations('common');
  const { currentWorkspaceId } = useWorkspaceStore();
  const { message: msgApi } = App.useApp();

  const searchParams = useSearchParams();
  const router = useRouter();

  // View + date synced to URL so refresh preserves selection.
  const date = searchParams.get('date') ?? todayISO();
  const view = (searchParams.get('view') as 'daily' | 'monthly') ?? 'daily';
  const [month, setMonth] = useState(dayjs().month() + 1);
  const [year, setYear] = useState(dayjs().year());

  const setDate = useCallback(
    (newDate: string) => {
      const p = new URLSearchParams(searchParams.toString());
      p.set('date', newDate);
      router.replace(`?${p.toString()}`);
    },
    [searchParams, router],
  );

  const setView = useCallback(
    (newView: 'daily' | 'monthly') => {
      const p = new URLSearchParams(searchParams.toString());
      p.set('view', newView);
      router.replace(`?${p.toString()}`);
    },
    [searchParams, router],
  );
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [staleModalOpen, setStaleModalOpen] = useState(false);
  const [staleCloseTime, setStaleCloseTime] = useState<ReturnType<typeof dayjs> | null>(null);
  const [staleTarget, setStaleTarget] = useState<StaleSession | null>(null);
  const [staleClosing, setStaleClosing] = useState(false);

  const {
    members,
    records,
    summary,
    holidays,
    upcomingLeaves,
    monthlyRecords,
    monthlyRecordsList,
    carryoverRecords,
    carryoverMap,
    loading,
    monthlyLoading,
    marking,
    pendingStatus,
    failedIds,
    loadDaily,
    loadMonthly,
    handleMarkOne,
    handleBulkMark,
    handleBulkMarkShift,
    handleBulkMarkShiftWithTimes,
    handleBulkMarkWithTimes,
    handleRemove,
    handleSetTimes,
    handleCloseOvernightShift,
    staleSessions,
    closeStaleSession,
    bulkStatus,
    setBulkStatus,
    drawerVisible,
    selectedMember,
    drawerNote,
    setDrawerNote,
    savingNote,
    openDrawer,
    closeDrawer,
    handleSaveNote,
    handleDrawerStatusChange,
    attMap,
    uniqueShifts,
    uniqueRoles,
    unmarkedCount,
    filteredUnmarkedCount,
    hasActiveFilters,
    displayMembers,
    sortedShiftEntries,
    expandedShifts,
    setExpandedShifts,
    activeStatusFilter,
    setActiveStatusFilter,
    searchQuery,
    setSearchQuery,
    selectedShifts,
    setSelectedShifts,
    selectedRoles,
    setSelectedRoles,
    clearAllFilters,
  } = useAttendanceData(
    currentWorkspaceId,
    date,
    month,
    year,
    (msg) => msgApi.success(msg),
    (msg) => msgApi.error(msg),
  );

  // Trigger load when view/date/month/year changes
  useEffect(() => {
    if (view === 'daily') loadDaily();
    else loadMonthly();
  }, [view, loadDaily, loadMonthly]);

  // ── Deep-link auto-open: ?teamMemberId=<id> opens that employee's Attendance
  // Details drawer (from the employee hub). Fires once per focusId, after the
  // member list loads. The marking console always lists the member, so it is robust.
  const autoOpenedRef = useRef<string | null>(null);
  useEffect(() => {
    const focusId = searchParams.get('teamMemberId');
    if (!focusId || autoOpenedRef.current === focusId || !members.length) return;
    const member = members.find((m) => m.id === focusId);
    if (!member) return;
    autoOpenedRef.current = focusId;
    openDrawer(member);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- openDrawer is a fresh closure each render; the autoOpenedRef guard makes this fire exactly once
  }, [searchParams, members]);

  // Anomaly 24h count widget
  const [anomalyCount, setAnomalyCount] = useState(0);
  useEffect(() => {
    if (!currentWorkspaceId) return;
    anomaliesApi
      .count(currentWorkspaceId)
      .then((r) => setAnomalyCount(r.count))
      .catch(() => {});
  }, [currentWorkspaceId]);

  // Feature access
  const { entitlements, isHydrated } = useSubscriptionStore();
  const attendanceModule = entitlements?.moduleAccess?.find((m) => m.module === 'attendance');
  const sfAccess = (key: string) =>
    attendanceModule?.subFeatures?.find((sf) => sf.key === key)?.access ?? 'locked';
  const canExportPdf = isHydrated && sfAccess('export_pdf') !== 'locked';
  const canExportExcel = isHydrated && sfAccess('export_excel') !== 'locked';
  const canBulkMark = isHydrated && sfAccess('bulk_mark') !== 'locked';
  const canEdit = isHydrated && sfAccess('edit') !== 'locked';
  const canAdvancedFilters = isHydrated && sfAccess('advanced_filters') !== 'locked';

  // Whole-month / selected-days bulk mark is an owner / mark@all action.
  // Gated by both RBAC (here) and the bulk_mark subscription. -> BulkMarkMonthModal.
  const { canPath: canPathConsole, data: permData } = useMyPermissions();
  const canBulkMonth =
    canBulkMark && (!!permData?.isOwner || canPathConsole('attendance.record.mark', 'all'));
  const [bulkMonthOpen, setBulkMonthOpen] = useState(false);

  // ── Daily stat tiles - minimal 4-tile row (canonical pattern, Team v2 parity) ──
  const presentCount = summary?.present ?? 0;
  const absentCount = summary?.absent ?? 0;
  const halfDayCount = summary?.half_day ?? 0;
  const onLeaveCount = summary?.on_leave ?? 0;
  const effectiveTotal = summary ? summary.total - summary.week_off - summary.holiday : 0;
  const offTodayCount = absentCount + halfDayCount + onLeaveCount;
  // "Present persons for the day": never show more present than scheduled, and
  // never a rate above 100%. Backend already scopes to active members; this
  // clamp guards the display against any stray/over-count.
  const presentDisplay = Math.min(presentCount, effectiveTotal);
  const presentRate =
    effectiveTotal > 0 ? Math.min(100, Math.round((presentDisplay / effectiveTotal) * 100)) : 0;
  const totalWorkedMinutes = records.reduce((sum, r) => sum + (r.workedMinutes ?? 0), 0);
  const fmtHrs = (mins: number) => {
    if (mins <= 0) return '-';
    const h = Math.floor(mins / 60);
    const m = Math.round(mins % 60);
    if (h === 0) return `${m}m`;
    return m === 0 ? `${h}h` : `${h}h ${m}m`;
  };
  const goldOnUnmarked = (unmarkedCount ?? 0) > 0;
  const dateLabel = dayjs(date).format('ddd, D MMM YYYY');

  return (
    <>
      {/* Page header - date-anchored title (avoids duplicating layout's tab "Attendance" label).
          InfoTooltip sits INLINE next to title (titleAside), not floating right - explainers
          attach to label per Apple HIG. */}
      <DsPageHeader
        title={view === 'monthly' ? dayjs(`${year}-${month}-01`).format('MMMM YYYY') : dateLabel}
        sub={
          view === 'daily' && summary
            ? t('headerMetaDailyScheduled', { total: effectiveTotal })
            : view === 'monthly'
              ? t('headerMetaMonthly')
              : ''
        }
        icon={<CalendarOutlined />}
        titleAside={<InfoTooltip text={t('headerExplainer')} body={t('headerExplainerBody')} />}
      />

      {/* Over-plan-limit notice. Backend trims this org-scoped report to the
          allowed member set when the workspace is past its plan cap; surface the
          "Showing N of TOTAL — upgrade" banner above the report (mirrors the Team
          list). Renders nothing unless capped. -> summary.memberCap (sibling of
          `data` on getSummary, merged in getAttendanceSummary). */}
      {summary?.memberCap?.capped && <MemberCapNotice {...summary.memberCap} className="mb-4" />}

      {/* Stat tiles - 4 canonical StatTile; gold rail on Unmarked when actionable */}
      {view === 'daily' && (
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {loading && Object.keys(pendingStatus).length === 0 ? (
            [0, 1, 2, 3].map((i) => (
              <Skeleton.Button key={i} active block style={{ height: 88, borderRadius: 12 }} />
            ))
          ) : (
            <>
              <StatTile
                label={t('tile.present')}
                value={`${presentDisplay}/${effectiveTotal}`}
                hint={
                  effectiveTotal > 0
                    ? t('tile.presentHint', { rate: presentRate })
                    : t('tile.noData')
                }
                emphasis={!goldOnUnmarked}
                onClick={() =>
                  setActiveStatusFilter(activeStatusFilter === 'present' ? null : 'present')
                }
                selected={activeStatusFilter === 'present'}
                ariaLabel={t('tile.presentAria')}
              />
              <div aria-live="polite" aria-atomic="true">
                <StatTile
                  label={t('tile.unmarked')}
                  value={String(unmarkedCount ?? 0)}
                  hint={
                    (unmarkedCount ?? 0) === 0
                      ? t('tile.unmarkedHintDone')
                      : carryoverRecords.length > 0
                        ? // Carryover present → the count spans 13 today + N
                          // overnight rows, so disclose the split here (right
                          // where the eye lands) - otherwise "14" looks adrift
                          // of the "13 scheduled" header.
                          t('tile.unmarkedHintCarryover', {
                            scheduled: effectiveTotal,
                            overnight: carryoverRecords.length,
                          })
                        : t('tile.unmarkedHintAction')
                  }
                  emphasis={goldOnUnmarked}
                  tone={(unmarkedCount ?? 0) > 0 ? 'danger' : 'neutral'}
                  onClick={() =>
                    setActiveStatusFilter(activeStatusFilter === 'unmarked' ? null : 'unmarked')
                  }
                  selected={activeStatusFilter === 'unmarked'}
                  ariaLabel={t('tile.unmarkedAria')}
                />
              </div>
              <StatTile
                label={t('tile.offToday')}
                value={String(offTodayCount)}
                hint={t('tile.offTodayHint', {
                  absent: absentCount,
                  half: halfDayCount,
                  leave: onLeaveCount,
                })}
              />
              <StatTile
                label={t('tile.hoursWorked')}
                value={fmtHrs(totalWorkedMinutes)}
                hint={
                  totalWorkedMinutes > 0
                    ? t('tile.hoursWorkedHintActive')
                    : t('tile.hoursWorkedHintNoData')
                }
              />
            </>
          )}
        </div>
      )}

      {view === 'daily' && (
        <UpcomingEventsBar
          holidays={holidays}
          members={members}
          records={records}
          upcomingLeaves={upcomingLeaves}
          date={date}
          onLeaveClick={() => setActiveStatusFilter('on_leave')}
        />
      )}

      {/* Status row - Auto-Present indicator (left) + anomaly count + View feed (right).
          Single horizontal card per minimal pattern. */}
      <AttendanceFeatureBanner
        entitlements={entitlements}
        workspaceId={currentWorkspaceId}
        rightSlot={
          view === 'daily' && anomalyCount > 0 ? (
            <>
              <span
                className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[12px] font-semibold"
                style={{
                  background: 'var(--cr-warning-50)',
                  color: 'var(--cr-warning-700)',
                }}
              >
                {t('banner.anomalies', { count: anomalyCount })}
              </span>
              <Link
                href="/dashboard/attendance/anomalies"
                className="text-[13px] underline-offset-2 hover:underline"
                style={{ color: 'var(--cr-text-2)' }}
              >
                {t('banner.viewFeed')}
              </Link>
            </>
          ) : undefined
        }
      />

      {/* Operational urgents - overnight + stale chips (action-required, separate from status row) */}
      {view === 'daily' && (
        <div
          className="mb-3 flex flex-wrap items-center gap-2"
          aria-live="polite"
          aria-atomic="false"
        >
          {carryoverRecords.length > 0 && (
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-medium"
              style={{
                background: 'var(--cr-indigo-50)',
                color: 'var(--cr-primary-hover)',
                border: '1px solid var(--cr-indigo-100)',
              }}
            >
              <span aria-hidden style={{ fontSize: 12 }}>
                🌙
              </span>
              {t('banner.overnightWorkers', { count: carryoverRecords.length })}
            </span>
          )}
          {staleSessions.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setStaleModalOpen(true);
                setStaleTarget(staleSessions[0]);
                setStaleCloseTime(null);
              }}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border-0 px-3 py-1 text-[12px] font-medium hover:opacity-90 focus-visible:ring-2 focus-visible:ring-[var(--cr-warning-700)]/40 focus-visible:outline-none"
              style={{
                background: 'var(--cr-warning-50)',
                color: 'var(--cr-warning-700)',
              }}
              aria-label={t('banner.viewAndClose')}
            >
              <span aria-hidden style={{ fontSize: 12 }}>
                ⚠️
              </span>
              {t('banner.staleSessions', { count: staleSessions.length })}
              <span className="opacity-70">·</span>
              <span className="underline-offset-2 hover:underline">{t('banner.viewAndClose')}</span>
            </button>
          )}
        </div>
      )}

      {activeStatusFilter && view === 'daily' && (
        <div className="mb-3 flex items-center gap-2 px-1">
          <span className="text-xs text-muted">
            {t('filteredBy')}: <strong>{activeStatusFilter?.replace(/_/g, ' ')}</strong>
          </span>
          <Button
            type="link"
            size="small"
            onClick={() => setActiveStatusFilter(null)}
            icon={<CloseOutlined />}
          >
            {tCommon('clear')}
          </Button>
        </div>
      )}

      <Card
        style={{
          background: 'var(--cr-surface, white)',
          border: '1px solid var(--cr-border-light)',
        }}
      >
        {/* Toolbar - full-width left/right split (view+date left, actions right) */}
        <div className="mb-4">
          <AttendanceHeader
            view={view}
            onViewChange={setView}
            date={date}
            onDateChange={setDate}
            month={month}
            year={year}
            onMonthYearChange={(m, y) => {
              setMonth(m);
              setYear(y);
            }}
            onExport={() => setExportModalOpen(true)}
            canExportPdf={canExportPdf}
            canExportExcel={canExportExcel}
            canBulkMark={canBulkMark}
            bulkStatus={bulkStatus}
            onBulkStatusChange={setBulkStatus}
            onBulkMark={handleBulkMark}
            unmarkedCount={unmarkedCount}
            marking={marking}
            loading={loading}
            onReload={() => (view === 'daily' ? loadDaily() : loadMonthly())}
            members={displayMembers}
            records={records}
            hasActiveFilters={hasActiveFilters}
            filteredUnmarkedCount={filteredUnmarkedCount}
            onBulkMarkWithTimes={handleBulkMarkWithTimes}
            onBulkMonth={canBulkMonth ? () => setBulkMonthOpen(true) : undefined}
          />
        </div>

        {view === 'daily' && (
          <AttendanceFilters
            search={searchQuery}
            onSearchChange={setSearchQuery}
            selectedShifts={selectedShifts}
            onShiftChange={setSelectedShifts}
            selectedRoles={selectedRoles}
            onRoleChange={setSelectedRoles}
            shifts={uniqueShifts}
            roles={uniqueRoles}
            hasActiveFilters={hasActiveFilters}
            onClearAll={clearAllFilters}
            canAdvancedFilters={canAdvancedFilters}
          />
        )}

        {view === 'daily' ? (
          <AttendanceDailyTable
            members={members}
            records={records}
            holidays={holidays}
            loading={loading}
            pendingStatus={pendingStatus}
            failedIds={failedIds}
            onMark={handleMarkOne}
            onRowClick={openDrawer}
            onRemove={handleRemove}
            onSetTimes={handleSetTimes}
            date={date}
            shifts={uniqueShifts}
            canEdit={canEdit}
            expandedShifts={expandedShifts}
            onExpandedShiftsChange={setExpandedShifts}
            sortedShiftEntries={sortedShiftEntries}
            workspaceId={currentWorkspaceId ?? ''}
            onReload={loadDaily}
            carryoverMap={carryoverMap}
            onCloseOvernightShift={handleCloseOvernightShift}
            onBulkMarkShift={handleBulkMarkShift}
            onBulkMarkShiftWithTimes={handleBulkMarkShiftWithTimes}
            marking={marking}
            canBulkMark={canBulkMark}
          />
        ) : (
          <AttendanceMonthlyGrid
            members={members}
            // Use the month's rows (not daily `records`) so cells + summary match
            // the displayed month. Fixes the "blank grid yet 1P" mismatch.
            records={monthlyRecordsList}
            month={month}
            year={year}
            loading={monthlyLoading}
            holidays={holidays}
            onCellClick={(member) => openDrawer(member)}
            search={searchQuery}
            statusFilter={activeStatusFilter}
          />
        )}
      </Card>

      <AttendanceExportModal
        open={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        workspaceId={currentWorkspaceId ?? ''}
        view={view}
        date={date}
        month={month}
        year={year}
        members={view === 'daily' ? displayMembers : members}
        records={records.filter((r) => {
          const mid =
            typeof r.teamMemberId === 'string'
              ? r.teamMemberId
              : (r.teamMemberId as { _id: string })._id;
          return displayMembers.some((m) => m.id === mid);
        })}
        monthlyRecords={monthlyRecords}
      />

      {/* Whole-month / selected-days bulk mark (regularization). Owner / mark@all
          only (canBulkMonth). PIN-gated -> BE attendance bulk endpoint. Applies
          to the full member set (not the daily filter) and refreshes after. */}
      {canBulkMonth && (
        <BulkMarkMonthModal
          open={bulkMonthOpen}
          workspaceId={currentWorkspaceId ?? ''}
          month={month}
          year={year}
          members={members}
          holidays={holidays}
          onClose={() => setBulkMonthOpen(false)}
          onDone={() => (view === 'monthly' ? loadMonthly() : loadDaily())}
        />
      )}

      {/* P3a: stale sessions modal */}
      <Modal
        title={<span style={{ color: 'var(--cr-warning-700)' }}>⚠️ {t('staleModal.title')}</span>}
        open={staleModalOpen}
        onCancel={() => {
          setStaleModalOpen(false);
          setStaleTarget(null);
          setStaleCloseTime(null);
        }}
        footer={null}
        destroyOnHidden
      >
        <div className="space-y-3">
          {staleSessions.map((s) => (
            <div
              key={s._id}
              className="flex items-center justify-between gap-3 rounded-lg border p-3"
              style={{
                borderColor:
                  staleTarget?._id === s._id ? 'var(--cr-warning-700)' : 'var(--cr-border)',
                background: staleTarget?._id === s._id ? 'var(--cr-warning-50)' : undefined,
              }}
            >
              <div>
                <p className="m-0 text-sm font-semibold">{s.memberName}</p>
                <p className="m-0 text-xs text-gray-700">
                  {t('staleModal.started', {
                    when: dayjs(s.checkIn).format('DD MMM, hh:mm A'),
                    date: s.date,
                  })}
                </p>
              </div>
              <Button
                size="small"
                type="link"
                style={{ color: 'var(--cr-warning-700)', flexShrink: 0 }}
                onClick={() => {
                  setStaleTarget(s);
                  setStaleCloseTime(null);
                }}
              >
                {tCommon('close')}
              </Button>
            </div>
          ))}
          {staleTarget && (
            <div className="mt-2 space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="text-xs font-semibold text-amber-700">
                {t('staleModal.setCheckoutFor', { name: staleTarget.memberName })}
              </p>
              <TimePicker
                format="hh:mm a"
                use12Hours
                minuteStep={5}
                value={staleCloseTime}
                onChange={setStaleCloseTime}
                style={{ width: '100%' }}
                placeholder={t('staleModal.selectCheckoutTime')}
              />
              <Button
                type="primary"
                block
                size="small"
                loading={staleClosing}
                disabled={!staleCloseTime}
                style={{
                  background: 'var(--cr-warning-700)',
                  borderColor: 'var(--cr-warning-700)',
                }}
                onClick={async () => {
                  if (!staleCloseTime || !staleTarget) return;
                  setStaleClosing(true);
                  try {
                    const iso = dayjs(staleTarget.date)
                      .startOf('day')
                      .hour(staleCloseTime.hour())
                      .minute(staleCloseTime.minute())
                      .second(0)
                      .toISOString();
                    await closeStaleSession(staleTarget._id, staleTarget.memberId, iso);
                    const remaining = staleSessions.filter((s) => s._id !== staleTarget._id);
                    if (remaining.length === 0) {
                      setStaleModalOpen(false);
                      setStaleTarget(null);
                    } else {
                      setStaleTarget(remaining[0]);
                      setStaleCloseTime(null);
                    }
                  } finally {
                    setStaleClosing(false);
                  }
                }}
              >
                {t('staleModal.closeShiftBtn')}
              </Button>
            </div>
          )}
        </div>
      </Modal>

      <AttendanceDetailDrawer
        open={drawerVisible}
        onClose={closeDrawer}
        workspaceId={currentWorkspaceId ?? ''}
        selectedMember={selectedMember}
        date={date}
        record={selectedMember ? (attMap[selectedMember.id] ?? null) : null}
        pendingStatus={pendingStatus}
        failedIds={failedIds}
        onStatusChange={handleDrawerStatusChange}
        drawerNote={drawerNote}
        onNoteChange={setDrawerNote}
        onSaveNote={handleSaveNote}
        savingNote={savingNote}
        onReload={loadDaily}
        carryoverMap={carryoverMap}
      />
    </>
  );
}

/**
 * Scope-gate (Access Control Initiative §8). The marking console at
 * /dashboard/attendance/mark composes by the caller's resolved scope:
 *   - `attendance.view all` (or owner) → the manager marking console.
 *   - self-scoped                      → the caller's own attendance surface.
 *
 * Permissions resolve before either branch mounts, so a self-scoped
 * member never sees the console (no org-wide fetches fire, no data flash).
 */
export default function AttendanceMarkPage() {
  const { canPath, data, loading } = useMyPermissions();
  if (loading || !data) return <AttendanceRouteSkeleton />;
  const selfScoped = !data.isOwner && !canPath('attendance.record.view', 'all');
  return selfScoped ? <MyAttendance /> : <AttendanceConsole />;
}

function AttendanceRouteSkeleton() {
  return (
    <div className="flex flex-col gap-5">
      <Skeleton active paragraph={{ rows: 1 }} />
      <Skeleton active paragraph={{ rows: 8 }} />
    </div>
  );
}
