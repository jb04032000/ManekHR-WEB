'use client';
import { useEffect, useState } from 'react';
import { Timeline, Tag, Empty, Spin, Alert, Button } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useTranslations } from 'next-intl';
import { listAttendanceEvents } from '@/lib/actions';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import type { AttendanceEvent } from '@/types';
import { VoidEventModal } from './VoidEventModal';

interface AttendanceEventTimelineProps {
  workspaceId: string;
  memberId: string;
  date: string; // YYYY-MM-DD
  onChange?: () => void;
}

const PUNCH_TYPE_LABEL: Record<string, string> = {
  STATUS_SET: 'Status set',
  CHECK_IN: 'Check-in',
  CHECK_OUT: 'Check-out',
  RECOMPUTE: 'Recomputed',
  AUTO_MARK: 'Auto-marked',
  BULK_MARK: 'Bulk mark',
  NOTE_UPDATE: 'Note updated',
};

const SOURCE_COLOR: Record<string, string> = {
  manual_override: 'gold',
  regularization: 'purple',
  device_push: 'blue',
  connector: 'geekblue',
  file_upload: 'cyan',
  auto_cron: 'default',
  manual: 'default',
  kiosk: 'green',
};

const SOURCE_LABEL: Record<string, string> = {
  manual_override: 'Manual override',
  regularization: 'Regularization',
  device_push: 'Biometric device',
  connector: 'Connector agent',
  file_upload: 'File upload',
  auto_cron: 'Auto-present',
  manual: 'Manual (legacy)',
  kiosk: 'Kiosk',
};

const STATUS_LABEL: Record<string, string> = {
  present: 'Present',
  absent: 'Absent',
  half_day: 'Half Day',
  late: 'Late',
  on_leave: 'On Leave',
  holiday: 'Holiday',
  week_off: 'Week Off',
};

export function AttendanceEventTimeline({
  workspaceId,
  memberId,
  date,
  onChange,
}: AttendanceEventTimelineProps) {
  const t = useTranslations('attendance.eventTimeline');
  // Punch Events permission gate: events.view to see the raw log, events.delete
  // to void. Mirrors the BE @RequirePermission on GET/DELETE /attendance/events.
  const { canPath } = useMyPermissions();
  const canViewEvents = canPath('attendance.events.view');
  const canVoidEvents = canPath('attendance.events.delete');
  const [events, setEvents] = useState<AttendanceEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [voidingEvent, setVoidingEvent] = useState<AttendanceEvent | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!memberId || !date || !canViewEvents) return;
    let cancelled = false;
    const from = date;
    // date + 1 day, inclusive end
    const to = dayjs(date).add(1, 'day').format('YYYY-MM-DD');
    void (async () => {
      setLoading(true);
      setErr(null);
      try {
        const r = await listAttendanceEvents(workspaceId, { memberId, from, to, limit: 200 });
        if (!cancelled) setEvents(r.items);
      } catch (e: unknown) {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : 'Failed to load events';
        setErr(msg);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [workspaceId, memberId, date, reloadKey, canViewEvents]);

  // No Punch Events access → hide the raw event log entirely.
  if (!canViewEvents) return null;
  if (loading) return <Spin size="small" />;
  if (err) return <Alert type="error" title={err} showIcon />;
  if (events.length === 0) return <Empty description={t('noEvents')} />;

  return (
    <>
      <Timeline
        items={events.map((e) => {
          const isVoided = !!e.voidedAt;
          const changedBy =
            typeof e.markedBy === 'object' && e.markedBy ? e.markedBy.name : 'System';

          return {
            color: isVoided ? 'gray' : (SOURCE_COLOR[e.source] ?? 'default'),
            content: (
              <div style={isVoided ? { opacity: 0.55 } : undefined}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <Tag color={isVoided ? 'default' : (SOURCE_COLOR[e.source] ?? 'default')}>
                    {SOURCE_LABEL[e.source] ?? e.source}
                  </Tag>
                  <strong style={isVoided ? { textDecoration: 'line-through' } : undefined}>
                    {PUNCH_TYPE_LABEL[e.punchType] ?? e.punchType}
                  </strong>
                  {e.statusValue && <span>→ {STATUS_LABEL[e.statusValue] ?? e.statusValue}</span>}
                  {!isVoided && canVoidEvents && (
                    <Button
                      type="text"
                      danger
                      size="small"
                      icon={<DeleteOutlined />}
                      title={t('voidThisEvent')}
                      onClick={() => setVoidingEvent(e)}
                      style={{ marginLeft: 'auto' }}
                    />
                  )}
                </div>
                <div style={{ fontSize: 12, color: '#888' }}>
                  {dayjs(e.timestamp).format('MMM D, YYYY HH:mm:ss')} · by {changedBy}
                </div>
                {e.note && <div style={{ fontSize: 12 }}>{e.note}</div>}
                {isVoided && (
                  <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>
                    <small>
                      Voided by {e.voidedBy?.name ?? 'unknown'}
                      {e.voidReason ? `: ${e.voidReason}` : ''}
                    </small>
                  </div>
                )}
              </div>
            ),
          };
        })}
      />

      {/* Void event modal - one instance at bottom */}
      {voidingEvent && (
        <VoidEventModal
          open={!!voidingEvent}
          onClose={() => setVoidingEvent(null)}
          wsId={workspaceId}
          eventId={voidingEvent._id}
          eventDescription={`${PUNCH_TYPE_LABEL[voidingEvent.punchType] ?? voidingEvent.punchType} at ${dayjs(voidingEvent.timestamp).format('HH:mm')}`}
          onSuccess={() => {
            setVoidingEvent(null);
            setReloadKey((k) => k + 1);
            onChange?.();
          }}
        />
      )}
    </>
  );
}
