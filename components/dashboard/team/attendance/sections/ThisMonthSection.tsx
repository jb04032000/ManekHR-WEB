'use client';

import { useState, useCallback } from 'react';
import { App, Button, DatePicker } from 'antd';
import { ArrowRightOutlined, DownloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { MemberAttendancePanel } from '@/components/dashboard/attendance/MemberAttendancePanel';
import { AttendanceDetailDrawer } from '@/components/dashboard/attendance/AttendanceDetailDrawer';
import { useMemberDayAttendance } from '@/components/dashboard/attendance/hooks/useMemberDayAttendance';
import { exportMemberAttendance } from '@/components/dashboard/attendance/exportMemberAttendance';
import { buildMemberAttendanceHref } from '@/features/employee-hub/memberFocusHref';
import type { TeamMember, AttendanceRecord } from '@/types';

export interface ThisMonthSectionProps {
  wsId: string;
  memberId: string;
  isOwnRecord: boolean;
  canViewAll: boolean;
  /** Full TeamMember record. When provided and canViewAll is true, managers get
   *  inline mark/edit on day rows without leaving the page. */
  member?: TeamMember;
}

export default function ThisMonthSection({
  wsId,
  memberId,
  isOwnRecord,
  canViewAll,
  member,
}: ThisMonthSectionProps) {
  const t = useTranslations('team');
  const { message } = App.useApp();

  const now = dayjs();
  const [month, setMonth] = useState<number>(now.month() + 1); // dayjs months are 0-indexed
  const [year, setYear] = useState<number>(now.year());
  const [exporting, setExporting] = useState(false);

  // Bump this key to force MemberAttendancePanel to re-fetch after a day is marked/saved.
  const [panelRefreshKey, setPanelRefreshKey] = useState(0);

  const attendanceHref = buildMemberAttendanceHref({
    memberId,
    month,
    year,
    canViewAll,
    isOwnRecord,
  });

  function handlePeriodChange(value: dayjs.Dayjs | null) {
    if (!value) return;
    setMonth(value.month() + 1);
    setYear(value.year());
  }

  async function handleExport() {
    setExporting(true);
    try {
      const memberName = member?.name ?? memberId;
      const result = await exportMemberAttendance({ wsId, memberId, memberName, month, year });
      if (result === 'empty') {
        void message.warning(t('attendanceWorkspace.exportEmpty'));
      }
    } catch {
      void message.error(t('attendanceWorkspace.exportError'));
    } finally {
      setExporting(false);
    }
  }

  // Inline mark/edit hook - only wired up when the caller is a manager and we
  // have the full member object to feed AttendanceDetailDrawer.
  const canMarkInline = canViewAll && !!member;
  const dayAttendance = useMemberDayAttendance(
    canMarkInline ? wsId : null,
    canMarkInline ? member : null,
    useCallback(() => setPanelRefreshKey((k) => k + 1), []),
  );

  const handleDayClick = useCallback(
    (record: AttendanceRecord | null, dateIso: string) => {
      void record; // record passed for context but hook reloads from API
      dayAttendance.openDay(dateIso);
    },
    [dayAttendance],
  );

  return (
    <div className="flex flex-col gap-5">
      {/* Header row: period selector + action links */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-[12px] text-slate-500">{t('attendanceTab.periodLabel')}</span>
          <DatePicker
            picker="month"
            size="small"
            allowClear={false}
            value={dayjs(`${year}-${String(month).padStart(2, '0')}-01`)}
            format="MMM YYYY"
            onChange={handlePeriodChange}
          />
        </div>

        <div className="flex-1" />

        <Button size="small" icon={<DownloadOutlined />} loading={exporting} onClick={handleExport}>
          {t('attendanceWorkspace.export')}
        </Button>

        <Link
          href="/dashboard/attendance/regularizations"
          className="inline-flex items-center gap-1 text-[13px] text-blue-600 hover:text-blue-700 hover:underline"
        >
          {t('attendanceTab.regularizations')}
        </Link>

        <Link
          href={attendanceHref}
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-blue-600 hover:text-blue-700 hover:underline"
        >
          {t('attendanceTab.openInAttendance')}
          <ArrowRightOutlined className="text-[11px]" />
        </Link>
      </div>

      {/* Attendance panel */}
      <MemberAttendancePanel
        key={panelRefreshKey}
        wsId={wsId}
        memberId={memberId}
        month={month}
        year={year}
        variant="full"
        onDayClick={canMarkInline ? handleDayClick : undefined}
      />

      {/* Inline mark/edit drawer - only rendered when manager has the member object */}
      {canMarkInline && (
        <AttendanceDetailDrawer
          open={dayAttendance.open}
          onClose={dayAttendance.close}
          workspaceId={wsId}
          selectedMember={dayAttendance.selectedMember}
          date={dayAttendance.date}
          record={dayAttendance.record}
          pendingStatus={dayAttendance.pendingStatus}
          failedIds={dayAttendance.failedIds}
          onStatusChange={dayAttendance.onStatusChange}
          drawerNote={dayAttendance.drawerNote}
          onNoteChange={dayAttendance.onNoteChange}
          onSaveNote={dayAttendance.onSaveNote}
          savingNote={dayAttendance.savingNote}
          onReload={dayAttendance.onReload}
        />
      )}
    </div>
  );
}
