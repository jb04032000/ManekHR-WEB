'use client';

import { useState } from 'react';
import {
  Alert,
  App,
  Button,
  Divider,
  Drawer,
  Form,
  InputNumber,
  Select,
  Space,
  Table,
  Tabs,
  Upload,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { DeleteOutlined, PlusOutlined, UploadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useTranslations } from 'next-intl';
import { salaryApi } from '@/lib/api';
import { parseApiError } from '@/lib/utils';
import type { CommissionCategory, CommissionEntryItem, CommissionType } from '@/types';

// Client-side CSV parser for bulk import preview
interface CsvPreviewRow {
  rowIndex: number;
  memberId: string | null;
  memberName: string;
  amount: number;
  category: CommissionCategory;
  commissionType: CommissionType;
  reasonTitle: string;
  note: string;
  status: 'ok' | 'error';
  errorReason?: string;
}

interface MemberOption {
  id: string;
  name: string;
  designation?: string;
}

interface ManualEntryRow {
  key: string;
  teamMemberId: string;
  category: CommissionCategory;
  commissionType: CommissionType;
  amount: number;
  reasonTitle: string;
  note?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  workspaceId: string;
  members: MemberOption[];
  onCreated: () => void;
}

const MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => ({
  value: i + 1,
  label: dayjs().month(i).format('MMMM'),
}));

const CURRENT_YEAR = dayjs().year();
const YEAR_OPTIONS = Array.from({ length: 5 }, (_, i) => ({
  value: CURRENT_YEAR - i,
  label: String(CURRENT_YEAR - i),
}));

const COMMISSION_TYPES: CommissionType[] = [
  'sales',
  'production_piece',
  'attendance',
  'referral',
  'other',
];

function parseCsv(
  text: string,
  members: MemberOption[],
  t: (key: string) => string,
): CsvPreviewRow[] {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];

  // Skip header row if present
  const dataLines = lines[0].toLowerCase().includes('member') ? lines.slice(1) : lines;

  return dataLines.map((line, i) => {
    const cols = line.split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
    // CSV format: memberName, amount, category, commissionType, reasonTitle, note
    const [
      rawName = '',
      rawAmount = '',
      rawCategory = '',
      rawType = '',
      rawReason = '',
      rawNote = '',
    ] = cols;

    const amount = parseFloat(rawAmount);
    const category = (
      ['commission', 'incentive'].includes(rawCategory.toLowerCase())
        ? rawCategory.toLowerCase()
        : 'commission'
    ) as CommissionCategory;
    const commissionType = (
      COMMISSION_TYPES.includes(rawType.toLowerCase() as CommissionType)
        ? rawType.toLowerCase()
        : 'other'
    ) as CommissionType;

    // Match by name (case-insensitive)
    const matched = members.find((m) => m.name.toLowerCase() === rawName.toLowerCase());

    if (!rawName) {
      return {
        rowIndex: i + 1,
        memberId: null,
        memberName: rawName,
        amount,
        category,
        commissionType,
        reasonTitle: rawReason || `${category} import`,
        note: rawNote,
        status: 'error' as const,
        errorReason: t('csvErrNoName'),
      };
    }
    if (!matched) {
      return {
        rowIndex: i + 1,
        memberId: null,
        memberName: rawName,
        amount,
        category,
        commissionType,
        reasonTitle: rawReason || `${category} import`,
        note: rawNote,
        status: 'error' as const,
        errorReason: t('csvErrNoMember'),
      };
    }
    if (isNaN(amount) || amount <= 0) {
      return {
        rowIndex: i + 1,
        memberId: matched.id,
        memberName: rawName,
        amount,
        category,
        commissionType,
        reasonTitle: rawReason || `${category} import`,
        note: rawNote,
        status: 'error' as const,
        errorReason: t('csvErrInvalidAmount'),
      };
    }

    return {
      rowIndex: i + 1,
      memberId: matched.id,
      memberName: rawName,
      amount,
      category,
      commissionType,
      reasonTitle: rawReason || `${category} import`,
      note: rawNote,
      status: 'ok' as const,
    };
  });
}

function downloadTemplateCsv() {
  const header = 'memberName,amount,category,commissionType,reasonTitle,note';
  const example = 'Ravi Patel,5000,commission,sales,Sales Commission May 2026,Q1 target achieved';
  const blob = new Blob([`${header}\n${example}\n`], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'commission_import_template.csv';
  a.click();
  URL.revokeObjectURL(url);
}

export function RecordCommissionDrawer({ open, onClose, workspaceId, members, onCreated }: Props) {
  const t = useTranslations('salary.commission');
  const { message } = App.useApp();

  const [submitting, setSubmitting] = useState(false);
  const [month, setMonth] = useState<number>(dayjs().month() + 1);
  const [year, setYear] = useState<number>(dayjs().year());

  // Manual entry rows
  const [rows, setRows] = useState<ManualEntryRow[]>([
    {
      key: 'row-0',
      teamMemberId: '',
      category: 'commission',
      commissionType: 'other',
      amount: 0,
      reasonTitle: '',
    },
  ]);

  // CSV import state
  const [csvPreview, setCsvPreview] = useState<CsvPreviewRow[] | null>(null);
  const [csvSubmitting, setCsvSubmitting] = useState(false);

  const addRow = () => {
    setRows((prev) => [
      ...prev,
      {
        key: String(Date.now()),
        teamMemberId: '',
        category: 'commission',
        commissionType: 'other',
        amount: 0,
        reasonTitle: '',
      },
    ]);
  };

  const removeRow = (key: string) => {
    setRows((prev) => prev.filter((r) => r.key !== key));
  };

  const updateRow = <K extends keyof ManualEntryRow>(
    key: string,
    field: K,
    value: ManualEntryRow[K],
  ) => {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, [field]: value } : r)));
  };

  const handleManualSubmit = async () => {
    const validRows = rows.filter((r) => r.teamMemberId && r.amount > 0 && r.reasonTitle);
    if (validRows.length === 0) {
      message.warning(t('recordValidationEmpty'));
      return;
    }

    setSubmitting(true);
    try {
      const entries: CommissionEntryItem[] = validRows.map((r) => ({
        teamMemberId: r.teamMemberId,
        category: r.category,
        commissionType: r.commissionType,
        amount: r.amount,
        reasonTitle: r.reasonTitle,
        note: r.note,
      }));

      await salaryApi.recordCommissionEntries(workspaceId, {
        month,
        year,
        entries,
      });
      message.success(t('recordSuccess', { count: entries.length }));
      onCreated();
    } catch (e) {
      message.error(parseApiError(e) || t('recordError'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleCsvFile = (file: File): boolean => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = (ev.target?.result as string) ?? '';
      const preview = parseCsv(text, members, (key) => t(key as Parameters<typeof t>[0]));
      setCsvPreview(preview);
    };
    reader.readAsText(file);
    return false; // prevent default upload
  };

  const handleCsvSubmit = async () => {
    if (!csvPreview) return;
    const okRows = csvPreview.filter((r) => r.status === 'ok' && r.memberId);
    if (okRows.length === 0) {
      message.warning(t('csvNoValidRows'));
      return;
    }
    setCsvSubmitting(true);
    try {
      const entries: CommissionEntryItem[] = okRows.map((r) => ({
        teamMemberId: r.memberId!,
        category: r.category,
        commissionType: r.commissionType,
        amount: r.amount,
        reasonTitle: r.reasonTitle,
        note: r.note || undefined,
      }));
      await salaryApi.recordCommissionEntries(workspaceId, { month, year, entries });
      message.success(t('recordSuccess', { count: okRows.length }));
      setCsvPreview(null);
      onCreated();
    } catch (e) {
      message.error(parseApiError(e) || t('recordError'));
    } finally {
      setCsvSubmitting(false);
    }
  };

  const csvColumns: ColumnsType<CsvPreviewRow> = [
    { title: '#', dataIndex: 'rowIndex', key: 'rowIndex', width: 50 },
    { title: t('csvColName'), dataIndex: 'memberName', key: 'memberName' },
    {
      title: t('csvColAmount'),
      dataIndex: 'amount',
      key: 'amount',
      align: 'right',
      render: (v: number) => (isNaN(v) ? '-' : `Rs ${v.toLocaleString()}`),
    },
    { title: t('csvColCategory'), dataIndex: 'category', key: 'category' },
    { title: t('csvColType'), dataIndex: 'commissionType', key: 'commissionType' },
    { title: t('csvColReason'), dataIndex: 'reasonTitle', key: 'reasonTitle' },
    {
      title: t('csvColStatus'),
      dataIndex: 'status',
      key: 'status',
      render: (s: string, row: CsvPreviewRow) =>
        s === 'ok' ? (
          <span className="text-[12px] text-green-600">{t('csvStatusOk')}</span>
        ) : (
          <span className="text-[12px] text-red-500">{row.errorReason}</span>
        ),
    },
  ];

  const memberOptions = members.map((m) => ({
    value: m.id,
    label: m.name,
    description: m.designation,
  }));

  const manualTabContent = (
    <div>
      {/* Period selector */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Form.Item label={t('fieldMonth')} className="mb-0">
          <Select
            style={{ width: 140 }}
            value={month}
            onChange={setMonth}
            options={MONTH_OPTIONS}
          />
        </Form.Item>
        <Form.Item label={t('fieldYear')} className="mb-0">
          <Select style={{ width: 110 }} value={year} onChange={setYear} options={YEAR_OPTIONS} />
        </Form.Item>
      </div>

      <Divider className="my-3" />

      {/* Entry rows */}
      <div className="space-y-3">
        {rows.map((row, idx) => (
          <div
            key={row.key}
            className="rounded-lg border p-3"
            style={{ borderColor: 'var(--cr-border)' }}
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[12px] font-medium text-subtle">
                {t('entryRow')} {idx + 1}
              </span>
              {rows.length > 1 && (
                <Button
                  size="small"
                  type="text"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => removeRow(row.key)}
                />
              )}
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Form.Item label={t('fieldMember')} className="mb-0" required>
                <Select
                  showSearch
                  placeholder={t('fieldMemberPlaceholder')}
                  style={{ width: '100%' }}
                  value={row.teamMemberId || undefined}
                  onChange={(v: string) => updateRow(row.key, 'teamMemberId', v)}
                  optionFilterProp="label"
                  options={memberOptions}
                />
              </Form.Item>
              <Form.Item label={t('fieldCategory')} className="mb-0">
                <Select
                  style={{ width: '100%' }}
                  value={row.category}
                  onChange={(v: CommissionCategory) => updateRow(row.key, 'category', v)}
                  options={[
                    { value: 'commission', label: t('category.commission') },
                    { value: 'incentive', label: t('category.incentive') },
                  ]}
                />
              </Form.Item>
              <Form.Item label={t('fieldCommissionType')} className="mb-0">
                <Select
                  style={{ width: '100%' }}
                  value={row.commissionType}
                  onChange={(v: CommissionType) => updateRow(row.key, 'commissionType', v)}
                  options={COMMISSION_TYPES.map((ct) => ({
                    value: ct,
                    label: t(`commissionType.${ct}`),
                  }))}
                />
              </Form.Item>
              <Form.Item label={t('fieldAmount')} className="mb-0" required>
                <InputNumber
                  prefix="Rs"
                  min={0.01}
                  precision={2}
                  style={{ width: '100%' }}
                  value={row.amount || undefined}
                  onChange={(v) => updateRow(row.key, 'amount', v ?? 0)}
                />
              </Form.Item>
              <Form.Item label={t('fieldReason')} className="mb-0 sm:col-span-2" required>
                <Select
                  showSearch
                  mode="tags"
                  maxCount={1}
                  placeholder={t('fieldReasonPlaceholder')}
                  style={{ width: '100%' }}
                  value={row.reasonTitle ? [row.reasonTitle] : []}
                  onChange={(v: string[]) =>
                    updateRow(row.key, 'reasonTitle', v[v.length - 1] ?? '')
                  }
                  options={[]}
                />
              </Form.Item>
            </div>
          </div>
        ))}
      </div>

      <Button className="mt-3" type="dashed" icon={<PlusOutlined />} onClick={addRow} block>
        {t('addRowBtn')}
      </Button>

      <div className="mt-4 flex justify-end gap-2">
        <Button onClick={onClose}>{t('cancelBtn')}</Button>
        <Button type="primary" loading={submitting} onClick={() => void handleManualSubmit()}>
          {t('submitBtn', { count: rows.filter((r) => r.teamMemberId && r.amount > 0).length })}
        </Button>
      </div>
    </div>
  );

  const csvTabContent = (
    <div>
      {/* Period selector */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Form.Item label={t('fieldMonth')} className="mb-0">
          <Select
            style={{ width: 140 }}
            value={month}
            onChange={setMonth}
            options={MONTH_OPTIONS}
          />
        </Form.Item>
        <Form.Item label={t('fieldYear')} className="mb-0">
          <Select style={{ width: 110 }} value={year} onChange={setYear} options={YEAR_OPTIONS} />
        </Form.Item>
      </div>

      <Alert
        title={t('csvFormatTitle')}
        description={
          <div>
            <p className="m-0">{t('csvFormatDesc')}</p>
            <code className="mt-1 block text-[11px]">
              memberName, amount, category, commissionType, reasonTitle, note
            </code>
          </div>
        }
        type="info"
        showIcon
        className="mb-3"
      />

      <div className="mb-3 flex items-center gap-3">
        <Upload accept=".csv" showUploadList={false} beforeUpload={handleCsvFile}>
          <Button icon={<UploadOutlined />}>{t('csvUploadBtn')}</Button>
        </Upload>
        <Button type="link" onClick={downloadTemplateCsv}>
          {t('csvDownloadTemplate')}
        </Button>
      </div>

      {csvPreview && (
        <>
          <div className="mb-2 flex items-center gap-3">
            <span className="text-[13px] text-subtle">
              {t('csvPreviewRows', {
                total: csvPreview.length,
                ok: csvPreview.filter((r) => r.status === 'ok').length,
                errors: csvPreview.filter((r) => r.status === 'error').length,
              })}
            </span>
            <Button size="small" onClick={() => setCsvPreview(null)}>
              {t('csvClearBtn')}
            </Button>
          </div>
          <Table<CsvPreviewRow>
            rowKey="rowIndex"
            size="small"
            dataSource={csvPreview}
            columns={csvColumns}
            pagination={false}
            scroll={{ x: 'max-content', y: 260 }}
            rowClassName={(r) => (r.status === 'error' ? 'opacity-50' : '')}
          />
          <div className="mt-3 flex justify-end gap-2">
            <Button onClick={() => setCsvPreview(null)}>{t('cancelBtn')}</Button>
            <Button
              type="primary"
              loading={csvSubmitting}
              disabled={!csvPreview.some((r) => r.status === 'ok')}
              onClick={() => void handleCsvSubmit()}
            >
              {t('csvSubmitBtn', {
                count: csvPreview.filter((r) => r.status === 'ok').length,
              })}
            </Button>
          </div>
        </>
      )}
    </div>
  );

  return (
    <Drawer open={open} onClose={onClose} title={t('drawerTitle')} size={600} destroyOnHidden>
      <p className="mb-4 text-[13px] text-subtle">{t('drawerSubtitle')}</p>
      <Tabs
        items={[
          { key: 'manual', label: t('drawerTabManual'), children: manualTabContent },
          { key: 'csv', label: t('drawerTabCsv'), children: csvTabContent },
        ]}
      />
    </Drawer>
  );
}
