'use client';

import { Button } from 'antd';
import { ArrowRightOutlined } from '@ant-design/icons';
import Link from 'next/link';
import dayjs from 'dayjs';
import { useTranslations } from 'next-intl';
import { MemberAttendancePanel } from '@/components/dashboard/attendance/MemberAttendancePanel';
import { buildMemberAttendanceHref } from '@/features/employee-hub/memberFocusHref';

export interface AttendanceSnapshotCardProps {
  wsId: string;
  memberId: string;
  isOwnRecord: boolean;
  canViewAll: boolean;
  onViewAttendance: () => void;
}

export function AttendanceSnapshotCard({
  wsId,
  memberId,
  isOwnRecord,
  canViewAll,
  onViewAttendance,
}: AttendanceSnapshotCardProps) {
  const t = useTranslations('team');

  const now = dayjs();
  const currentMonth = now.month() + 1;
  const currentYear = now.year();

  const attendanceHref = buildMemberAttendanceHref({
    memberId,
    month: currentMonth,
    year: currentYear,
    canViewAll,
    isOwnRecord,
  });

  return (
    <div className="flex flex-col gap-4 rounded-xl border bg-surface p-5">
      <h3 className="m-0 text-[13px] font-semibold tracking-[0.04em] text-muted uppercase">
        {t('overview.attendanceTitle')}
      </h3>

      <MemberAttendancePanel
        wsId={wsId}
        memberId={memberId}
        month={currentMonth}
        year={currentYear}
        variant="compact"
      />

      <div className="flex flex-wrap items-center gap-3 border-t border-[var(--cr-border-subtle,rgba(0,0,0,0.06))] pt-3">
        <Button type="primary" size="small" onClick={onViewAttendance}>
          {t('overview.viewAttendance')}
        </Button>
        <Link
          href={attendanceHref}
          className="inline-flex items-center gap-1 text-[13px] text-[var(--cr-primary,var(--cr-text-1))] hover:opacity-80"
        >
          {t('overview.openInAttendance')}
          <ArrowRightOutlined className="text-xs" />
        </Link>
      </div>
    </div>
  );
}
