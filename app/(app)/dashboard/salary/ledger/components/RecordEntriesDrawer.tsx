'use client';

import { useState } from 'react';
import { App, Button, DatePicker, Drawer, InputNumber, Select, Space, Table, Tooltip } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useTranslations } from 'next-intl';
import { salaryApi } from '@/lib/api';
import { parseApiError } from '@/lib/utils';
import type { LedgerEntryItem } from '@/types';

interface MemberOption {
  id: string;
  name: string;
  designation?: string;
}

interface EntryRow {
  key: string;
  teamMemberId: string;
  type: 'earning' | 'draw';
  amount: number;
  note: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  workspaceId: string;
  members: MemberOption[];
  onCreated: () => void;
  /** Pre-select a member (e.g. from a row action). */
  preselectedMemberId?: string;
}

function makeKey() {
  return `${Date.now()}-${Math.random()}`;
}

function makeRow(memberId = ''): EntryRow {
  return { key: makeKey(), teamMemberId: memberId, type: 'earning', amount: 0, note: '' };
}

export function RecordEntriesDrawer({
  open,
  onClose,
  workspaceId,
  members,
  onCreated,
  preselectedMemberId,
}: Props) {
  const t = useTranslations('salary.ledger');
  const { message } = App.useApp();

  const [date, setDate] = useState<dayjs.Dayjs>(dayjs());
  const [rows, setRows] = useState<EntryRow[]>([makeRow(preselectedMemberId ?? '')]);
  const [submitting, setSubmitting] = useState(false);

  const memberOptions = members.map((m) => ({
    value: m.id,
    label: m.designation ? `${m.name} - ${m.designation}` : m.name,
  }));

  const updateRow = (key: string, patch: Partial<EntryRow>) => {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  };

  const removeRow = (key: string) => {
    setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.key !== key) : prev));
  };

  const addRow = () => {
    setRows((prev) => [...prev, makeRow()]);
  };

  const handleSubmit = async () => {
    const valid = rows.filter((r) => r.teamMemberId && r.amount > 0);
    if (valid.length === 0) {
      void message.warning(t('recordValidationEmpty'));
      return;
    }
    setSubmitting(true);
    try {
      const entries: LedgerEntryItem[] = valid.map((r) => ({
        teamMemberId: r.teamMemberId,
        type: r.type,
        amount: r.amount,
        date: date.format('YYYY-MM-DD'),
        note: r.note || undefined,
      }));
      const result = await salaryApi.recordLedgerEntries(workspaceId, { entries });
      void message.success(t('recordSuccess', { count: result.created }));
      setRows([makeRow()]);
      setDate(dayjs());
      onCreated();
    } catch (e) {
      void message.error(parseApiError(e) || t('recordError'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setRows([makeRow()]);
    setDate(dayjs());
    onClose();
  };

  const columns: ColumnsType<EntryRow> = [
    {
      title: t('fieldMember'),
      dataIndex: 'teamMemberId',
      width: 180,
      render: (val: string, row) => (
        <Select
          options={memberOptions}
          value={val || undefined}
          onChange={(v) => updateRow(row.key, { teamMemberId: v as string })}
          placeholder={t('fieldMemberPlaceholder')}
          showSearch
          filterOption={(input, opt) =>
            ((opt?.label as string) ?? '').toLowerCase().includes(input.toLowerCase())
          }
          style={{ width: '100%' }}
          size="small"
        />
      ),
    },
    {
      title: t('fieldType'),
      dataIndex: 'type',
      width: 120,
      render: (val: string, row) => (
        <Select
          options={[
            { value: 'earning', label: t('typeEarning') },
            { value: 'draw', label: t('typeDraw') },
          ]}
          value={val}
          onChange={(v) => updateRow(row.key, { type: v as 'earning' | 'draw' })}
          style={{ width: '100%' }}
          size="small"
        />
      ),
    },
    {
      title: t('fieldAmount'),
      dataIndex: 'amount',
      width: 130,
      render: (val: number, row) => (
        <InputNumber
          prefix="Rs."
          value={val || undefined}
          min={0}
          precision={0}
          onChange={(v) => updateRow(row.key, { amount: Number(v ?? 0) })}
          placeholder="0"
          style={{ width: '100%' }}
          size="small"
        />
      ),
    },
    {
      title: t('fieldNote'),
      dataIndex: 'note',
      render: (val: string, row) => (
        <input
          className="ant-input ant-input-sm w-full rounded border px-2 py-1 text-sm"
          style={{ borderColor: 'var(--cr-border)' }}
          value={val}
          onChange={(e) => updateRow(row.key, { note: e.target.value })}
          placeholder={t('fieldNotePlaceholder')}
          maxLength={200}
        />
      ),
    },
    {
      title: '',
      width: 40,
      render: (_: unknown, row) => (
        <Tooltip title={t('removeRow')}>
          <Button
            type="text"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => removeRow(row.key)}
            disabled={rows.length === 1}
          />
        </Tooltip>
      ),
    },
  ];

  const validCount = rows.filter((r) => r.teamMemberId && r.amount > 0).length;

  return (
    <Drawer
      open={open}
      onClose={handleClose}
      title={t('recordDrawerTitle')}
      size={780}
      footer={
        <div className="flex justify-end gap-2">
          <Button onClick={handleClose}>{t('cancelBtn')}</Button>
          <Button
            type="primary"
            loading={submitting}
            onClick={handleSubmit}
            disabled={validCount === 0}
          >
            {t('recordSubmitBtn', { count: validCount })}
          </Button>
        </div>
      }
    >
      <div className="mb-4 flex items-center gap-3">
        <span className="text-sm font-medium">{t('fieldDate')}</span>
        <DatePicker
          value={date}
          onChange={(d) => {
            if (d) setDate(d);
          }}
          format="DD MMM YYYY"
          allowClear={false}
          disabledDate={(d) => d.isAfter(dayjs(), 'day')}
        />
      </div>

      <Table<EntryRow>
        columns={columns}
        dataSource={rows}
        rowKey="key"
        pagination={false}
        size="small"
        className="mb-3"
        scroll={{ x: 'max-content' }}
      />

      <Space>
        <Button icon={<PlusOutlined />} onClick={addRow} disabled={rows.length >= 50}>
          {t('addRowBtn')}
        </Button>
      </Space>
    </Drawer>
  );
}
