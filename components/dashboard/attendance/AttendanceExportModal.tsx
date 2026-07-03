'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Radio,
  Typography,
  Divider,
  Button,
  Space,
  Switch,
  Spin,
  Select,
  Tooltip,
  App,
  DatePicker,
} from 'antd';
import dayjs from 'dayjs';
import { LockOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import { DsModal } from '@/components/ui';
import { FieldSelector } from '@/components/export/FieldSelector';
import { useExport } from '@/hooks/useExport';
import { useWorkspaceStore, useSubscriptionStore } from '@/lib/store';
import { listAttendance } from '@/lib/actions';
import { getOrFetchPlatformDefaults } from '@/lib/export/brandingCache';
import {
  ATTENDANCE_EXPORT_FIELDS,
  type AttendanceExportRow,
  formatAttendanceStatus,
  formatAttendanceDate,
  formatAttendanceDayOfWeek,
  formatAttendanceTime,
} from '@/lib/exportFields/attendanceFields';
import { generateAttendancePdf } from '@/lib/export/generateAttendancePdf';
import type { ExportFormat, ExportBrandingOptions } from '@/lib/exportFields/types';
import type { AttendanceRecord, TeamMember, BrandingAssets } from '@/types';

interface Props {
  open: boolean;
  onClose: () => void;
  workspaceId: string;
  view: 'daily' | 'monthly';
  date?: string;
  month?: number;
  year?: number;
  members: TeamMember[];
  records?: AttendanceRecord[];
  monthlyRecords?: Record<string, Record<string, string>>;
}

const DEFAULT_FIELD_KEYS = ATTENDANCE_EXPORT_FIELDS.filter((f) => f.defaultEnabled).map(
  (f) => f.key,
);

export function AttendanceExportModal({
  open,
  onClose,
  workspaceId,
  view,
  date,
  month,
  year,
  members,
  records,
  monthlyRecords,
}: Props) {
  const t = useTranslations('attendance.exportModal');
  const { message } = App.useApp();
  const { exporting, exportData } = useExport();
  const { currentWorkspace } = useWorkspaceStore();
  const { entitlements, isHydrated } = useSubscriptionStore();

  const sfAccess = useCallback(
    (key: string) =>
      entitlements?.moduleAccess
        ?.find((m) => m.module === 'attendance')
        ?.subFeatures?.find((sf) => sf.key === key)?.access ?? 'locked',
    [entitlements, isHydrated],
  );

  const hasBrandingAccess =
    isHydrated &&
    !!entitlements &&
    (entitlements.moduleAccess
      ?.find((m) => m.module === 'settings')
      ?.subFeatures?.find((sf) => sf.key === 'pdf_branding')?.access ?? 'locked') !== 'locked';

  const canExportPdf = isHydrated && sfAccess('export_pdf') !== 'locked';
  const canExportExcel = isHydrated && sfAccess('export_excel') !== 'locked';

  const [format, setFormat] = useState<ExportFormat>('pdf');
  const [showCustomize, setShowCustomize] = useState(false);
  const [selectedFieldKeys, setSelectedFieldKeys] = useState<string[]>(DEFAULT_FIELD_KEYS);
  const [scope, setScope] = useState<'current' | 'date_range'>('current');
  const [rangeFrom, setRangeFrom] = useState<string>(date ?? dayjs().format('YYYY-MM-DD'));
  const [rangeTo, setRangeTo] = useState<string>(date ?? dayjs().format('YYYY-MM-DD'));

  const [platformDefaults, setPlatformDefaults] = useState<BrandingAssets | undefined>();
  const [loadingDefaults, setLoadingDefaults] = useState(false);
  const [includeHeaderLogo, setIncludeHeaderLogo] = useState(true);
  const [includeFooter, setIncludeFooter] = useState(true);
  const [includeWatermark, setIncludeWatermark] = useState(true);
  const [showExportDate, setShowExportDate] = useState(true);

  const [fetching, setFetching] = useState(false);

  // Fetch platform branding defaults when modal opens. Inline-fetch with
  // cancel flag - state updates resolve after the await, so the
  // setState-in-effect rule does not fire (post-await is not synchronous).
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      setLoadingDefaults(true);
      try {
        const defaults = await getOrFetchPlatformDefaults();
        if (!cancelled) setPlatformDefaults(defaults);
      } catch {
        if (!cancelled) setPlatformDefaults(undefined);
      } finally {
        if (!cancelled) setLoadingDefaults(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  // Reset transient form state (prefs, scope, date range, format) whenever
  // the modal opens. Driven by Antd Modal's afterOpenChange callback, which
  // is an external event - not a render-time effect.
  const handleAfterOpenChange = (isOpen: boolean) => {
    if (!isOpen) return;
    const savedPrefs = currentWorkspace?.exportPreferences;
    setIncludeHeaderLogo(savedPrefs?.includeHeaderLogo ?? true);
    setIncludeFooter(savedPrefs?.includeFooter ?? true);
    setIncludeWatermark(savedPrefs?.includeWatermark ?? true);
    setShowExportDate(savedPrefs?.showExportDate ?? true);
    setScope('current');
    if (date) {
      setRangeFrom(date);
      setRangeTo(date);
    }
    setFormat(!canExportPdf && canExportExcel ? 'excel' : 'pdf');
  };

  const brandingSource = useMemo(() => {
    if (hasBrandingAccess && currentWorkspace?.branding) return currentWorkspace.branding;
    return platformDefaults;
  }, [hasBrandingAccess, currentWorkspace?.branding, platformDefaults]);

  const hasHeaderLogo = !!brandingSource?.pdfHeaderLogo;
  const hasWatermark = !!brandingSource?.pdfWatermarkLogo;
  const hasFooter = !!brandingSource?.pdfFooterDetails;
  const hasAnyBranding = hasHeaderLogo || hasWatermark || hasFooter;

  const handleClose = () => {
    setFormat('pdf');
    setShowCustomize(false);
    setSelectedFieldKeys(DEFAULT_FIELD_KEYS);
    setShowExportDate(true);
    setScope('current');
    onClose();
  };

  const handleExport = async () => {
    if (view === 'daily' && selectedFieldKeys.length === 0) return;
    if (!workspaceId) return;

    let branding: ExportBrandingOptions | undefined;
    if (hasAnyBranding && format === 'pdf') {
      branding = {
        headerLogoUrl: hasHeaderLogo ? brandingSource!.pdfHeaderLogo : undefined,
        watermarkLogoUrl: hasWatermark ? brandingSource!.pdfWatermarkLogo : undefined,
        footerText: hasFooter ? brandingSource!.pdfFooterDetails : undefined,
        includeHeaderLogo: includeHeaderLogo && hasHeaderLogo,
        includeFooter: includeFooter && hasFooter,
        includeWatermark: includeWatermark && hasWatermark,
      };
    }

    const baseFilename = 'attendance';
    const filename = (() => {
      if (hasBrandingAccess && currentWorkspace?.name) {
        const workspacePart = currentWorkspace.name
          .toLowerCase()
          .trim()
          .replace(/\s+/g, '_')
          .replace(/[^a-z0-9_]/g, '');
        return `${workspacePart}_${baseFilename}`;
      }
      return baseFilename;
    })();

    if (view === 'daily') {
      await exportDaily(format, branding, filename);
    } else {
      await exportMonthly(format, branding, filename);
    }

    handleClose();
  };

  const exportDaily = async (
    exportFormat: ExportFormat,
    branding: ExportBrandingOptions | undefined,
    filename: string,
  ) => {
    setFetching(true);
    try {
      const attMap = new Map(
        (records ?? []).map((r) => {
          const mid = typeof r.teamMemberId === 'string' ? r.teamMemberId : r.teamMemberId._id;
          return [mid, r];
        }),
      );

      const rows: AttendanceExportRow[] = members.map((m) => {
        const record = attMap.get(m.id);
        return {
          memberId: m.id.slice(-6),
          memberName: m.name,
          designation: m.designation ?? '-',
          shiftName: m.shift?.name ?? '-',
          date: date ? formatAttendanceDate(date) : '-',
          dayOfWeek: date ? formatAttendanceDayOfWeek(date) : '-',
          status: record ? formatAttendanceStatus(record.status) : 'Unmarked',
          checkIn: formatAttendanceTime(record?.checkIn),
          checkOut: formatAttendanceTime(record?.checkOut),
          note: record?.note ?? '-',
          autoMarked: record?.autoMarked ? 'Yes' : 'No',
        };
      });

      const title = `Attendance Report - ${dayjs(date).format('DD MMM YYYY')}`;

      if (exportFormat === 'pdf' || exportFormat === 'both') {
        const orientation = selectedFieldKeys.length >= 8 ? 'landscape' : 'portrait';
        await exportData({
          data: rows,
          fields: ATTENDANCE_EXPORT_FIELDS,
          selectedFieldKeys,
          format: 'pdf',
          filename,
          title,
          branding,
          showExportDate,
          orientation,
        });
      }

      if (exportFormat === 'excel' || exportFormat === 'both') {
        await exportData({
          data: rows,
          fields: ATTENDANCE_EXPORT_FIELDS,
          selectedFieldKeys,
          format: 'excel',
          filename,
          title,
        });
      }
    } catch (err: unknown) {
      setFetching(false);
      console.error('[AttendanceExportModal] Daily export error:', err);
      const axErr = err as {
        response?: { data?: { message?: string; error?: { message?: string } } };
      };
      const serverMsg = axErr?.response?.data?.error?.message ?? axErr?.response?.data?.message;
      message.error(serverMsg ?? t('failToast'));
    } finally {
      setFetching(false);
    }
  };

  const exportMonthly = async (
    exportFormat: ExportFormat,
    branding: ExportBrandingOptions | undefined,
    filename: string,
  ) => {
    setFetching(true);
    try {
      const title = `Attendance Report - ${dayjs(`${year}-${month}-01`).format('MMMM YYYY')}`;
      const exportFilename = `${filename}_${year}_${String(month).padStart(2, '0')}`;

      if ((exportFormat === 'pdf' || exportFormat === 'both') && month && year) {
        await generateAttendancePdf({
          members,
          monthlyRecords: monthlyRecords ?? {},
          month,
          year,
          title,
          filename: exportFilename,
          branding,
          showExportDate,
        });
      }

      if ((exportFormat === 'excel' || exportFormat === 'both') && month && year) {
        await exportMonthlyToExcel(
          members,
          monthlyRecords ?? {},
          month,
          year,
          title,
          exportFilename,
        );
      }
    } catch (err: unknown) {
      setFetching(false);
      console.error('[AttendanceExportModal] Monthly export error:', err);
      const axErr = err as {
        response?: { data?: { message?: string; error?: { message?: string } } };
      };
      const serverMsg = axErr?.response?.data?.error?.message ?? axErr?.response?.data?.message;
      message.error(serverMsg ?? t('failToast'));
    } finally {
      setFetching(false);
    }
  };

  const defaultFieldLabels = useMemo(
    () =>
      ATTENDANCE_EXPORT_FIELDS.filter((f) => f.defaultEnabled)
        .map((f) => f.label)
        .join(', '),
    [],
  );

  const showBrandingSection = format === 'pdf' && (hasAnyBranding || loadingDefaults);
  const showFieldSelector = view === 'daily';

  const isExporting = fetching || exporting;

  const rangeInvalid = scope === 'date_range' && dayjs(rangeFrom).isAfter(dayjs(rangeTo));

  const canExport = view === 'daily' ? selectedFieldKeys.length > 0 && !rangeInvalid : true;

  return (
    <DsModal
      open={open}
      afterOpenChange={handleAfterOpenChange}
      onCancel={handleClose}
      title={t('title')}
      width={540}
      scrollable={true}
      scrollHeight="calc(100vh - 280px)"
      footer={
        <div className="flex justify-end gap-2 pt-1">
          <Button onClick={handleClose} disabled={isExporting}>
            Cancel
          </Button>
          <Button
            type="primary"
            loading={isExporting}
            disabled={isExporting || !canExport}
            onClick={handleExport}
          >
            Export
          </Button>
        </div>
      }
    >
      <div className="my-4">
        <Typography.Text strong className="mb-2 block text-sm">
          Format
        </Typography.Text>
        <Radio.Group value={format} onChange={(e) => setFormat(e.target.value as ExportFormat)}>
          <Space>
            <Tooltip title={!canExportPdf ? 'Upgrade to unlock PDF export' : undefined}>
              <Radio value="pdf" disabled={!canExportPdf}>
                PDF
              </Radio>
            </Tooltip>
            <Tooltip title={!canExportExcel ? 'Upgrade to unlock Excel export' : undefined}>
              <Radio value="excel" disabled={!canExportExcel}>
                Excel (.xlsx)
              </Radio>
            </Tooltip>
          </Space>
        </Radio.Group>
      </div>

      {view === 'daily' && (
        <>
          <Divider className="my-4" />
          <div className="my-4">
            <Typography.Text strong className="mb-2 block text-sm">
              Scope
            </Typography.Text>
            <Radio.Group
              value={scope}
              onChange={(e) => setScope(e.target.value)}
              className="w-full"
            >
              <Space orientation="vertical" size={10} className="w-full">
                <Radio value="current">
                  Current view
                  <Typography.Text type="secondary" className="ml-2 text-xs">
                    ({dayjs(date).format('DD MMM YYYY')} · filtered members)
                  </Typography.Text>
                </Radio>
                <Radio value="date_range">{t('dateRange')}</Radio>
              </Space>
            </Radio.Group>

            {scope === 'date_range' && (
              <div className="mt-3 ml-6 flex flex-wrap items-center gap-x-2 gap-y-2">
                <DatePicker
                  value={dayjs(rangeFrom)}
                  onChange={(d) => d && setRangeFrom(d.format('YYYY-MM-DD'))}
                  format="DD MMM YYYY"
                  size="small"
                  disabledDate={(d) => d.isAfter(dayjs())}
                  allowClear={false}
                  style={{ width: 130 }}
                />
                <Typography.Text type="secondary" className="shrink-0 text-xs">
                  to
                </Typography.Text>
                <DatePicker
                  value={dayjs(rangeTo)}
                  onChange={(d) => d && setRangeTo(d.format('YYYY-MM-DD'))}
                  format="DD MMM YYYY"
                  size="small"
                  disabledDate={(d) => d.isBefore(dayjs(rangeFrom)) || d.isAfter(dayjs())}
                  allowClear={false}
                  style={{ width: 130 }}
                />
                {rangeInvalid && (
                  <Typography.Text type="danger" className="mt-1 ml-6 block text-xs">
                    &quot;From&quot; date must be before &quot;To&quot; date
                  </Typography.Text>
                )}
              </div>
            )}
          </div>

          {scope === 'current' && (
            <>
              <Divider className="my-4" />

              <div className="mt-4">
                <Typography.Text strong className="mb-2 block text-sm">
                  Fields
                </Typography.Text>
                {!showCustomize ? (
                  <div>
                    <Typography.Text type="secondary" className="text-sm leading-relaxed">
                      Default: <span className="text-gray-700">{defaultFieldLabels}</span>
                      {'  '}
                      <span className="text-xs text-faint">
                        ({DEFAULT_FIELD_KEYS.length} fields)
                      </span>
                    </Typography.Text>
                    <div className="mt-2">
                      <Typography.Link
                        className="text-xs"
                        onClick={() => {
                          setSelectedFieldKeys([...DEFAULT_FIELD_KEYS]);
                          setShowCustomize(true);
                        }}
                      >
                        Customize fields ▾
                      </Typography.Link>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="mb-3 flex items-center justify-between">
                      <Typography.Text type="secondary" className="text-xs">
                        {selectedFieldKeys.length} of {ATTENDANCE_EXPORT_FIELDS.length} selected
                      </Typography.Text>
                      <Typography.Link
                        className="text-xs"
                        onClick={() => {
                          setSelectedFieldKeys([...DEFAULT_FIELD_KEYS]);
                          setShowCustomize(false);
                        }}
                      >
                        Reset to defaults
                      </Typography.Link>
                    </div>
                    <FieldSelector
                      fields={ATTENDANCE_EXPORT_FIELDS}
                      value={selectedFieldKeys}
                      onChange={setSelectedFieldKeys}
                    />
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}

      {view === 'monthly' && (
        <>
          <Divider className="my-4" />
          <div className="flex items-start gap-2 rounded-lg bg-gray-50 p-3">
            <Typography.Text type="secondary" className="text-xs leading-relaxed">
              Exports a matrix showing each employee&apos;s attendance for every day of the selected
              month, with a summary column.
            </Typography.Text>
          </div>
        </>
      )}

      {showBrandingSection && (
        <>
          <Divider className="my-4" />
          <div className="my-4">
            <Typography.Text strong className="mb-2 block text-sm">
              PDF Options
            </Typography.Text>
            {loadingDefaults && <Spin size="small" />}

            <div
              className={`space-y-2.5 ${hasAnyBranding ? 'mb-4 border-b border-gray-100 pb-3' : ''}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-600">{t('optionShowExportDateTime')}</span>
                <Switch size="small" checked={showExportDate} onChange={setShowExportDate} />
              </div>
            </div>

            {hasAnyBranding && (
              <div className="space-y-2.5">
                {hasHeaderLogo && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-600">{t('optionIncludeHeaderLogo')}</span>
                    <Switch
                      size="small"
                      checked={includeHeaderLogo}
                      onChange={setIncludeHeaderLogo}
                    />
                  </div>
                )}
                {hasFooter && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-600">{t('optionIncludeFooterDetails')}</span>
                    <Switch size="small" checked={includeFooter} onChange={setIncludeFooter} />
                  </div>
                )}
                {hasWatermark && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-600">{t('optionIncludeWatermark')}</span>
                    <Switch
                      size="small"
                      checked={includeWatermark}
                      onChange={setIncludeWatermark}
                    />
                  </div>
                )}
              </div>
            )}

            {!loadingDefaults &&
              hasBrandingAccess &&
              !currentWorkspace?.branding?.pdfHeaderLogo &&
              !currentWorkspace?.branding?.pdfWatermarkLogo &&
              !currentWorkspace?.branding?.pdfFooterDetails && (
                <Typography.Text type="secondary" className="text-xs">
                  Upload branding assets in Workspace Settings to customize your PDFs
                </Typography.Text>
              )}
          </div>
        </>
      )}

      {!canExportPdf && !canExportExcel && (
        <div className="mt-4 flex items-center gap-1.5 text-xs text-gray-700">
          <LockOutlined />
          <span>{t('upgradeToExport')}</span>
        </div>
      )}
    </DsModal>
  );
}

async function exportMonthlyToExcel(
  members: TeamMember[],
  monthlyRecords: Record<string, Record<string, string>>,
  month: number,
  year: number,
  title: string,
  filename: string,
): Promise<void> {
  const { utils, writeFile } = await import('xlsx');

  const daysInMonth = dayjs()
    .month(month - 1)
    .year(year)
    .daysInMonth();
  const monthStart = dayjs()
    .month(month - 1)
    .year(year)
    .startOf('month');

  const S_SHORT: Record<string, string> = {
    present: 'P',
    absent: 'A',
    half_day: 'H',
    late: 'L',
    on_leave: 'OL',
    holiday: 'Ho',
    week_off: 'WO',
    unmarked: '-',
  };

  const headerRow = [
    'Employee Name',
    'Designation',
    'Shift',
    ...Array.from({ length: daysInMonth }, (_, i) => {
      const d = i + 1;
      const date = monthStart.date(d);
      return `${d}\n${date.format('ddd')}`;
    }),
    'Summary',
  ];

  const dataRows: (string | number)[][] = [];

  for (const member of members) {
    const memberRecords = monthlyRecords[member.id] ?? {};
    const row: (string | number)[] = [
      member.name,
      member.designation ?? '-',
      member.shift?.name ?? '-',
    ];

    let pCount = 0,
      aCount = 0,
      hCount = 0,
      olCount = 0;

    for (let d = 1; d <= daysInMonth; d++) {
      const dateKey = monthStart.date(d).format('YYYY-MM-DD');
      const status = memberRecords[dateKey] ?? 'unmarked';
      const short = S_SHORT[status] ?? '-';

      if (status === 'present' || status === 'late') pCount++;
      else if (status === 'absent') aCount++;
      else if (status === 'half_day') hCount++;
      else if (status === 'on_leave') olCount++;

      row.push(short);
    }

    const summary = `${pCount}P / ${aCount}A / ${hCount}H${olCount > 0 ? ` / ${olCount}OL` : ''}`;
    row.push(summary);

    dataRows.push(row);
  }

  const ws = utils.aoa_to_sheet([headerRow, ...dataRows]);

  const colWidths: { wch: number }[] = [
    { wch: 25 },
    { wch: 18 },
    { wch: 15 },
    ...Array.from({ length: daysInMonth }, () => ({ wch: 5 })),
    { wch: 18 },
  ];
  ws['!cols'] = colWidths;

  const wb = utils.book_new();
  utils.book_append_sheet(wb, ws, 'Attendance');

  const exportDate = dayjs().format('YYYY-MM-DD');
  writeFile(wb, `${filename}_export_${exportDate}.xlsx`);
}

async function exportRangeToExcel(
  members: TeamMember[],
  rangeRecords: Record<string, Record<string, string>>,
  fromDate: string,
  toDate: string,
  title: string,
  filename: string,
): Promise<void> {
  const { utils, writeFile } = await import('xlsx');

  const S_SHORT: Record<string, string> = {
    present: 'P',
    absent: 'A',
    half_day: 'H',
    late: 'L',
    on_leave: 'OL',
    holiday: 'Ho',
    week_off: 'WO',
    unmarked: '-',
  };

  const dates: dayjs.Dayjs[] = [];
  let cur = dayjs(fromDate);
  const end = dayjs(toDate);
  while (!cur.isAfter(end)) {
    dates.push(cur);
    cur = cur.add(1, 'day');
  }

  const headerRow = [
    'Employee Name',
    'Designation',
    'Shift',
    ...dates.map((d) => `${d.date()}\n${d.format('ddd')}`),
    'Summary',
  ];

  const dataRows: (string | number)[][] = [];

  for (const member of members) {
    const memberRecords = rangeRecords[member.id] ?? {};
    const joinDate = member.dateOfJoining ? dayjs(member.dateOfJoining).startOf('day') : null;

    const row: (string | number)[] = [
      member.name,
      member.designation ?? '-',
      member.shift?.name ?? '-',
    ];

    let pCount = 0,
      aCount = 0,
      hCount = 0,
      olCount = 0;

    for (const d of dates) {
      const dateKey = d.format('YYYY-MM-DD');
      const isPreJoining = joinDate !== null && d.isBefore(joinDate);

      if (isPreJoining) {
        row.push('·');
        continue;
      }

      const status = memberRecords[dateKey] ?? 'unmarked';
      const short = S_SHORT[status] ?? '-';

      if (status === 'present' || status === 'late') pCount++;
      else if (status === 'absent') aCount++;
      else if (status === 'half_day') hCount++;
      else if (status === 'on_leave') olCount++;

      row.push(short);
    }

    const summary = `${pCount}P / ${aCount}A / ${hCount}H${olCount > 0 ? ` / ${olCount}OL` : ''}`;
    row.push(summary);

    dataRows.push(row);
  }

  const ws = utils.aoa_to_sheet([headerRow, ...dataRows]);

  const colWidths: { wch: number }[] = [
    { wch: 25 },
    { wch: 18 },
    { wch: 15 },
    ...Array.from({ length: dates.length }, () => ({ wch: 5 })),
    { wch: 18 },
  ];
  ws['!cols'] = colWidths;

  const wb = utils.book_new();
  const sheetName = dates.length > 31 ? 'Attendance' : 'Attendance';
  utils.book_append_sheet(wb, ws, sheetName);

  const exportDateStr = dayjs().format('YYYY-MM-DD');
  writeFile(wb, `${filename}_export_${exportDateStr}.xlsx`);
}
