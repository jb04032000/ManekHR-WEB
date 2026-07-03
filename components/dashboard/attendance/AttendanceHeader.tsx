'use client';
import { useState } from 'react';
import {
  Button,
  Select,
  Space,
  Segmented,
  Tooltip,
  Dropdown,
  Modal,
  Form,
  TimePicker,
  Alert,
  App,
} from 'antd';
import type { MenuProps } from 'antd';
import {
  DownloadOutlined,
  LockOutlined,
  CheckOutlined,
  DownOutlined,
  LoadingOutlined,
  GiftOutlined,
  ReloadOutlined,
  ScheduleOutlined,
  ClockCircleOutlined,
  MoreOutlined,
} from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import dayjs, { Dayjs } from 'dayjs';
import utc from 'dayjs/plugin/utc';
import { DateNavigator } from '@/components/ui';
import { ATTENDANCE_STATUSES, monthOptions, parseApiError, todayISO } from '@/lib/utils';
import type {
  AttendanceStatus,
  TeamMember,
  AttendanceRecord,
  BulkMarkAttendanceResult,
  MarkAttendancePayload,
} from '@/types';
import type { ATTENDANCE_EXPORT_FIELDS } from '@/lib/exportFields/attendanceFields';
import { useTranslations } from 'next-intl';

dayjs.extend(utc);

const MONTHS = monthOptions(12);
const { Option } = Select;

export interface AttendanceHeaderProps {
  view: 'daily' | 'monthly';
  onViewChange: (v: 'daily' | 'monthly') => void;
  date: string;
  onDateChange: (d: string) => void;
  month: number;
  year: number;
  onMonthYearChange: (month: number, year: number) => void;
  onExport: () => void;
  canExportPdf: boolean;
  canExportExcel: boolean;
  canBulkMark: boolean;
  bulkStatus: AttendanceStatus;
  onBulkStatusChange: (s: AttendanceStatus) => void;
  onBulkMark: () => void;
  unmarkedCount: number;
  marking: boolean;
  loading: boolean;
  onReload: () => void;
  exportFields?: typeof ATTENDANCE_EXPORT_FIELDS;
  workspaceId?: string;
  /** Full member objects for the current day's view - used for shift-times bulk action */
  members?: TeamMember[];
  /** Current day's attendance records - used for shift-times bulk action */
  records?: AttendanceRecord[];
  /** Whether any filter is currently active - scopes bulk ops to visible members */
  hasActiveFilters?: boolean;
  /** Unmarked count within the currently filtered set */
  filteredUnmarkedCount?: number;
  /** Bulk mark handler that accepts per-record checkIn/checkOut */
  onBulkMarkWithTimes?: (payload: {
    records: Array<{
      teamMemberId: string;
      date: string;
      status: AttendanceStatus;
      checkIn?: string | null;
      checkOut?: string | null;
    }>;
  }) => Promise<BulkMarkAttendanceResult | AttendanceRecord[]>;
  /**
   * Opens the whole-month / selected-days bulk-mark (regularization) modal.
   * Provided only to owner / `attendance.record.mark@all` callers - the page
   * decides; the button hides entirely when absent. -> BulkMarkMonthModal.
   */
  onBulkMonth?: () => void;
}

export function AttendanceHeader({
  view,
  onViewChange,
  date,
  onDateChange,
  month,
  year,
  onMonthYearChange,
  onExport,
  canExportPdf,
  canExportExcel,
  canBulkMark,
  bulkStatus,
  onBulkStatusChange,
  onBulkMark,
  unmarkedCount,
  marking,
  loading,
  onReload,
  members = [],
  records = [],
  onBulkMarkWithTimes,
  hasActiveFilters = false,
  filteredUnmarkedCount,
  onBulkMonth,
}: AttendanceHeaderProps) {
  const t = useTranslations('attendance');
  const th = useTranslations('attendance.header');
  const tCommon = useTranslations('common');
  const { message } = App.useApp();
  const router = useRouter();
  const [customOpen, setCustomOpen] = useState(false);
  const [customForm] = Form.useForm();
  const [shiftMarking, setShiftMarking] = useState(false);
  const [customMarking, setCustomMarking] = useState(false);

  const isFutureDate = date > todayISO();
  const isToday = date === todayISO();
  const memberIds = new Set(members.map((m) => m.id));
  const hasExistingTimes = records.some((r) => {
    const mid =
      typeof r.teamMemberId === 'string' ? r.teamMemberId : (r.teamMemberId as { _id: string })._id;
    return memberIds.has(mid) && (r.checkIn || r.checkOut);
  });

  const statusOptions: MenuProps['items'] = ATTENDANCE_STATUSES.map((s) => ({
    key: s.value,
    label: s.label,
    onClick: () => onBulkStatusChange(s.value as AttendanceStatus),
  }));

  const currentLabel =
    ATTENDANCE_STATUSES.find((s) => s.value === bulkStatus)?.label ?? t('present');

  const isExportLocked = !canExportPdf && !canExportExcel;
  const effectiveCount =
    hasActiveFilters && filteredUnmarkedCount !== undefined ? filteredUnmarkedCount : unmarkedCount;
  const isEmpty = effectiveCount === 0;

  /**
   * Mark all members at their own shift start/end times.
   * `which` selects which times to write - partial support lets operators handle:
   *  - marking mid-shift (check-in only)
   *  - back-filling end of shift (check-out only)
   *  - full day (both)
   * Overnight shifts (endTime ≤ startTime) get check-out shifted +1 day.
   */
  const handleMarkAtShiftTimes = async (which: 'in' | 'out' | 'both') => {
    if (!onBulkMarkWithTimes || members.length === 0) return;
    setShiftMarking(true);
    try {
      // Local dayjs so check-in/out are stored at the operator's local times
      // (matches row-level SetTimesPopover behavior). `date` anchor still uses
      // UTC midnight - it's a day bucket, not an event timestamp.
      const dateLocal = dayjs(date).startOf('day');
      const dateUtc = dayjs.utc(date).startOf('day');
      const recordsPayload = members
        .filter((m) => m.shift)
        .map((m) => {
          const start = m.shift?.startTime ?? '09:00';
          const end = m.shift?.endTime ?? '18:00';
          const [sH, sM] = start.split(':').map(Number);
          const [eH, eM] = end.split(':').map(Number);
          const isOvernight = end <= start;
          const outBase = isOvernight ? dateLocal.add(1, 'day') : dateLocal;
          const record: MarkAttendancePayload = {
            teamMemberId: m.id,
            date: dateUtc.toISOString(),
            status: 'present',
          };
          if (which === 'in' || which === 'both') {
            record.checkIn = dateLocal.hour(sH).minute(sM).second(0).toISOString();
          }
          if (which === 'out' || which === 'both') {
            record.checkOut = outBase.hour(eH).minute(eM).second(0).toISOString();
          }
          return record;
        });

      if (recordsPayload.length === 0) {
        message.warning(th('toast.noShifts'));
        return;
      }

      const res = await onBulkMarkWithTimes({ records: recordsPayload });
      const marked = (res as BulkMarkAttendanceResult).marked ?? recordsPayload.length;
      const skippedLocked = (res as BulkMarkAttendanceResult).skippedLocked ?? 0;
      const label =
        which === 'both'
          ? th('toast.labelCheckInOut')
          : which === 'in'
            ? th('toast.labelCheckIn')
            : th('toast.labelCheckOut');
      message.success(th('toast.markedWithLabel', { marked, label, skipped: skippedLocked }));
      // onReload intentionally skipped - hook's handleBulkMarkWithTimes patches
      // records optimistically. Full reload would cause the re-render we just avoided.
    } catch (e) {
      message.error(parseApiError(e));
    } finally {
      setShiftMarking(false);
    }
  };

  /** Mark all members at a single custom check-in/out time */
  const handleSubmitCustom = async () => {
    if (!onBulkMarkWithTimes || members.length === 0) return;
    let v: { checkIn: Dayjs | null; checkOut: Dayjs | null };
    try {
      v = await customForm.validateFields();
    } catch {
      return;
    }
    if (v.checkOut && !v.checkIn) {
      message.error(th('toast.checkoutWithoutCheckin'));
      return;
    }
    setCustomMarking(true);
    try {
      // Local dayjs for time ISOs (match operator-entered times); UTC only for day anchor.
      const dateLocal = dayjs(date).startOf('day');
      const dateUtc = dayjs.utc(date).startOf('day');
      const toIso = (t: Dayjs | null) =>
        t ? dateLocal.hour(t.hour()).minute(t.minute()).second(0).toISOString() : null;

      const recordsPayload = members.map((m) => ({
        teamMemberId: m.id,
        date: dateUtc.toISOString(),
        status: 'present' as AttendanceStatus,
        checkIn: toIso(v.checkIn),
        checkOut: toIso(v.checkOut),
      }));

      const res = await onBulkMarkWithTimes({ records: recordsPayload });
      const marked = (res as BulkMarkAttendanceResult).marked ?? recordsPayload.length;
      const skippedLocked = (res as BulkMarkAttendanceResult).skippedLocked ?? 0;
      message.success(th('toast.marked', { marked, skipped: skippedLocked }));
      customForm.resetFields();
      setCustomOpen(false);
      // onReload skipped - optimistic patch already done by hook.
    } catch (e) {
      message.error(parseApiError(e));
    } finally {
      setCustomMarking(false);
    }
  };

  // Shift-time bulk-mark options - shared by the inline "Bulk with times" dropdown
  // (lg+) and the compact "More" overflow menu (below lg) so both stay in sync.
  const shiftTimesMenuItems: MenuProps['items'] = [
    {
      key: 'shift-in',
      icon: <ScheduleOutlined />,
      label: th('checkInOnlyShift'),
      disabled: members.filter((m) => m.shift).length === 0 || shiftMarking,
      onClick: (e) => {
        e.domEvent.stopPropagation();
        handleMarkAtShiftTimes('in');
      },
    },
    {
      key: 'shift-out',
      icon: <ScheduleOutlined />,
      label: th('checkOutOnlyShift'),
      disabled: members.filter((m) => m.shift).length === 0 || shiftMarking,
      onClick: (e) => {
        e.domEvent.stopPropagation();
        handleMarkAtShiftTimes('out');
      },
    },
    {
      key: 'shift-both',
      icon: <ScheduleOutlined />,
      label: th('bothShift'),
      disabled: members.filter((m) => m.shift).length === 0 || shiftMarking,
      onClick: (e) => {
        e.domEvent.stopPropagation();
        handleMarkAtShiftTimes('both');
      },
    },
    { type: 'divider' },
    {
      key: 'custom-time',
      icon: <ClockCircleOutlined />,
      label: th('markAtCustom'),
      onClick: (e) => {
        e.domEvent.stopPropagation();
        customForm.resetFields();
        setCustomOpen(true);
      },
    },
  ];

  // Overflow ("More") menu shown below lg - collapses every secondary action into a
  // single kebab so the toolbar stays one tidy row (primary CTA + ⋯) at tablet /
  // laptop widths. lg+ renders these as inline buttons instead. Handlers mirror the
  // inline buttons exactly. -> holidays route, export, bulk-month, reload.
  const moreMenuItems: MenuProps['items'] = [
    ...(view === 'daily' && canBulkMark && onBulkMarkWithTimes
      ? [
          isFutureDate
            ? {
                key: 'bwt',
                icon: <ScheduleOutlined />,
                label: th('bulkWithTimes'),
                disabled: true,
              }
            : {
                key: 'bwt',
                icon: <ScheduleOutlined />,
                label: th('bulkWithTimes'),
                children: shiftTimesMenuItems,
              },
        ]
      : []),
    ...(onBulkMonth
      ? [
          {
            key: 'bulk-month',
            icon: <ScheduleOutlined />,
            label: 'Bulk month',
            onClick: () => onBulkMonth(),
          },
        ]
      : []),
    {
      key: 'export',
      icon: <DownloadOutlined />,
      label: th('export'),
      disabled: isExportLocked,
      onClick: isExportLocked ? undefined : () => onExport(),
    },
    {
      key: 'holidays',
      icon: <GiftOutlined />,
      label: th('manageHolidays'),
      onClick: () => router.push('/dashboard/holidays'),
    },
    // Reload is intentionally NOT here - it lives as a standalone always-visible
    // button beside the ⋯ menu (owner wants one-tap refresh, not buried).
  ];

  return (
    <div className="flex w-full flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between lg:gap-3">
      {/* LEFT zone - view toggle + date navigator. Plain flex row (not <Space>): Space
          wraps each child in an inline-block whose line-box added a ~3px baseline gap
          that pushed the Segmented above the date buttons. Flex items have no such gap,
          and items-center keeps the Segmented + DateNavigator on one centre-line. */}
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:gap-2">
        {/* View toggle row. On small screens the refresh + ⋯ ride on this same row,
            pinned right (ml-auto); at 2xl they move into the right action cluster. */}
        <div className="flex items-center gap-2">
          <Segmented
            value={view}
            onChange={(v) => onViewChange(v as 'daily' | 'monthly')}
            options={[
              { label: t('viewModeDaily'), value: 'daily' },
              { label: t('viewModeMonthly'), value: 'monthly' },
            ]}
          />
          <div className="ml-auto flex items-center gap-2 lg:hidden">
            <Button
              icon={<ReloadOutlined />}
              onClick={onReload}
              loading={loading}
              aria-label={th('refreshAria')}
            />
            <Dropdown menu={{ items: moreMenuItems }} trigger={['click']} placement="bottomRight">
              <Button icon={<MoreOutlined />} aria-label="More actions" />
            </Dropdown>
          </div>
        </div>
        {view === 'daily' ? (
          // disableFuture: attendance records the past/present, never the future —
          // blocks picking or stepping to a future day (BE also rejects it).
          //
          // Small-screen only: stretch the date row full-width and let the LAST control
          // (Today) flex-grow into the leftover space so the row reads as a filled bar
          // instead of trailing off with dead space. Done via scoped arbitrary variants
          // on the shared DateNavigator's inner AntD Space (component left untouched so
          // other modules are unaffected); reverts to natural inline width at lg+.
          <div className="w-full lg:w-auto [&_.ant-space]:flex [&_.ant-space]:w-full lg:[&_.ant-space]:inline-flex lg:[&_.ant-space]:w-auto [&_.ant-space-item:last-child]:flex-1 lg:[&_.ant-space-item:last-child]:flex-none [&_.ant-space-item:last-child_.ant-btn]:w-full lg:[&_.ant-space-item:last-child_.ant-btn]:w-auto">
            <DateNavigator date={date} onChange={onDateChange} disableFuture />
          </div>
        ) : (
          <Select
            value={`${month}-${year}`}
            onChange={(v) => {
              const [m, y] = v.split('-');
              onMonthYearChange(Number(m), Number(y));
            }}
            className="w-[150px]"
          >
            {MONTHS.map((m) => (
              <Option key={`${m.month}-${m.year}`} value={`${m.month}-${m.year}`}>
                {m.label}
              </Option>
            ))}
          </Select>
        )}
      </div>

      {/* RIGHT cluster - actions. Full width on small so the primary "Mark all" CTA
          fills its own row (the refresh + ⋯ live up on the toggle row instead). At 2xl
          it goes auto-width and shows the full inline action set (all six buttons fit on
          one row alongside the date controls). */}
      <div className="flex w-full items-center gap-2 lg:w-auto">
        {/* PRIMARY - bulk mark compound button (or locked upgrade button) */}
        {view === 'daily' &&
          (!canBulkMark ? (
            <Tooltip title={th('upgradeBulkMark')}>
              <Button icon={<LockOutlined />} disabled className="w-full lg:w-auto">
                {th('bulkMark')}
              </Button>
            </Tooltip>
          ) : (
            <Tooltip
              title={
                isEmpty
                  ? hasActiveFilters
                    ? th('allMarkedFiltered')
                    : th('allMarked')
                  : th('markBulkTooltip', {
                      count: effectiveCount,
                      scope: hasActiveFilters ? 'filtered ' : '',
                      status: currentLabel,
                    })
              }
            >
              <div
                // Primary CTA - full width on small screens (its own row), auto width
                // inline at 2xl.
                className="w-full lg:w-auto"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  borderRadius: 10,
                  background: isEmpty ? undefined : 'var(--cr-primary, var(--cr-primary))',
                  // Match the theme controlHeight (38 -> lib/theme.ts) so this
                  // hand-rolled compound button aligns with the sibling <Button>s
                  // and the left-zone Segmented (was 36 -> ragged baseline on wrap).
                  height: 38,
                  boxSizing: 'border-box',
                  cursor: isEmpty ? 'not-allowed' : 'pointer',
                  opacity: isEmpty ? 0.5 : 1,
                  userSelect: 'none',
                  overflow: 'hidden',
                  border: isEmpty ? '1px solid var(--cr-neutral-300)' : 'none',
                }}
              >
                {/* Main action zone - flex:1 so it fills the full-width mobile
                        button and pushes the caret to the trailing edge. */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flex: 1,
                    gap: 6,
                    padding: '4px 12px',
                    height: '100%',
                    color: isEmpty ? 'rgba(0,0,0,0.25)' : 'white',
                    fontSize: 14,
                    fontWeight: 500,
                  }}
                  onClick={() => {
                    if (!isEmpty && !marking) onBulkMark();
                  }}
                >
                  {marking ? (
                    <LoadingOutlined style={{ fontSize: 13 }} />
                  ) : (
                    <CheckOutlined style={{ fontSize: 13 }} />
                  )}
                  <span>
                    {hasActiveFilters
                      ? th('markCountAs', { count: effectiveCount, status: currentLabel })
                      : th('markAllCountAs', { count: effectiveCount, status: currentLabel })}
                  </span>
                </div>

                {/* Divider */}
                <div
                  style={{
                    width: 1,
                    height: '55%',
                    background: isEmpty ? 'var(--cr-neutral-300)' : 'rgba(255,255,255,0.35)',
                    flexShrink: 0,
                  }}
                />

                {/* Dropdown zone */}
                <Dropdown
                  menu={{ items: statusOptions, selectedKeys: [bulkStatus] }}
                  trigger={['click']}
                  disabled={isEmpty}
                  placement="bottomRight"
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '4px 10px',
                      height: '100%',
                      color: isEmpty ? 'rgba(0,0,0,0.25)' : 'white',
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <DownOutlined style={{ fontSize: 10 }} />
                  </div>
                </Dropdown>
              </div>
            </Tooltip>
          ))}

        {/* Full inline action set - 2xl only. Below 2xl these collapse into the ⋯
            menu (moreMenuItems) so the toolbar never wraps into a crammed block. */}
        <div className="hidden items-center gap-2 2xl:flex">
          {/* Time-based bulk mark - disabled for future dates */}
          {view === 'daily' &&
            canBulkMark &&
            onBulkMarkWithTimes &&
            (isFutureDate ? (
              <Tooltip title={th('cantMarkFuture')}>
                <Button icon={<ScheduleOutlined />} disabled>
                  {th('bulkWithTimes')}
                </Button>
              </Tooltip>
            ) : (
              <Dropdown trigger={['click']} menu={{ items: shiftTimesMenuItems }}>
                <Button icon={<ScheduleOutlined />} loading={shiftMarking || customMarking}>
                  {th('bulkWithTimes')}
                </Button>
              </Dropdown>
            ))}

          {/* Whole-month / selected-days bulk mark (regularization). Owner / mark@all
              only - the page passes onBulkMonth conditionally. -> BulkMarkMonthModal */}
          {onBulkMonth && (
            <Tooltip title="Mark attendance in bulk for a whole month or selected days">
              <Button icon={<ScheduleOutlined />} onClick={onBulkMonth}>
                Bulk month
              </Button>
            </Tooltip>
          )}

          {/* Export - always present; primary-outline on daily, plain on monthly */}
          {isExportLocked ? (
            <Tooltip title={th('upgradeExport')}>
              <Button icon={<LockOutlined />} disabled>
                {th('export')}
              </Button>
            </Tooltip>
          ) : (
            <Button
              icon={<DownloadOutlined />}
              onClick={onExport}
              style={
                view === 'daily'
                  ? { borderColor: 'var(--cr-primary)', color: 'var(--cr-primary)' }
                  : undefined
              }
            >
              {th('export')}
            </Button>
          )}

          <Tooltip title={th('manageHolidays')}>
            <Button
              icon={<GiftOutlined />}
              href="/dashboard/holidays"
              aria-label={th('manageHolidays')}
            />
          </Tooltip>

          {/* Refresh - inline here on 2xl; on small screens it lives on the view-toggle
              row (kept out of the ⋯ menu either way). */}
          <Button
            icon={<ReloadOutlined />}
            onClick={onReload}
            loading={loading}
            aria-label={th('refreshAria')}
          />
        </div>

        {/* Compact actions (lg -> 2xl): the date controls + all six buttons don't fit on
            one row until 2xl, so on laptops show primary + a standalone refresh + a ⋯ menu
            (the wide buttons live in the menu). Below lg the refresh + ⋯ ride the toggle
            row instead; at 2xl the full inline set above replaces this. */}
        <div className="hidden items-center gap-2 lg:flex 2xl:hidden">
          <Button
            icon={<ReloadOutlined />}
            onClick={onReload}
            loading={loading}
            aria-label={th('refreshAria')}
          />
          <Dropdown menu={{ items: moreMenuItems }} trigger={['click']} placement="bottomRight">
            <Button icon={<MoreOutlined />} aria-label="More actions" />
          </Dropdown>
        </div>

        {/* Custom-time modal - rendered ONCE; opened from the inline "Bulk with times"
            dropdown (lg+) OR the ⋯ menu (below lg). Portals to body, so tree position
            is moot. */}
        {view === 'daily' && canBulkMark && onBulkMarkWithTimes && !isFutureDate && (
          <Modal
            title={th('customTimeModal.title')}
            open={customOpen}
            onCancel={() => {
              setCustomOpen(false);
              customForm.resetFields();
            }}
            footer={
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <Button
                  onClick={() => {
                    setCustomOpen(false);
                    customForm.resetFields();
                  }}
                >
                  {tCommon('cancel')}
                </Button>
                <Button type="primary" loading={customMarking} onClick={handleSubmitCustom}>
                  {th('customTimeModal.applyAll')}
                </Button>
              </div>
            }
            width={400}
            destroyOnHidden
          >
            {isToday && hasExistingTimes && (
              <Alert
                type="warning"
                showIcon
                title={th('customTimeModal.overrideWarning')}
                style={{ marginBottom: 16 }}
              />
            )}
            <Form form={customForm} layout="vertical">
              <Form.Item
                name="checkIn"
                label={th('customTimeModal.checkInLabel')}
                rules={[{ required: true, message: th('customTimeModal.checkInRequired') }]}
              >
                <TimePicker format="hh:mm a" use12Hours minuteStep={5} style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item name="checkOut" label={th('customTimeModal.checkOutLabel')}>
                <TimePicker format="hh:mm a" use12Hours minuteStep={5} style={{ width: '100%' }} />
              </Form.Item>
            </Form>
          </Modal>
        )}
      </div>
    </div>
  );
}
