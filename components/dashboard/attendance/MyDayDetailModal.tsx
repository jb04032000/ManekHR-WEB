'use client';
import { useEffect, useState } from 'react';
import { Tag, Skeleton, Empty, Button } from 'antd';
import { LoginOutlined, LogoutOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useTranslations } from 'next-intl';
import { DsModal } from '@/components/ui/DsModal';
import { attendanceApi } from '@/lib/api/modules/attendance.api';
import type { MeAttendanceDay } from '@/types';

/**
 * Self-service day-detail - the caller's own check-in / check-out sessions for a
 * single day, opened by tapping a calendar cell in MyAttendance. Reads
 * `GET /me/attendance/day` (self-scoped; needs only `attendance.record.view@self`,
 * NOT the admin `attendance.events.view`), so a restricted member can review how
 * many times they punched and the hours worked, then optionally raise a
 * correction. The fetched day is handed back to the correction modal so it can
 * show / prefill the recorded times.
 */

/** Worked-minutes -> compact "8h 15m" / "8h" / "45m" (mirrors AttendanceDailySummary). */
const fmtHm = (min: number): string => {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
};

const sessionMinutes = (inIso: string, outIso: string | null): number => {
  const inMs = new Date(inIso).getTime();
  const outMs = outIso ? new Date(outIso).getTime() : Date.now();
  return Math.max(0, (outMs - inMs) / 60000);
};

export interface MyDayDetailModalProps {
  open: boolean;
  wsId: string;
  date: string; // YYYY-MM-DD
  /** Already-resolved status label for the day (from the month grid). */
  statusText: string;
  /** Whether the caller may raise a correction (grant + workspace policy). */
  canRaise: boolean;
  /** Open the correction modal, handing over the fetched day (for prefill). */
  onRaiseCorrection?: (day: MeAttendanceDay | null) => void;
  onClose: () => void;
}

export function MyDayDetailModal({
  open,
  wsId,
  date,
  statusText,
  canRaise,
  onRaiseCorrection,
  onClose,
}: MyDayDetailModalProps) {
  const t = useTranslations('attendance');
  const [day, setDay] = useState<MeAttendanceDay | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !wsId || !date) return;
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setDay(null);
      try {
        const res = await attendanceApi.myDay(wsId, date);
        if (!cancelled) setDay(res);
      } catch {
        if (!cancelled) setDay(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, wsId, date]);

  const sessions = day?.sessions ?? [];
  const lateMin = day?.lateMinutes ?? 0;
  const otMin = day?.otMinutes ?? 0;
  const earlyMin = day?.earlyMinutes ?? 0;
  const workedMin = day?.workedMinutes ?? 0;

  return (
    <DsModal
      open={open}
      title={t('myAttendance.detailTitle', { date: dayjs(date).format('DD MMM YYYY') })}
      onCancel={onClose}
      width={460}
      footer={[
        <Button key="close" onClick={onClose}>
          {t('myAttendance.detailClose')}
        </Button>,
        ...(canRaise
          ? [
              <Button key="raise" type="primary" onClick={() => onRaiseCorrection?.(day)}>
                {t('myAttendance.detailRaiseCorrection')}
              </Button>,
            ]
          : []),
      ]}
    >
      {loading ? (
        <Skeleton active paragraph={{ rows: 4 }} />
      ) : (
        <div className="flex flex-col gap-4">
          {/* Status + day metrics */}
          <div className="flex flex-wrap items-center gap-2">
            <Tag className="m-0">{statusText}</Tag>
            {workedMin > 0 && (
              <span className="text-[12px] text-muted">
                {t('myAttendance.detailWorked')}:{' '}
                <strong className="tabular-nums">{fmtHm(workedMin)}</strong>
              </span>
            )}
            {lateMin > 0 && (
              <span className="text-[12px]" style={{ color: 'var(--cr-danger-700)' }}>
                {t('myAttendance.lateBadge')}: {fmtHm(lateMin)}
              </span>
            )}
            {earlyMin > 0 && (
              <span className="text-[12px]" style={{ color: 'var(--cr-warning-700)' }}>
                {t('myAttendance.detailEarly')}: {fmtHm(earlyMin)}
              </span>
            )}
            {otMin > 0 && (
              <span className="text-[12px]" style={{ color: 'var(--cr-success-700)' }}>
                {t('myAttendance.detailOt')}: {fmtHm(otMin)}
              </span>
            )}
          </div>

          {/* Session log - every check-in -> check-out pair */}
          <div>
            <p className="m-0 mb-2 text-[12px] font-semibold tracking-wide text-faint uppercase">
              {t('myAttendance.detailSessions')}
            </p>
            {sessions.length === 0 ? (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={t('myAttendance.detailNoPunches')}
              />
            ) : (
              <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
                {sessions.map((s, i) => (
                  <li
                    key={`${s.in}-${i}`}
                    className="flex items-center justify-between gap-3 rounded-lg px-3 py-2"
                    style={{ background: 'var(--cr-surface-2, var(--cr-bg))' }}
                  >
                    <span className="inline-flex items-center gap-2 text-[13px] text-heading tabular-nums">
                      <LoginOutlined style={{ color: 'var(--cr-success-700)' }} />
                      {dayjs(s.in).format('h:mm A')}
                      <span className="text-faint">–</span>
                      {s.out ? (
                        <>
                          <LogoutOutlined style={{ color: 'var(--cr-text-3)' }} />
                          {dayjs(s.out).format('h:mm A')}
                        </>
                      ) : (
                        <em style={{ color: 'var(--cr-success-700)' }}>
                          {t('myAttendance.sessionOngoing')}
                        </em>
                      )}
                    </span>
                    <span className="text-[12px] text-muted tabular-nums">
                      {fmtHm(sessionMinutes(s.in, s.out))}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </DsModal>
  );
}
