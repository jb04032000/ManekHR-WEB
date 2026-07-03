'use client';

import { useState } from 'react';
import {
  Alert,
  Button,
  Checkbox,
  Form,
  Input,
  InputNumber,
  Select,
  Space,
  Table,
  Tooltip,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { DeleteOutlined, InfoCircleOutlined, PlusOutlined, SendOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useTranslations } from 'next-intl';
import { formatCurrencyFull } from '@/lib/utils';
import type { TeamMember } from '@/types';

const CURRENT_YEAR = dayjs().year();
const FY_OPTIONS = Array.from({ length: 6 }, (_, i) => {
  const y = CURRENT_YEAR - i;
  return { value: y, label: `FY ${y}-${String(y + 1).slice(2)}` };
});

const MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => ({
  value: i + 1,
  label: dayjs().month(i).format('MMMM'),
}));

const YEAR_OPTIONS = Array.from({ length: 5 }, (_, i) => ({
  value: CURRENT_YEAR - i,
  label: String(CURRENT_YEAR - i),
}));

const SUBTYPE_OPTIONS = [
  'festival_diwali',
  'festival_eid',
  'festival_holi',
  'festival_navratri',
  'festival_other',
  'performance',
  'referral',
  'other',
];

interface EntryRow {
  key: string;
  teamMemberId: string;
  amount: number;
  note: string;
}

interface Props {
  loading: boolean;
  members: TeamMember[];
  onSubmit: (opts: {
    subType: string;
    financialYear: number;
    disbursedMonth: number;
    disbursedYear: number;
    countsAsStatutory: boolean;
    entries: Array<{ teamMemberId: string; amount: number; note?: string }>;
    note?: string;
  }) => void;
}

export function FestivalBonusTab({ loading, members, onSubmit }: Props) {
  const t = useTranslations('salary.bonus');

  const [fy, setFy] = useState<number>(CURRENT_YEAR - (dayjs().month() >= 3 ? 0 : 1));
  const [subType, setSubType] = useState<string>('festival_diwali');
  const [disbursedMonth, setDisbursedMonth] = useState<number>(dayjs().month() + 1);
  const [disbursedYear, setDisbursedYear] = useState<number>(CURRENT_YEAR);
  const [countsAsStatutory, setCountsAsStatutory] = useState(false);
  const [batchNote, setBatchNote] = useState('');
  const [entries, setEntries] = useState<EntryRow[]>([
    { key: '0', teamMemberId: '', amount: 0, note: '' },
  ]);

  const memberOptions = members.map((m) => ({ value: m.id, label: m.name }));

  const addRow = () => {
    setEntries((prev) => [
      ...prev,
      { key: String(Date.now()), teamMemberId: '', amount: 0, note: '' },
    ]);
  };

  const removeRow = (key: string) => {
    setEntries((prev) => prev.filter((e) => e.key !== key));
  };

  const updateRow = (key: string, field: keyof EntryRow, value: string | number) => {
    setEntries((prev) => prev.map((e) => (e.key === key ? { ...e, [field]: value } : e)));
  };

  const validEntries = entries.filter((e) => e.teamMemberId && e.amount > 0);
  const totalAmount = validEntries.reduce((s, e) => s + e.amount, 0);

  const handleSubmit = () => {
    if (validEntries.length === 0) return;
    onSubmit({
      subType,
      financialYear: fy,
      disbursedMonth,
      disbursedYear,
      countsAsStatutory,
      entries: validEntries.map((e) => ({
        teamMemberId: e.teamMemberId,
        amount: e.amount,
        note: e.note || undefined,
      })),
      note: batchNote || undefined,
    });
  };

  const columns: ColumnsType<EntryRow> = [
    {
      title: t('colEmployee'),
      key: 'member',
      width: 240,
      render: (_: unknown, row: EntryRow) => (
        <Select
          showSearch
          optionFilterProp="label"
          value={row.teamMemberId || undefined}
          placeholder={t('fieldMemberPlaceholder')}
          options={memberOptions}
          onChange={(v: string) => updateRow(row.key, 'teamMemberId', v)}
          style={{ width: '100%' }}
        />
      ),
    },
    {
      title: t('colAmount'),
      key: 'amount',
      width: 160,
      render: (_: unknown, row: EntryRow) => (
        <InputNumber
          min={0.01}
          precision={2}
          prefix="Rs"
          value={row.amount || undefined}
          placeholder="0.00"
          onChange={(v) => updateRow(row.key, 'amount', v ?? 0)}
          style={{ width: '100%' }}
        />
      ),
    },
    {
      title: t('colNote'),
      key: 'note',
      render: (_: unknown, row: EntryRow) => (
        <Input
          value={row.note}
          placeholder={t('fieldNotePlaceholder')}
          onChange={(e) => updateRow(row.key, 'note', e.target.value)}
        />
      ),
    },
    {
      title: '',
      key: 'actions',
      width: 48,
      render: (_: unknown, row: EntryRow) => (
        <Button
          type="text"
          icon={<DeleteOutlined />}
          onClick={() => removeRow(row.key)}
          disabled={entries.length === 1}
          aria-label={t('removeRowBtn')}
          danger
        />
      ),
    },
  ];

  return (
    <div className="py-4">
      {/* About festival bonus */}
      <Alert
        title={t('festivalInfoTitle')}
        description={t('festivalInfoDesc')}
        type="warning"
        showIcon
        className="mb-5"
        style={{ borderRadius: 10 }}
      />

      {/* Controls */}
      <div className="mb-5 flex flex-wrap items-end gap-3">
        <Form.Item label={t('fieldSubType')} className="mb-0">
          <Select
            value={subType}
            onChange={(v: string) => setSubType(v)}
            options={SUBTYPE_OPTIONS.map((s) => ({ value: s, label: t(`subType.${s}`) }))}
            style={{ width: 180 }}
          />
        </Form.Item>

        <Form.Item label={t('fieldFy')} className="mb-0">
          <Select
            value={fy}
            onChange={(v: number) => setFy(v)}
            options={FY_OPTIONS}
            style={{ width: 150 }}
          />
        </Form.Item>

        <Form.Item label={t('fieldDisbursedMonth')} className="mb-0">
          <Select
            value={disbursedMonth}
            onChange={(v: number) => setDisbursedMonth(v)}
            options={MONTH_OPTIONS}
            style={{ width: 140 }}
          />
        </Form.Item>

        <Form.Item label={t('fieldDisbursedYear')} className="mb-0">
          <Select
            value={disbursedYear}
            onChange={(v: number) => setDisbursedYear(v)}
            options={YEAR_OPTIONS}
            style={{ width: 110 }}
          />
        </Form.Item>
      </div>

      {/* countsAsStatutory checkbox */}
      <div
        className="mb-5 rounded-xl border p-4"
        style={{ borderColor: 'var(--cr-border)', background: 'var(--cr-surface)' }}
      >
        <Space align="start">
          <Checkbox
            checked={countsAsStatutory}
            onChange={(e) => setCountsAsStatutory(e.target.checked)}
          >
            <span className="text-[14px] font-medium">{t('countsAsStatutoryLabel')}</span>
          </Checkbox>
          <Tooltip
            title={t('countsAsStatutoryTooltip')}
            placement="topLeft"
            styles={{ root: { maxWidth: 360 } }}
          >
            <InfoCircleOutlined
              className="ml-1 text-[13px] text-subtle"
              style={{ cursor: 'help' }}
            />
          </Tooltip>
        </Space>
        {countsAsStatutory && (
          <p className="mt-2 mb-0 text-[12px] text-blue-600">{t('countsAsStatutoryNote')}</p>
        )}
      </div>

      {/* ESI warning for festival bonus */}
      <Alert
        title={t('festivalEsiTitle')}
        description={t('festivalEsiDesc')}
        type="warning"
        showIcon
        className="mb-5"
        style={{ borderRadius: 10 }}
      />

      {/* Entries table */}
      <Table<EntryRow>
        rowKey="key"
        size="middle"
        columns={columns}
        dataSource={entries}
        pagination={false}
        scroll={{ x: 'max-content' }}
        locale={{ emptyText: t('emptyEntries') }}
        footer={() => (
          <Button icon={<PlusOutlined />} onClick={addRow} type="dashed" block>
            {t('addRowBtn')}
          </Button>
        )}
      />

      {/* Batch note + submit */}
      <div className="mt-5 flex flex-wrap items-end gap-3">
        <Form.Item label={t('batchNoteLabel')} className="mb-0" style={{ flex: 1, minWidth: 240 }}>
          <Input
            value={batchNote}
            placeholder={t('batchNotePlaceholder')}
            onChange={(e) => setBatchNote(e.target.value)}
          />
        </Form.Item>

        {validEntries.length > 0 && (
          <div className="mb-0 self-end text-right text-[13px] text-subtle">
            {t('festivalTotal', {
              count: validEntries.length,
              total: formatCurrencyFull(totalAmount),
            })}
          </div>
        )}

        <Button
          type="primary"
          icon={<SendOutlined />}
          loading={loading}
          disabled={validEntries.length === 0}
          onClick={handleSubmit}
        >
          {t('festivalSubmitBtn', { count: validEntries.length })}
        </Button>
      </div>
    </div>
  );
}
