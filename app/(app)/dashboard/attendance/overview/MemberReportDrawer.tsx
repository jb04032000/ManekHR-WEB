'use client';

import { useEffect, useState } from 'react';
import { Drawer, Select } from 'antd';
import dayjs from 'dayjs';
import { useTranslations } from 'next-intl';
import { DsAvatar, DsTag } from '@/components/ui';
import { monthOptions } from '@/lib/utils';
import { MemberAttendancePanel } from '@/components/dashboard/attendance/MemberAttendancePanel';

// ── Props ──────────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  wsId: string;
  memberId: string;
  memberName: string;
  designation: string;
  shiftName: string;
  initialMonth: number;
  initialYear: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const MONTHS = monthOptions(24);

// ── Component ──────────────────────────────────────────────────────────────────

export function MemberReportDrawer({
  open,
  onClose,
  wsId,
  memberId,
  memberName,
  designation,
  shiftName,
  initialMonth,
  initialYear,
}: Props) {
  const t = useTranslations('attendance.memberReport');
  const [month, setMonth] = useState(initialMonth);
  const [year, setYear] = useState(initialYear);

  // Sync with parent month when drawer opens - deferred via microtask so the
  // setState lands after the effect commit (avoids the setState-in-effect
  // cascading-render warning).
  useEffect(() => {
    if (!open) return;
    queueMicrotask(() => {
      setMonth(initialMonth);
      setYear(initialYear);
    });
  }, [open, initialMonth, initialYear]);

  return (
    <Drawer
      open={open}
      onClose={onClose}
      size="large"
      title={
        <div className="flex items-center gap-3">
          <DsAvatar name={memberName} size={36} />
          <div>
            <p className="m-0 text-[15px] font-bold" style={{ color: 'var(--cr-text-1)' }}>
              {memberName}
            </p>
            <p className="m-0 text-[12px]" style={{ color: 'var(--cr-text-3)' }}>
              {designation || shiftName || t('fallbackRole')}
            </p>
          </div>
        </div>
      }
      extra={
        <Select
          value={`${month}-${year}`}
          onChange={(v) => {
            const [m, y] = v.split('-');
            setMonth(Number(m));
            setYear(Number(y));
          }}
          className="w-36"
          options={MONTHS.map((m) => ({ value: `${m.month}-${m.year}`, label: m.label }))}
          size="small"
        />
      }
    >
      <div className="space-y-5">
        {/* Shift + period label */}
        <div className="flex items-center gap-2 text-[12px]" style={{ color: 'var(--cr-text-3)' }}>
          {shiftName && (
            <DsTag
              label={shiftName}
              style={{
                background: 'var(--cr-bg)',
                color: 'var(--cr-text-2)',
                borderColor: 'var(--cr-border)',
              }}
            />
          )}
          <span>{dayjs(`${year}-${month}-01`).format('MMMM YYYY')}</span>
        </div>

        {/* Attendance body: tiles + status row + daily table */}
        <MemberAttendancePanel
          wsId={wsId}
          memberId={memberId}
          month={month}
          year={year}
          variant="full"
        />
      </div>
    </Drawer>
  );
}
