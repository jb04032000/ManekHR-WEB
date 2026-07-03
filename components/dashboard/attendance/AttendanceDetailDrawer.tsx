'use client';
import { useEffect, useState } from 'react';
import { App, Drawer, Button, Input, Tooltip, Form, TimePicker, Alert } from 'antd';
import { WarningOutlined, EditOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import { useTranslations } from 'next-intl';
import { DsAvatar, STATUS_COLORS } from '@/components/ui';
import type { TeamMember, AttendanceRecord, AttendanceStatus } from '@/types';
import { MoonOutlined } from '@ant-design/icons';
import { AttendanceEventTimeline } from './AttendanceEventTimeline';
import { RaiseRegularizationModal } from './RaiseRegularizationModal';
import { SourceBadge, LockBadge } from './SourceBadge';
import { usePermission } from '@/hooks/usePermission';
import { updateAttendance } from '@/lib/actions';
import { parseApiError } from '@/lib/utils';

dayjs.extend(utc);

// ── Types ────────────────────────────────────────────────────────────────────

export interface StatusHistoryEntry {
  status: string;
  changedAt: string;
  changedBy: { name?: string; email?: string } | string | undefined;
}

// ── Props ────────────────────────────────────────────────────────────────────

export interface AttendanceDetailDrawerProps {
  open: boolean;
  onClose: () => void;
  workspaceId: string;
  selectedMember: TeamMember | null;
  date: string;
  record: AttendanceRecord | null;
  pendingStatus: Record<string, AttendanceStatus>;
  failedIds: Set<string>;
  onStatusChange: (status: AttendanceStatus) => void;
  drawerNote: string;
  onNoteChange: (note: string) => void;
  onSaveNote: () => Promise<void>;
  savingNote: boolean;
  onReload?: () => void;
  carryoverMap?: Record<string, AttendanceRecord>;
}

// ── Component ────────────────────────────────────────────────────────────────

export function AttendanceDetailDrawer({
  open,
  onClose,
  workspaceId,
  selectedMember,
  date,
  record,
  pendingStatus,
  failedIds,
  onStatusChange,
  drawerNote,
  onNoteChange,
  onSaveNote,
  savingNote,
  onReload,
  carryoverMap,
}: AttendanceDetailDrawerProps) {
  const t = useTranslations('attendance');
  const td = useTranslations('attendance.detailDrawer');
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [raiseModalOpen, setRaiseModalOpen] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);
  const [savingTimes, setSavingTimes] = useState(false);
  const [lockError, setLockError] = useState<string | null>(null);
  const canRaiseRegularization = usePermission('attendance', 'manage_regularizations');

  // Derived: timeline remounts naturally whenever record identity / status /
  // history length changes, or when an in-drawer save bumps reloadTick.
  // Avoids setState-in-effect anti-pattern.
  const historyLen = record?.statusHistory?.length ?? 0;
  const timelineKey = `${record?._id ?? ''}:${record?.status ?? ''}:${historyLen}:${reloadTick}`;

  // Populate TimePickers when drawer opens or record changes. Calls Antd Form
  // API only (external system) - no React setState here, so the
  // setState-in-effect rule does not fire.
  useEffect(() => {
    if (!open) return;
    form.setFieldsValue({
      checkInTime: record?.checkIn ? dayjs(record.checkIn) : null,
      checkOutTime: record?.checkOut ? dayjs(record.checkOut) : null,
    });
  }, [open, record?.checkIn, record?.checkOut, form]);

  const getEffectiveStatus = (memberId: string): string =>
    pendingStatus[memberId] ?? record?.status ?? 'unmarked';

  const handleSaveTimes = async () => {
    if (!selectedMember || !workspaceId) return;
    const existing = record;
    if (!existing) {
      message.warning(td('noRecordWarning'));
      return;
    }
    setSavingTimes(true);
    setLockError(null);
    try {
      const values = await form.validateFields();
      const dateOnly = dayjs.utc(date).startOf('day');
      const checkInMoment = values.checkInTime
        ? dateOnly.hour(values.checkInTime.hour()).minute(values.checkInTime.minute()).second(0)
        : null;
      let checkOutMoment = values.checkOutTime
        ? dateOnly.hour(values.checkOutTime.hour()).minute(values.checkOutTime.minute()).second(0)
        : null;
      // Cross-midnight: checkout before or equal to checkin in clock time → next calendar day
      if (checkOutMoment && checkInMoment && !checkOutMoment.isAfter(checkInMoment)) {
        checkOutMoment = checkOutMoment.add(1, 'day');
      }
      const checkInIso = checkInMoment ? checkInMoment.toISOString() : null;
      const checkOutIso = checkOutMoment ? checkOutMoment.toISOString() : null;

      await updateAttendance(workspaceId, existing._id, {
        checkIn: checkInIso,
        checkOut: checkOutIso,
      });
      message.success(td('timesSaved'));
      setReloadTick((t) => t + 1);
      onReload?.();
    } catch (e: unknown) {
      const errMsg = parseApiError(e);
      if (errMsg.toLowerCase().includes('locked')) {
        setLockError(errMsg);
      } else {
        message.error(errMsg);
      }
    } finally {
      setSavingTimes(false);
    }
  };

  return (
    <Drawer
      title={t('attendanceDetails')}
      placement="right"
      size="large"
      onClose={onClose}
      open={open}
      afterOpenChange={(isOpen) => {
        // Reset the transient salary-lock banner whenever the drawer reopens
        // (clean slate per session). Setting state inside an external-event
        // callback (Antd Drawer) is fine - not setState-in-effect.
        if (isOpen) setLockError(null);
      }}
    >
      {selectedMember && (
        <div className="space-y-6">
          {/* Employee header */}
          <div className="flex items-center gap-4 border-b pb-4">
            <DsAvatar name={selectedMember.name} size={56} />
            <div className="flex-1">
              <h3 className="m-0 text-lg font-semibold">{selectedMember.name}</h3>
              <p className="m-0 text-sm text-gray-700">
                {selectedMember.designation ?? td('employee')}
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className="rounded bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                {dayjs(date).format('DD-MM-YYYY')}
              </div>
              {canRaiseRegularization && (
                <Button
                  type="default"
                  size="small"
                  icon={<EditOutlined />}
                  onClick={() => setRaiseModalOpen(true)}
                >
                  {td('raiseRegularization')}
                </Button>
              )}
            </div>
          </div>

          {/* Raise Regularization Modal */}
          {raiseModalOpen && (
            <RaiseRegularizationModal
              open={raiseModalOpen}
              memberId={selectedMember.id}
              memberName={selectedMember.name}
              date={date}
              currentStatus={record?.status ?? 'unmarked'}
              onClose={() => setRaiseModalOpen(false)}
              onSuccess={() => {
                setRaiseModalOpen(false);
                setReloadTick((t) => t + 1);
              }}
            />
          )}

          {/* Status segmented buttons - always editable (D3 invariant) */}
          <div>
            <label className="mb-2 block text-xs font-bold tracking-wide text-gray-700 uppercase">
              <span>{t('status').toUpperCase()}</span>
              {/* D-26: source badge next to status header */}
              {record?.dominantSource && <SourceBadge source={record.dominantSource} />}
              {/* D-27: lock badge when payroll generated + locked */}
              {record?.isLocked && <LockBadge />}
            </label>
            <div className="flex items-center gap-2">
              {(['present', 'half_day', 'absent', 'on_leave'] as const).map((s) => {
                const effectiveDrawerStatus = getEffectiveStatus(selectedMember.id);
                const isActive = effectiveDrawerStatus === s;
                const color = STATUS_COLORS[s];
                const isOvernightBlocked = !record && !!carryoverMap?.[selectedMember.id];
                const isFutureDate = date > new Date().toISOString().slice(0, 10);
                const futureLocked = isFutureDate && (s === 'present' || s === 'absent');
                const isDisabled = isOvernightBlocked || futureLocked;
                const tooltipText = isOvernightBlocked
                  ? td('tooltipOvernightBlock')
                  : futureLocked
                    ? td('tooltipFutureBlock')
                    : undefined;
                return (
                  <Tooltip key={s} title={tooltipText}>
                    <Button
                      type={isActive ? 'primary' : 'default'}
                      disabled={isDisabled}
                      style={
                        isActive
                          ? {
                              backgroundColor: color.text,
                              borderColor: color.text,
                              flex: 1,
                            }
                          : { flex: 1 }
                      }
                      onClick={() => {
                        if (!isActive) onStatusChange(s);
                      }}
                    >
                      {s.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                    </Button>
                  </Tooltip>
                );
              })}

              {/* Pending dot */}
              {selectedMember.id in pendingStatus && (
                <Tooltip title={td('tooltipSaving')}>
                  <span
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: '50%',
                      background: 'var(--cr-neutral-400)',
                      display: 'inline-block',
                      flexShrink: 0,
                    }}
                    className="animate-pulse"
                  />
                </Tooltip>
              )}

              {/* Error state */}
              {!(selectedMember.id in pendingStatus) && failedIds.has(selectedMember.id) && (
                <Tooltip title={td('tooltipSaveFailed')}>
                  <WarningOutlined
                    style={{ color: 'var(--cr-danger-500)', fontSize: 14, flexShrink: 0 }}
                  />
                </Tooltip>
              )}
            </div>

            {/* Inline error banner */}
            {!(selectedMember.id in pendingStatus) && failedIds.has(selectedMember.id) && (
              <div className="mt-2 flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-1.5">
                <WarningOutlined style={{ color: 'var(--cr-danger-500)', fontSize: 12 }} />
                <span className="text-xs text-red-700">{td('statusChangeFailed')}</span>
              </div>
            )}

            {record?.computeReason ? (
              <p className="mt-2 text-sm text-gray-700">{record.computeReason}</p>
            ) : null}
          </div>

          {/* Check In / Check Out TimePickers */}
          <div>
            <label className="mb-2 block text-xs font-bold tracking-wide text-gray-700 uppercase">
              {td('checkInOutHeader')}
            </label>
            {lockError && (
              <Tooltip title={td('tooltipLocked')}>
                <Alert type="error" showIcon title={lockError} style={{ marginBottom: 12 }} />
              </Tooltip>
            )}
            <Form form={form} layout="vertical">
              <div style={{ display: 'flex', gap: 12 }}>
                <Form.Item
                  name="checkInTime"
                  label={td('checkInLabel')}
                  style={{ flex: 1, marginBottom: 8 }}
                >
                  <TimePicker
                    format="hh:mm a"
                    use12Hours
                    minuteStep={5}
                    allowClear
                    style={{ width: '100%' }}
                  />
                </Form.Item>
                <Form.Item
                  name="checkOutTime"
                  label={td('checkOutLabel')}
                  style={{ flex: 1, marginBottom: 8 }}
                >
                  <TimePicker
                    format="hh:mm a"
                    use12Hours
                    minuteStep={5}
                    allowClear
                    style={{ width: '100%' }}
                  />
                </Form.Item>
              </div>
              <Button
                type="primary"
                size="small"
                loading={savingTimes}
                onClick={handleSaveTimes}
                disabled={!record}
              >
                {td('saveTimes')}
              </Button>
              {!record && selectedMember && carryoverMap?.[selectedMember.id] ? (
                <div
                  className="mt-2 flex items-start gap-2 rounded-md px-3 py-2"
                  style={{
                    background: 'var(--cr-indigo-50)',
                    border: '1px solid var(--cr-indigo-100)',
                  }}
                >
                  <MoonOutlined
                    style={{ color: 'var(--cr-primary-hover)', marginTop: 2, flexShrink: 0 }}
                  />
                  <span className="text-xs text-indigo-700">
                    {td('overnightHint')} <strong>{td('closeOvernightShift')}</strong>{' '}
                    {td('overnightHintTail')}
                  </span>
                </div>
              ) : (
                !record && <span className="ml-2 text-xs text-faint">{td('markFirst')}</span>
              )}
            </Form>
          </div>

          {/* Note */}
          <div>
            <label className="mb-2 block text-xs font-bold tracking-wide text-gray-700 uppercase">
              {t('note').toUpperCase()}
            </label>
            <Input.TextArea
              value={drawerNote}
              onChange={(e) => onNoteChange(e.target.value)}
              placeholder={t('addNotePlaceholder')}
              rows={4}
              className="mb-2"
            />
            {drawerNote.trim() && (
              <Button
                type="primary"
                size="small"
                onClick={onSaveNote}
                loading={savingNote}
                className="mt-3"
              >
                {t('saveNote')}
              </Button>
            )}
          </div>

          {/* Event timeline - replaces old status-history section (D10) */}
          {selectedMember && date && (
            <div style={{ marginTop: 16 }}>
              <label className="mb-3 block text-xs font-bold tracking-wide text-gray-700 uppercase">
                {td('eventTimeline')}
              </label>
              <AttendanceEventTimeline
                key={timelineKey}
                workspaceId={workspaceId}
                memberId={selectedMember.id}
                date={date}
              />
            </div>
          )}
        </div>
      )}
    </Drawer>
  );
}
